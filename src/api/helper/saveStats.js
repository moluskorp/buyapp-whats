const sqlite3 = require('sqlite3').verbose();
let db = new sqlite3.Database('./user_stats.db');

module.exports = function saveStats(key, messageType, direction) { // 'sent' or 'received'
    return new Promise((resolve, reject) => {
        const userKey = key;
        const tableName = direction === 'sent' ? 'sent_msgs' : 'received_msgs'; 

        db.get(`SELECT ${messageType} FROM ${tableName} WHERE user_key = ?`, [userKey], function(err, row) {
            if (err) {
                console.error(err);
                reject(new Error('Ocorreu um erro ao rastrear as estatísticas.'));
                return;
            }
            if (row) {
                db.run(`UPDATE ${tableName} SET ${messageType} = ${messageType} + 1 WHERE user_key = ?`, [userKey], function(err) {
                    if (err) {
                        console.error(err);
                        reject(new Error('Ocorreu um erro ao rastrear as estatísticas.'));
                        return;
                    }
                    resolve();
                });
            } else {
                const initialValues = {video: 0, text: 0, audio: 0, doc: 0};
                initialValues[messageType] = 1;
                db.run(`INSERT INTO ${tableName}(user_key, video, text, audio, doc) VALUES(?, ?, ?, ?, ?)`,
                    [userKey, initialValues.video, initialValues.text, initialValues.audio, initialValues.doc], function(err) {
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
