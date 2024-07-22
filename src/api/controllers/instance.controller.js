const { WhatsAppInstance } = require('../class/instance')
const config = require('../../config/config')
const { Session } = require('../class/session')
const { jidDecode } = require('@whiskeysockets/baileys')
const { WebSocket } = require('ws')

exports.init = async (req, res) => {
    console.log('inicio init')
    const key = req.query.key
    console.log('key', key)
    const appUrl = config.appUrl || req.protocol + '://' + req.headers.host
    const instance = new WhatsAppInstance(key)
    const data = await instance.init()
    WhatsAppInstances[data.key] = instance
    const qr = await WhatsAppInstances[req.query.key]?.instance.qr
    console.log('qr', qr)
    res.json({
        error: false,
        message: 'Initializing successfully',
        key: data.key,
        qrcode: {
            url: appUrl + '/instance/qr?key=' + data.key,
        },
        qr,
        browser: config.browser,
    })
}

exports.socket = async (req, res) => {
    const key = req.query.key
    const url = ''
    const instance = new WhatsAppInstance(key, url)
    const data = await instance.init()
    WhatsAppInstances[data.key] = instance
    const qr = await instance.instance.qr
    const dados = {
        dominio: key,
        qr,
        
    }
    whatsapp_atualizarqr
}

exports.qr = async (req, res) => {
    try {
        const qrcode = await WhatsAppInstances[req.query.key]?.instance.qr
        res.render('qrcode', {
            qrcode: qrcode,
        })
    } catch {
        res.json({
            qrcode: '',
        })
    }
}

exports.qrbase64 = async (req, res) => {
    try {
        const qrcode = await WhatsAppInstances[req.query.key]?.instance.qr
        res.json({
            error: false,
            message: 'QR Base64 fetched successfully',
            qrcode: qrcode,
        })
    } catch {
        res.json({
            qrcode: '',
        })
    }
}

exports.info = async (req, res) => {
    const instance = WhatsAppInstances[req.query.key]
    instance.updateIntanceInfo()
    let data
    let user
    try {
        // console.log({instance: instance.instance.sock})
        data = await instance.getInstanceDetail(req.query.key)
        const {id} = data.user
        const status = await instance.instance.sock.fetchStatus(id)
        user = status
    } catch (error) {
        data = {}
    }
    return res.json({
        error: false,
        message: 'Instance fetched successfully',
        instance_data: {data,user}
    })
}

exports.restore = async (req, res, next) => {
    try {
        const session = new Session()
        let restoredSessions = await session.restoreSessions()
        return res.json({
            error: false,
            message: 'All instances restored',
            data: restoredSessions,
        })
    } catch (error) {
        next(error)
    }
}

exports.logout = async (req, res) => {
    let errormsg
    try {
        await WhatsAppInstances[req.query.key].instance?.sock?.logout()
    } catch (error) {
        errormsg = error
    }
    return res.json({
        error: false,
        message: 'logout successfull',
        errormsg: errormsg ? errormsg : null,
    })
}

exports.delete = async (req, res) => {
    let errormsg
    try {
        await WhatsAppInstances[req.query.key].deleteInstance(req.query.key)
        delete WhatsAppInstances[req.query.key]
        
        // Deletes user stats from 'sent_msgs' and 'received_msgs' tables
        db.run('DELETE FROM sent_msgs WHERE user_key = ?', [req.query.key], function(err) {
            if (err) {
                console.error(err);
                res.status(500).send('An error occurred while deleting the user sent messages statistics.');
                return;
            }
        });

        db.run('DELETE FROM received_msgs WHERE user_key = ?', [req.query.key], function(err) {
            if (err) {
                console.error(err);
                res.status(500).send('An error occurred while deleting the user received messages statistics.');
                return;
            }
        });
        
    } catch (error) {
        errormsg = error
    }
    return res.json({
        error: false,
        message: 'Instance deleted successfully',
        data: errormsg ? errormsg : null,
    })
}

exports.getGroups = async (req, res) => {
    const instance = WhatsAppInstances[req.query.key]
    await instance.getGroups()
}


exports.list = async (req, res) => {
    if (req.query.active) {
        let instance = []
        const db = mongoClient.db('whatsapp-api')
        const result = await db.listCollections().toArray()
        result.forEach((collection) => {
            instance.push(collection.name)
        })

        return res.json({
            error: false,
            message: 'All active instance',
            data: instance,
        })
    }

    let instance = Object.keys(WhatsAppInstances).map(async (key) =>
        WhatsAppInstances[key].getInstanceDetail(key)
    )
    let data = await Promise.all(instance)
    
    return res.json({
        error: false,
        message: 'All instance listed',
        data: data,
    })
}

exports.contactInfo = async(req, res) => {
    const phone = req.query.number
    const instance = WhatsAppInstances[req.query.key]
    const {sock} = instance.instance
    const [result] = await sock.onWhatsApp(phone)
    if(result){
        const {jid} = result
        const {status} = await sock.fetchStatus(jid)
        const imgUrl = await sock.profilePictureUrl(jid)
        const profile = await sock.getBusinessProfile(jid)
        const urlInfo = await jidDecode(
            jid
          )
        return res.json({
            exists: true,
            data: {
                phone,
                id: jid,
                status,
                imgUrl,
                business: profile
            }
        })
    } else {
        return res.json({
            exists: false
        })
    }
}