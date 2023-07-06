const express = require('express')
const keyVerify = require('../middlewares/keyCheck')
const loginVerify = require('../middlewares/loginCheck')

const router = express.Router()

router.get('/getstats', keyVerify, loginVerify, (req, res) => {
    const userKey = req.query.key; 

    db.all('SELECT endpoint, upload_count, received_count FROM user_stats WHERE user_key = ?', [userKey], function(err, rows) {
        if (err) {
            console.error(err);
            res.status(500).send('Ocorreu um erro ao buscar as estatísticas.');
            return;
        }

        const stats = {
            sent: {},
            received: {}
        };
        for (let row of rows) {
            stats.sent[row.endpoint] = row.upload_count;
            stats.received[row.endpoint] = row.received_count;
        }

        res.json(stats);
    });
});
