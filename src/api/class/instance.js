/* eslint-disable no-unsafe-optional-chaining */
const QRCode = require('qrcode')
const pino = require('pino')
const {
    default: makeWASocket,
    DisconnectReason,
    downloadMediaMessage
} = require('@whiskeysockets/baileys')
const { unlinkSync, writeFileSync } = require('fs')
const { v4: uuidv4 } = require('uuid')
const path = require('node:path')
const processButton = require('../helper/processbtn')
const generateVC = require('../helper/genVc')
const Chat = require('../models/chat.model')
const axios = require('axios')
const config = require('../../config/config')
const downloadMessage = require('../helper/downloadMsg')
const logger = require('pino')()
const useMongoDBAuthState = require('../helper/mongoAuthState')
const fs = require('node:fs')
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const mime = require('mime-types')


const saveStats = require('../helper/saveStats');
const {sendDataToSupabase, adicionaRegistro, uploadSUp, fetchAllDataFromTable, deleteDataFromtable, updateDataInTable, getIdConexoes, getSingleConversa, getSingleWebhook, getIdWebHookMessage, getContato, fetchSetores, getConexao} = require('../helper/sendSupabase');

class WhatsAppInstance {
    socketConfig = {
        version: [2, 2413, 1],
        defaultQueryTimeoutMs: undefined,
        printQRInTerminal: false,
        logger: pino({
            level: 'silent',
        }),
    }
    _status = ''

    get status() {
        return this._status
    }

    set status(value) {
        this._status = value
        console.log('status alterado para: ', value)
        if (value === 'desconectado') {
            axios.post(`${this.url}/whatsapp_desconectado`, {
                dominio: this.key
            })
        }else if (value === 'conectando') {
            axios.post(`${this.url}/whatsapp_conectando`, {
                dominio: this.key
            })
        }else if (value === 'qr') {
            axios.post(`${this.url}/whatsapp_atualizarqr`, {
                dominio: this.key,
                qr: this.instance.qr
            })
            
        } else if (value === 'pronto') {
            axios.post(`${this.url}/whatsapp_conectado`, {
                dominio: this.key
            })
        }
        
    }

    key = ''
    url = 'https://transportta.allstark.com.br/api/1.1/wf'
    name = null
    authState
    allowWebhook = undefined
    webhook = undefined
    clientId = null
    empresaId = null
    duplicado = false

    instance = {
        conexaoId: '',
        key: this.key,
        chats: [],
        qr: '',
        messages: [],
        qrRetry: 0,
        customWebhook: '',
    }

    axiosInstance = axios.create({
        baseURL: config.webhookUrl,
    })

    constructor(key) {
        this.key = key ? key : uuidv4()
    }
    async downloadMessageSup(sock, msg, extension, id) {
        // download the message
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
                logger,
                // pass this so that baileys can request a reupload of media
                // that has been deleted
                reuploadRequest: sock?.updateMediaMessage
            }
        )
        // save to file
        const fileName = `${id ? id : msg.key.id}.${extension}`;
        const path = `${process.cwd()}/temp/${fileName}`;
    
        try {
            writeFileSync(path, buffer); // Usa writeFileSync
            await uploadSUp(path, fileName); // Chama a função corrigida de upload
        } catch (err) {
            console.error(err);
        }
    }
    async SendWebhook(type, body, key) {
        if (!this.allowWebhook) return
        this.axiosInstance
            .post('', {
                type,
                body,
                instanceKey: key,
            })
            .catch(() => {})
    }

    async init() {
        this.collection = mongoClient.db('whatsapp-api').collection(this.key)
        const { state, saveCreds } = await useMongoDBAuthState(this.collection)
        this.authState = { state: state, saveCreds: saveCreds }
        this.socketConfig.auth = this.authState.state
        this.socketConfig.browser = Object.values(config.browser)
        this.instance.sock = makeWASocket(this.socketConfig)
        this.instance.conexaoId = this.clientId
        
        this.setHandler()
        return this
    }

    setHandler() {
        const sock = this.instance.sock
        // on credentials update save state
        sock?.ev.on('creds.update', this.authState.saveCreds)

        // on socket closed, opened, connecting
        sock?.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update
            if (connection === 'close') {
                // reconnect if not logged out
                if (
                    lastDisconnect?.error?.output?.statusCode !==
                    DisconnectReason.loggedOut
                ) {
                    await this.init()
                } else {
                    await this.collection.drop().then((r) => {
                        logger.info('STATE: Droped collection')
                    })
                    this.instance.online = false
                    this.status = 'desconectado'
                }
            } else if (connection === 'open') {
                if (config.mongoose.enabled) {
                    let alreadyThere = await Chat.findOne({
                        key: this.key,
                    }).exec()
                    if (!alreadyThere) {
                        const saveChat = new Chat({ key: this.key })
                        await saveChat.save()
                    }
                }
                this.instance.online = true
                this.status = 'pronto'
            }

            if (qr) {
                
                QRCode.toDataURL(qr).then((url) => {
                    this.instance.qr = url
                    this.status = 'qr'
                    this.instance.qrRetry++
                })
            }
        })

        // sending presence
        sock?.ev.on('presence.update', async (json) => {
        })

        // on receive all chats
        sock?.ev.on('chats.set', async ({ chats }) => {

            this.instance.chats = []
            const recivedChats = chats.map((chat) => {
                return {
                    ...chat,
                    messages: [],
                }
            })
            this.instance.chats.push(...recivedChats)
            await this.updateDb(this.instance.chats)
            await this.updateDbGroupsParticipants()
        })

        // on recive new chat
        sock?.ev.on('chats.upsert', (newChat) => {

            const chats = newChat.map((chat) => {
                return {
                    ...chat,
                    messages: [],
                }
            })
            this.instance.chats.push(...chats)
        })

        // on chat change
        sock?.ev.on('chats.update', (changedChat) => {
            changedChat.map((chat) => {
                const index = this.instance.chats.findIndex(
                    (pc) => pc.id === chat.id
                )
                const PrevChat = this.instance.chats[index]
                this.instance.chats[index] = {
                    ...PrevChat,
                    ...chat,
                }
            })
        })

        // on chat delete
        sock?.ev.on('chats.delete', (deletedChats) => {
            deletedChats.map((chat) => {
                const index = this.instance.chats.findIndex(
                    (c) => c.id === chat
                )
                this.instance.chats.splice(index, 1)
            })
        })

        // on new mssage
        sock?.ev.on('messages.upsert', async (m) => {
            if (m.type === 'prepend'){
                //Sei la
            }
            this.instance.messages.unshift(...m.messages)
            if (m.type !== 'notify') return
            for(const message of m.messages) {
                try{
                    // oie
                }catch(err){
                    // process.exit()
                }
               
            }
        })

        sock?.ev.on('messages.update', async (messages) => {
        })
  

        sock?.ev.on('groups.upsert', async (newChat) => {
            this.createGroupByApp(newChat)
            if (
                ['all', 'groups', 'groups.upsert'].some((e) =>
                    config.webhookAllowedEvents.includes(e)
                )
            )
                await this.SendWebhook(
                    'group_created',
                    {
                        data: newChat,
                    },
                    this.key
                )
        })

        sock?.ev.on('groups.update', async (newChat) => {

            this.updateGroupSubjectByApp(newChat)
            if (
                ['all', 'groups', 'groups.update'].some((e) =>
                    config.webhookAllowedEvents.includes(e)
                )
            )
                await this.SendWebhook(
                    'group_updated',
                    {
                        data: newChat,
                    },
                    this.key
                )
        })

        sock?.ev.on('group-participants.update', async (newChat) => {
            this.updateGroupParticipantsByApp(newChat)
            if (
                [
                    'all',
                    'groups',
                    'group_participants',
                    'group-participants.update',
                ].some((e) => config.webhookAllowedEvents.includes(e))
            )
                await this.SendWebhook(
                    'group_participants_updated',
                    {
                        data: newChat,
                    },
                    this.key
                )
        })

    }

    async deleteInstance(key) {
        try {
            await Chat.findOneAndDelete({ key: key })

        } catch (e) {
            logger.error('Error updating document failed')
        }
    }

    async getInstanceDetail(key) {
        return {
            instance_key: key,
            phone_connected: this.instance?.online,
            webhookUrl: this.instance.customWebhook,
            user: this.instance?.online ? this.instance.sock?.user : {},
        }
    }

    getWhatsAppId(id) {
        if (id.includes('@g.us') || id.includes('@s.whatsapp.net')){
            return id
        } 
        return id.includes('-') ? id+'@g.us' : id+'@s.whatsapp.net'
    }

    async verifyId(id) {
        if (id.includes('@g.us')) return true
        const [result] = await this.instance.sock?.onWhatsApp(id)
        if (result?.exists) return true
        throw new Error('no account exists')
    }

    async sendTextMessage(to, message) {
        await this.verifyId(this.getWhatsAppId(to))
        const data = await this.instance.sock?.sendMessage(
            this.getWhatsAppId(to),
            { text: message }
        )
        return data
    }

    async deleteMessage(to, data) {
        const wid = this.getWhatsAppId(to)
        await this.verifyId(wid)
        const deletedMessage = await this.instance.sock?.sendMessage(
            wid, {delete: data.key}
        )
        return deletedMessage
    }

    async getGroups() {
        const data = await this.instance.sock?.groupFetchAllParticipating()
        return data
    }

    async sendMessageGroup(group, message) {
        const groups = await this.getGroups()

        let resultado = null

        for(let chave in groups) {
            if (groups[chave].subject === group) {
                resultado = {
                    name: groups[chave].subject,
                    jid: chave
                }
                break;
            }
        }

        const {jid} = resultado

        this.instance.sock?.sendMessage(jid, { text: message })
        
        return 'Mensagem sendo enviada'

    }

    async replyMessage(to, message, content) {
        const jid = this.getWhatsAppId(to)
        await this.verifyId(jid)

        const data = await this.instance.sock?.sendMessage(
            jid,
            { text: content },
            { quoted: message }
        )
        return data
    }

    async audioUrlToFile(to, url) {
        await this.verifyId(this.getWhatsAppId(to))

        const fileName = new Date().toISOString()
        const inputPath = path.join(__dirname, `${fileName}.mp3`)
        //const outputPath = path.join(__dirname, `${fileName}.mp3`)
        
        await this.downloadFile(url, inputPath)
        //await this.convertOpusToMp3(inputPath, outputPath)

        const buffer = fs.readFileSync(inputPath)
        const mimetype = mime.lookup(inputPath)

        const data = await this.instance.sock?.sendMessage(this.getWhatsAppId(to),{
            mimetype,
            audio: buffer,
            ptt: true,
            fileName
        })

        fs.unlinkSync(inputPath)
        return data
        //newUrl = `https://fntyzzstyetnbvrpqfre.supabase.co/storage/v1/object/public/chat/arquivos/${fileName}.mp3`
    }

    async sendMediaFile(to, file, type, caption = '', filename) {
        await this.verifyId(this.getWhatsAppId(to))
        const data = await this.instance.sock?.sendMessage(
            this.getWhatsAppId(to),
            {
                mimetype: file.mimetype,
                [type]: file.buffer,
                caption: caption,
                ptt: type === 'audio' ? true : false,
                fileName: filename ? filename : file.originalname,
            }
        )
        return data
    }

    async downloadFile(fileUrl, outputPath) {
        const writer = fs.createWriteStream(outputPath)

        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream'
        })

        response.data.pipe(writer)

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve)
            writer.on('error', reject)
        })
    }

    async convertOpusToMp3(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
            .toFormat('mp3')
            .on('error', (err) => {
                console.error('An error occurred: ' + err.message)
                reject()
            })
            .on('progress', (progress) => {
            })
            .on('end', () => {
                resolve()
            })
            .save(outputPath)
        })
        
    }

    async sendUrlMediaFile(to, url, type, mimeType, caption = '') {
        await this.verifyId(this.getWhatsAppId(to))


        let newUrl = url

        if(type === 'audio') {
            const fileName = new Date().toISOString()
            const inputPath = path.join(__dirname, `${fileName}.opus`)
            const outputPath = path.join(__dirname, `${fileName}.mp3`)
            
            await this.downloadFile(url, inputPath)
            await this.convertOpusToMp3(inputPath, outputPath)
            await uploadSUp(outputPath, `${fileName}.mp3`)
            fs.unlinkSync(inputPath)
            newUrl = `https://fntyzzstyetnbvrpqfre.supabase.co/storage/v1/object/public/chat/arquivos/${fileName}.mp3`
        }

        const data = await this.instance.sock?.sendMessage(
            this.getWhatsAppId(to),
            {
                [type]: {
                    url: newUrl,
                },
                caption: caption,
                mimetype: mimeType,
            }
        )
        return data
    }

    async DownloadProfile(of) {
        await this.verifyId(this.getWhatsAppId(of))
        const ppUrl = await this.instance.sock?.profilePictureUrl(
            this.getWhatsAppId(of),
            'image'
        )
        return ppUrl
    }

    async getUserStatus(of) {
        await this.verifyId(this.getWhatsAppId(of))
        const status = await this.instance.sock?.fetchStatus(
            this.getWhatsAppId(of)
        )
        return status
    }

    async blockUnblock(to, data) {
        await this.verifyId(this.getWhatsAppId(to))
        const status = await this.instance.sock?.updateBlockStatus(
            this.getWhatsAppId(to),
            data
        )
        return status
    }

    async sendButtonMessage(to, data) {
        await this.verifyId(this.getWhatsAppId(to))
        const result = await this.instance.sock?.sendMessage(
            this.getWhatsAppId(to),
            {
                templateButtons: processButton(data.buttons),
                text: data.text ?? '',
                footer: data.footerText ?? '',
                viewOnce: true,
            }
        )
        return result
    }

    async sendContactMessage(to, data) {
        await this.verifyId(this.getWhatsAppId(to))
        const vcard = generateVC(data)
        const result = await this.instance.sock?.sendMessage(
            await this.getWhatsAppId(to),
            {
                contacts: {
                    displayName: data.fullName,
                    contacts: [{ displayName: data.fullName, vcard }],
                },
            }
        )
        return result
    }

    async sendListMessage(to, data) {
        await this.verifyId(this.getWhatsAppId(to))
        const result = await this.instance.sock?.sendMessage(
            this.getWhatsAppId(to),
            {
                text: data.text,
                sections: data.sections,
                buttonText: data.buttonText,
                footer: data.description,
                title: data.title,
                viewOnce: true,
            }
        )
        return result
    }

    async sendMediaButtonMessage(to, data) {
        await this.verifyId(this.getWhatsAppId(to))

        const result = await this.instance.sock?.sendMessage(
            this.getWhatsAppId(to),
            {
                [data.mediaType]: {
                    url: data.image,
                },
                footer: data.footerText ?? '',
                caption: data.text,
                templateButtons: processButton(data.buttons),
                mimetype: data.mimeType,
                viewOnce: true,
            }
        )
        return result
    }

    async setStatus(status, to) {
        await this.verifyId(this.getWhatsAppId(to))

        const result = await this.instance.sock?.sendPresenceUpdate(status, to)
        return result
    }

    // change your display picture or a group's
    async updateProfilePicture(id, url) {
        try {
            const img = await axios.get(url, { responseType: 'arraybuffer' })
            const res = await this.instance.sock?.updateProfilePicture(
                id,
                img.data
            )
            return res
        } catch (e) {
            //console.log(e)
            return {
                error: true,
                message: 'Unable to update profile picture',
            }
        }
    }

    // get user or group object from db by id
    async getUserOrGroupById(id) {
        try {
            let Chats = await this.getChat()
            const group = Chats.find((c) => c.id === this.getWhatsAppId(id))
            if (!group)
                throw new Error(
                    'unable to get group, check if the group exists'
                )
            return group
        } catch (e) {
            logger.error(e)
            logger.error('Error get group failed')
        }
    }

    // Group Methods
    parseParticipants(users) {
        return users.map((users) => this.getWhatsAppId(users))
    }

    async updateDbGroupsParticipants() {
        try {
            let groups = await this.groupFetchAllParticipating()
            let Chats = await this.getChat()
            if (groups && Chats) {
                for (const [key, value] of Object.entries(groups)) {
                    let group = Chats.find((c) => c.id === value.id)
                    if (group) {
                        let participants = []
                        for (const [
                            key_participant,
                            participant,
                        ] of Object.entries(value.participants)) {
                            participants.push(participant)
                        }
                        group.participant = participants
                        if (value.creation) {
                            group.creation = value.creation
                        }
                        if (value.subjectOwner) {
                            group.subjectOwner = value.subjectOwner
                        }
                        Chats.filter((c) => c.id === value.id)[0] = group
                    }
                }
                await this.updateDb(Chats)
            }
        } catch (e) {
            logger.error(e)
            logger.error('Error updating groups failed')
        }
    }

    async createNewGroup(name, users) {
        try {
            const group = await this.instance.sock?.groupCreate(
                name,
                users.map(this.getWhatsAppId)
            )
            return group
        } catch (e) {
            logger.error(e)
            logger.error('Error create new group failed')
        }
    }

    async addNewParticipant(id, users) {
        try {
            const res = await this.instance.sock?.groupAdd(
                this.getWhatsAppId(id),
                this.parseParticipants(users)
            )
            return res
        } catch {
            return {
                error: true,
                message:
                    'Unable to add participant, you must be an admin in this group',
            }
        }
    }

    async makeAdmin(id, users) {
        try {
            const res = await this.instance.sock?.groupMakeAdmin(
                this.getWhatsAppId(id),
                this.parseParticipants(users)
            )
            return res
        } catch {
            return {
                error: true,
                message:
                    'unable to promote some participants, check if you are admin in group or participants exists',
            }
        }
    }

    async demoteAdmin(id, users) {
        try {
            const res = await this.instance.sock?.groupDemoteAdmin(
                this.getWhatsAppId(id),
                this.parseParticipants(users)
            )
            return res
        } catch {
            return {
                error: true,
                message:
                    'unable to demote some participants, check if you are admin in group or participants exists',
            }
        }
    }

    async getAllGroups() {
        let Chats = await this.getChat()
        return Chats.filter((c) => c.id.includes('@g.us')).map((data, i) => {
            return {
                index: i,
                name: data.name,
                jid: data.id,
                participant: data.participant,
                creation: data.creation,
                subjectOwner: data.subjectOwner,
            }
        })
    }

    async leaveGroup(id) {
        try {
            let Chats = await this.getChat()
            const group = Chats.find((c) => c.id === id)
            if (!group) throw new Error('no group exists')
            return await this.instance.sock?.groupLeave(id)
        } catch (e) {
            logger.error(e)
            logger.error('Error leave group failed')
        }
    }

    async getInviteCodeGroup(id) {
        try {
            let Chats = await this.getChat()
            const group = Chats.find((c) => c.id === id)
            if (!group)
                throw new Error(
                    'unable to get invite code, check if the group exists'
                )
            return await this.instance.sock?.groupInviteCode(id)
        } catch (e) {
            logger.error(e)
            logger.error('Error get invite group failed')
        }
    }

    async getInstanceInviteCodeGroup(id) {
        try {
            return await this.instance.sock?.groupInviteCode(id)
        } catch (e) {
            logger.error(e)
            logger.error('Error get invite group failed')
        }
    }

    // get Chat object from db
    async getChat(key = this.key) {
        let dbResult = await Chat.findOne({ key: key }).exec()
        let ChatObj = dbResult.chat
        return ChatObj
    }

    // create new group by application
    async createGroupByApp(newChat) {
        try {
            let Chats = await this.getChat()
            let group = {
                id: newChat[0].id,
                name: newChat[0].subject,
                participant: newChat[0].participants,
                messages: [],
                creation: newChat[0].creation,
                subjectOwner: newChat[0].subjectOwner,
            }
            Chats.push(group)
            await this.updateDb(Chats)
        } catch (e) {
            logger.error(e)
            logger.error('Error updating document failed')
        }
    }

    async updateGroupSubjectByApp(newChat) {
        //console.log(newChat)
        try {
            if (newChat[0] && newChat[0].subject) {
                let Chats = await this.getChat()
                Chats.find((c) => c.id === newChat[0].id).name =
                    newChat[0].subject
                await this.updateDb(Chats)
            }
        } catch (e) {
            logger.error(e)
            logger.error('Error updating document failed')
        }
    }

    async updateGroupParticipantsByApp(newChat) {
        //console.log(newChat)
        try {
            if (newChat && newChat.id) {
                let Chats = await this.getChat()
                let chat = Chats.find((c) => c.id === newChat.id)
                let is_owner = false
                if (chat) {
                    if (chat.participant == undefined) {
                        chat.participant = []
                    }
                    if (chat.participant && newChat.action == 'add') {
                        for (const participant of newChat.participants) {
                            chat.participant.push({
                                id: participant,
                                admin: null,
                            })
                        }
                    }
                    if (chat.participant && newChat.action == 'remove') {
                        for (const participant of newChat.participants) {
                            // remove group if they are owner
                            if (chat.subjectOwner == participant) {
                                is_owner = true
                            }
                            chat.participant = chat.participant.filter(
                                (p) => p.id != participant
                            )
                        }
                    }
                    if (chat.participant && newChat.action == 'demote') {
                        for (const participant of newChat.participants) {
                            if (
                                chat.participant.filter(
                                    (p) => p.id == participant
                                )[0]
                            ) {
                                chat.participant.filter(
                                    (p) => p.id == participant
                                )[0].admin = null
                            }
                        }
                    }
                    if (chat.participant && newChat.action == 'promote') {
                        for (const participant of newChat.participants) {
                            if (
                                chat.participant.filter(
                                    (p) => p.id == participant
                                )[0]
                            ) {
                                chat.participant.filter(
                                    (p) => p.id == participant
                                )[0].admin = 'superadmin'
                            }
                        }
                    }
                    if (is_owner) {
                        Chats = Chats.filter((c) => c.id !== newChat.id)
                    } else {
                        Chats.filter((c) => c.id === newChat.id)[0] = chat
                    }
                    await this.updateDb(Chats)
                }
            }
        } catch (e) {
            logger.error(e)
            logger.error('Error updating document failed')
        }
    }

    async groupFetchAllParticipating() {
        try {
            const result =
                await this.instance.sock?.groupFetchAllParticipating()
            return result
        } catch (e) {
            logger.error('Error group fetch all participating failed')
        }
    }

    // update promote demote remove
    async groupParticipantsUpdate(id, users, action) {
        try {
            const res = await this.instance.sock?.groupParticipantsUpdate(
                this.getWhatsAppId(id),
                this.parseParticipants(users),
                action
            )
            return res
        } catch (e) {
            //console.log(e)
            return {
                error: true,
                message:
                    'unable to ' +
                    action +
                    ' some participants, check if you are admin in group or participants exists',
            }
        }
    }

    // update group settings like
    // only allow admins to send messages
    async groupSettingUpdate(id, action) {
        try {
            const res = await this.instance.sock?.groupSettingUpdate(
                this.getWhatsAppId(id),
                action
            )
            return res
        } catch (e) {
            //console.log(e)
            return {
                error: true,
                message:
                    'unable to ' + action + ' check if you are admin in group',
            }
        }
    }

    async groupUpdateSubject(id, subject) {
        try {
            const res = await this.instance.sock?.groupUpdateSubject(
                this.getWhatsAppId(id),
                subject
            )
            return res
        } catch (e) {
            //console.log(e)
            return {
                error: true,
                message:
                    'unable to update subject check if you are admin in group',
            }
        }
    }

    async groupUpdateDescription(id, description) {
        try {
            const res = await this.instance.sock?.groupUpdateDescription(
                this.getWhatsAppId(id),
                description
            )
            return res
        } catch (e) {
            //console.log(e)
            return {
                error: true,
                message:
                    'unable to update description check if you are admin in group',
            }
        }
    }

    // update db document -> chat
    async updateDb(object) {
        try {
            await Chat.updateOne({ key: this.key }, { chat: object })
        } catch (e) {
            logger.error('Error updating document failed')
        }
    }

    async readMessage(msgObj) {
        try {
            const key = {
                remoteJid: msgObj.remoteJid,
                id: msgObj.id,
                participant: msgObj?.participant, // required when reading a msg from group
            }
            const res = await this.instance.sock?.readMessages([key])
            return res
        } catch (e) {
            logger.error('Error read message failed')
        }
    }

    async reactMessage(id, key, emoji) {
        try {
            const reactionMessage = {
                react: {
                    text: emoji, // use an empty string to remove the reaction
                    key: key,
                },
            }
            const res = await this.instance.sock?.sendMessage(
                this.getWhatsAppId(id),
                reactionMessage
            )
            return res
        } catch (e) {
            logger.error('Error react message failed')
        }
    }

    async workWithMessageType(messageType, sock, msg, id_api, fileUrl, bucketUrl) {
        switch(messageType) {
            case 'imageMessage':
                await this.downloadMessageSup(sock, msg, 'jpeg');
    
                fileUrl = `${bucketUrl}/${msg.key.id}.jpeg`
                msg.message['imageMessage']['url'] = fileUrl
                
                break; 
            case 'videoMessage':
                await this.downloadMessageSup(sock, msg, 'mp4');
                
                fileUrl = `${bucketUrl}/${msg.key.id}.mp4`
                msg.message['videoMessage']['url'] = fileUrl
                
                break;
            case 'audioMessage':
                    await this.downloadMessageSup(sock, msg, 'mp3');
                    
                    fileUrl = `${bucketUrl}/${msg.key.id}.mp3`
                    msg.message['audioMessage']['url'] = fileUrl
                    
                    break;
            case 'documentMessage':
                const format = `${msg.message['documentMessage']['mimetype'].split('/')[1]}`
                await this.downloadMessageSup(sock, msg, format)
    
                fileUrl = `${bucketUrl}/${msg.key.id}.${format}`
                msg.message['documentMessage']['url'] = fileUrl
    
                break
            case 'extendedTextMessage':
                break
            case 'messageContextInfo':
                if(msg.message.documentWithCaptionMessage){
                const format2 = `${msg.message.documentWithCaptionMessage.message['documentMessage']['mimetype'].split('/')[1]}`
                await this.downloadMessageSup(sock, msg.message.documentWithCaptionMessage, format2, msg.key.id)
                fileUrl = `${bucketUrl}/${msg.key.id}.${format2}`
                msg.message.documentMessage = {
                    url: fileUrl,
                    caption: msg.message.documentWithCaptionMessage.message['documentMessage'].caption
                }
                }
                
                break
            
        }
        msg.key['conversaId'] = id_api
    }
}



exports.WhatsAppInstance = WhatsAppInstance

