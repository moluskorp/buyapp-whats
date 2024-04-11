exports.Text = async (req, res) => {
    const data = await WhatsAppInstances[req.query.key].sendTextMessage(
        req.body.id,
        req.body.message
    )
    return res.status(201).json({ error: false, data: data })
}

exports.DeleteMesage = async (req, res) => {
    const data = await WhatsAppInstances[req.query.key].deleteMesage(
        req.body.id,
        req.body.data
    )
    return res.status(201).json({error: false, data})
}

exports.Reply = async (req, res) => {
    const data = await await WhatsAppInstances[req.query.key].replyMessage(
        req.body.id,
        req.body.message,
        req.body.content,
    )
    return res.status(201).json({error: false, data: data })
}

exports.Image = async (req, res) => {
    const data = await WhatsAppInstances[req.query.key].sendMediaFile(
        req.body.id,
        req.file,
        'image',
        req.body?.caption
    )
    return res.status(201).json({ error: false, data: data })
}

exports.Video = async (req, res) => {
    const videoFile = req.file
    const caption = req.body.caption || ''

    if(!videoFile) {
        return res.status(400).json({error: true, message: 'Nenhum arquivo de vídeo enviado'})
    }

    try {
        const data = await WhatsAppInstances[req.query.key].sendMediaFile(
            req.body.id,
            videoFile,
            'video',
            caption
        )

        return res.status(201).json({ error: false, data: data })
    }
    catch(error) {
        console.error('Erro ao enviar arquivo de vídeo', error)
        return res.status(500).json({error: true, message: 'Erro ao enviar arquivo de vídeo'})
    }    
}

exports.Audio = async (req, res) => {
    const data = await WhatsAppInstances[req.query.key].sendMediaFile(
        req.body.id,
        req.file,
        'audio'
    )
    return res.status(201).json({ error: false, data: data })
}

exports.Document = async (req, res) => {
    const data = await WhatsAppInstances[req.query.key].sendMediaFile(
        req.body.id,
        req.file,
        'document',
        '',
        req.body.filename
    )
    return res.status(201).json({ error: false, data: data })
}

exports.Mediaurl = async (req, res) => {
    const data = await WhatsAppInstances[req.query.key].sendUrlMediaFile(
        req.body.id,
        req.body.url,
        req.body.type, // Types are [image, video, audio, document]
        req.body.mimetype, // mimeType of mediaFile / Check Common mimetypes in `https://mzl.la/3si3and`
        req.body.caption
    )
    return res.status(201).json({ error: false, data: data })
}

exports.Audiourl = async (req, res) => {
    const data = await WhatsAppInstances[req.query.key].audioUrlToFile(req.body.id, req.body.url)

    return res.status(201).json({error: false, data})
}

exports.Button = async (req, res) => {
    // console.log(res.body)
    const data = await WhatsAppInstances[req.query.key].sendButtonMessage(
        req.body.id,
        req.body.btndata
    )
    return res.status(201).json({ error: false, data: data })
}

exports.Contact = async (req, res) => {
    const vCard = {
        fullName: req.body.fullName,
        organization: req.body.organization,
        phoneNumber: req.body.phoneNumber
    }

    const data = await WhatsAppInstances[req.query.key].sendContactMessage(
        req.body.id,
        vCard
    )
    return res.status(201).json({ error: false, data: data })
}

exports.List = async (req, res) => {
    const data = await WhatsAppInstances[req.query.key].sendListMessage(
        req.body.id,
        req.body.msgdata
    )
    return res.status(201).json({ error: false, data: data })
}

exports.MediaButton = async (req, res) => {
    const data = await WhatsAppInstances[req.query.key].sendMediaButtonMessage(
        req.body.id,
        req.body.btndata
    )
    return res.status(201).json({ error: false, data: data })
}

exports.SetStatus = async (req, res) => {
    const presenceList = [
        'unavailable',
        'available',
        'composing',
        'recording',
        'paused',
    ]
    if (presenceList.indexOf(req.body.status) === -1) {
        return res.status(400).json({
            error: true,
            message:
                'status parameter must be one of ' + presenceList.join(', '),
        })
    }

    const data = await WhatsAppInstances[req.query.key]?.setStatus(
        req.body.status,
        req.body.id
    )
    return res.status(201).json({ error: false, data: data })
}

exports.Read = async (req, res) => {
    const data = await WhatsAppInstances[req.query.key].readMessage(req.body.msg)
    return res.status(201).json({ error: false, data: data })
}

exports.React = async (req, res) => {
    const data = await WhatsAppInstances[req.query.key].reactMessage(req.body.id, req.body.key, req.body.emoji)
    return res.status(201).json({ error: false, data: data })
}

