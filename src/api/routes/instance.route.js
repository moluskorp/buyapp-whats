const express = require('express')
const controller = require('../controllers/instance.controller')
const keyVerify = require('../middlewares/keyCheck')
const loginVerify = require('../middlewares/loginCheck')

const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./user_stats.db');

const router = express.Router()

router.route('/init').get(controller.init)
router.route('/qr').get(keyVerify, controller.qr)
router.route('/qrbase64').get(keyVerify, controller.qrbase64)
router.route('/info').get(keyVerify, controller.info)
router.route('/restore').get(controller.restore)
router.route('/logout').delete(keyVerify, loginVerify, controller.logout)
router.route('/delete').delete(keyVerify, controller.delete)
router.route('/list').get(controller.list)

router.get('/getstats', keyVerify, loginVerify, (req, res) => {
    const userKey = req.query.key; 

    // Consulta para buscar estatísticas de mensagens enviadas
    db.get('SELECT text, image, audio, video, doc FROM sent_msgs WHERE user_key = ?', [userKey], function(err, row) {
        if (err) {
            console.error(err);
            res.status(500).send('Ocorreu um erro ao buscar as estatísticas.');
            return;
        }

        // Inicializa todas as estatísticas enviadas com 0
        const stats = {
            sent: {
                text: 0,
                image: 0,
                audio: 0,
                video: 0,
                doc: 0
            },
            received: {
                text: 0,
                image: 0,
                audio: 0,
                video: 0,
                doc: 0
            }
        };

        // Atualiza as estatísticas enviadas com os valores do banco de dados
        if (row) {
            stats.sent = row;
        }

        // Consulta para buscar estatísticas de mensagens recebidas
        db.get('SELECT text, image, audio, video, doc FROM received_msgs WHERE user_key = ?', [userKey], function(err, row) {
            if (err) {
                console.error(err);
                res.status(500).send('Ocorreu um erro ao buscar as estatísticas.');
                return;
            }

            // Atualiza as estatísticas recebidas com os valores do banco de dados
            if (row) {
                stats.received = row;
            }

            res.json(stats);
        });
    });
});



module.exports = router