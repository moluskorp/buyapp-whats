const sqlite3 = require('sqlite3').verbose();

const logger = require('pino')()
// Inicializa o banco de dados

module.exports = function initDBStats()
{

    let db = new sqlite3.Database('./user_stats.db', sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the user_stats SQlite database.');
    
        // Cria a tabela de estatísticas do usuário, se ainda não existir
        // Agora incluindo uma coluna 'received_count'
        db.run(`
            CREATE TABLE IF NOT EXISTS user_stats (
                user_key TEXT,
                endpoint TEXT,
                upload_count INTEGER,
                received_count INTEGER,
                PRIMARY KEY(user_key, endpoint)
            );
        `);
    });
    
}
