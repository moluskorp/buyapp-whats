const logger = require('pino')()
const saveStats = require('../helper/saveStats');

function trackStats(req, res, next) {
    const userKey = req.query.key; 
    const endpoint = req.path.substring(1); 

    logger.info(req.path)
    logger.info(`Endpoint: ${endpoint}`)

    saveStats(userKey, endpoint, 'sent')  
        .then(() => {
            next();  
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Ocorreu um erro ao rastrear as estatísticas.');
        });
}

module.exports = trackStats;