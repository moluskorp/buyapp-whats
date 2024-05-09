const dotenv = require('dotenv')
const mongoose = require('mongoose')
const logger = require('pino')()
dotenv.config()

const app = require('./config/express')
const config = require('./config/config')
const initDBStats = require('./api/db/db')

const { Session } = require('./api/class/session')
const connectToCluster = require('./api/helper/connectMongoClient')
const { getConversasWhereBot, getSingleBot } = require('./api/helper/sendSupabase')

if (config.mongoose.enabled) {
    mongoose.set('strictQuery', true);
    mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
        // logger.info('Connected to MongoDB')
    })
}

initDBStats()

const server = app.listen(config.port, async () => {
    console.log('Listening on port: ', config.port)
    global.mongoClient = await connectToCluster(config.mongoose.url)
    if (config.restoreSessionsOnStartup) {
        const session = new Session()
        let restoreSessions = await session.restoreSessions()
        logger.info(`${restoreSessions.length} Session(s) Restored`)
    }
})

const exitHandler = () => {
    if (server) {
        server.close(() => {
            process.exit(1)
        })
    } else {
        process.exit(1)
    }
}

setInterval( async () => {
    console.log('Rodando Interval')
    const conversas = await getConversasWhereBot()
    if(conversas) {
        for (const conversa of conversas) {
            console.log({conversa})
            const {horario_ultima_mensagem} = conversa
            const horarioUltimaMensagem = new Date(horario_ultima_mensagem)
            const horarioAtual = new Date()
            const bot = await getSingleBot(conversa.ref_empresa)
            const {tempo_transferencia} = bot
            const tempoTransferenciaMs = tempo_transferencia * 60 * 1000

            const horarioMaisTempoTransferencia = new Date(horarioUltimaMensagem.getTime() + tempoTransferenciaMs)

            if(horarioAtual >= horarioMaisTempoTransferencia) {
                console.log('Deu o tempo do: ', conversa.nome_contato)
            }
        }
    }
}, 1000 * 60)

const unexpectedErrorHandler = (error) => {
    logger.error(error)
    exitHandler()
}

process.on('uncaughtException', unexpectedErrorHandler)
process.on('unhandledRejection', unexpectedErrorHandler)

process.on('SIGTERM', () => {
    if (server) {
        server.close()
    }
})

module.exports = server
