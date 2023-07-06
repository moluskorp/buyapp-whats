const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./user_stats.db');

module.exports = function saveStats(key, endpoint, messageType) {
    return new Promise((resolve, reject) => {
        const userKey = key;
        const column = messageType === 'sent' ? 'upload_count' : 'received_count';

        db.get(`SELECT ${column} FROM user_stats WHERE user_key = ? AND endpoint = ?`, [userKey, endpoint], function(err, row) {
            if (err) {
                console.error(err);
                reject(new Error('Ocorreu um erro ao rastrear as estatísticas.'));
                return;
            }
            if (row) {
                // Se a linha existir, incrementa a contagem
                db.run(`UPDATE user_stats SET ${column} = ${column} + 1 WHERE user_key = ? AND endpoint = ?`, [userKey, endpoint], function(err) {
                    if (err) {
                        console.error(err);
                        reject(new Error('Ocorreu um erro ao rastrear as estatísticas.'));
                        return;
                    }
                    resolve();
                });
            } else {
                // Se a linha não existir, insere uma nova linha com contagem = 1
                db.run(`INSERT INTO user_stats(user_key, endpoint, ${column}) VALUES(?, ?, 1)`, [userKey, endpoint], function(err) {
                    if (err) {
                        console.error(err);
                        reject(new Error('Ocorreu um erro ao rastrear as estatísticas.'));
                        return;
                    }
                    resolve();
                });
            }
        });
    });
}

