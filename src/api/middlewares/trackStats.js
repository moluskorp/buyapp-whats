const logger = require('pino')()
const saveStats = require('../helper/saveStats');

function trackStats(req, res, next) {
    const userKey = req.query.key; 
    const messageType = req.path.substring(1); // 'video', 'text', 'audio', 'doc'

    logger.info(req.path)
    logger.info(`MessageType: ${messageType}`)

    saveStats(userKey, messageType, 'sent')
        .then(() => {
            next();  
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Ocorreu um erro ao rastrear as estatísticas.');
        });
}

module.exports = trackStats;
