const sqlite3 = require('sqlite3').verbose();

const logger = require('pino')()
// Inicializa o banco de dados

module.exports = function initDBStats() {
    let db = new sqlite3.Database('./user_stats.db', sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            console.error(err.message);
        }
        logger.info('Connected to the user_stats SQLite database.');

        // Cria a tabela de mensagens enviadas, se ainda não existir
        db.run(`
            CREATE TABLE IF NOT EXISTS sent_msgs (
                user_key TEXT PRIMARY KEY,
                video INTEGER DEFAULT 0,
                image INTEGER DEFAULT 0,
                text INTEGER DEFAULT 0,
                audio INTEGER DEFAULT 0,
                doc INTEGER DEFAULT 0
            );
        `);

        // Cria a tabela de mensagens recebidas, se ainda não existir
        db.run(`
            CREATE TABLE IF NOT EXISTS received_msgs (
                user_key TEXT PRIMARY KEY,
                video INTEGER DEFAULT 0,
                image INTEGER DEFAULT 0,
                text INTEGER DEFAULT 0,
                audio INTEGER DEFAULT 0,
                doc INTEGER DEFAULT 0
            );
        `);
    });
}
