const { createClient } = require('@supabase/supabase-js');
const { unlinkSync, readFileSync } = require('fs');

// Create a single supabase client for interacting with your database

const supabase = createClient( 'https://fntyzzstyetnbvrpqfre.supabase.co', 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZudHl6enN0eWV0bmJ2cnBxZnJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTExMTM0NzksImV4cCI6MjAwNjY4OTQ3OX0.eaod7DsHG3Pc1ZBFSmvr3r6by-MtNf0hzjgjXzdN3Jk'
); /** * Insert a new record into the specified table * @param {string} tableName 
 - The name of the table to insert the data into. * @param {object} data - The 
 data to insert. */


function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendDataToSupabase(tableName, data) {
	try {  
        const response = await supabase.from(tableName).insert([data]).select()
        if(response.error) {
            console.error('Error inserting data:', response.error);
            return null
        } else {
            return response.data[0]
        }
    } catch (error) {
        console.error('An unexpected error occurred:', error);
    }
}
async function fetchAllDataFromTable(tableName) {
    try {
        const {data, error} = await supabase.from(tableName).select('*');

        if(error) {
            console.error('Error fetching data:', error);
        }else {
            return data
        }
    }catch(error) {
        console.error('An unexpected error occurred:', error);
        return null
    }
}

async function getIdConexoes(tableName, condition) {
    try {
        const {data, error} = await supabase.from(tableName).select('id, id_empresa, Nome').eq('instance_key', condition).single()

        if(error) {
            return null
        } else {
            return data
        }
    } catch(error) {
        console.error('Ocorreu um erro inesperado', error)
        return null
    }
}

async function getSingleConversa(numero, empresaId) {
    try {
        const {data, error} = await supabase.from('conversas').select('*').eq('numero_contato', numero).eq('ref_empresa', empresaId).order('created_at').single()
        if(error) {
            return null
        } else {
            return data
        }
    } catch(error) {
        console.error('Ocorreu um erro inesperado', error)
        return null
    }
}

async function updateDataInTable(tableName, matchCriteria, newData) {
    try {
        const {data, error} = await supabase.from(tableName).update(newData).match(matchCriteria)

        if(error) { 
            console.error('Error updating data:',{tableName, matchCriteria, newData} ,error);
            return null
        } else {
            return data
        }
    } catch(error) {
        console.error('An unexpected error occurred:', error);
        return null
    }
}

async function verifyConversaId(userNumber, key) {
    try {
        const { data, error } = await supabase
            .from('conversas')
            .select('*')
            .eq('numero_contato', userNumber)
            .eq('key_instancia', key)
	    .neq('Status', 'Finalizado')


        if (error) {
            console.error('Erro ao verificar dados', error);
            return false;
        }

        return data;
    } catch (err) {
        console.error('Erro durante a consulta', err);
        return false;
    }
}

async function adicionaRegistro(userNumber, key, idApi, nome) {
    const dadoExiste = await verifyConversaId(userNumber, key);
	//console.log(dadoExiste)
    if (dadoExiste.length == 0) {
        const { data, error } = await supabase
            .from('conversas')
            .insert([{ nome_contato: nome, numero_contato: userNumber, key_instancia: key, id_api: idApi }]);
        
        //console.log('dadoExiste', dadoExiste);
        if (error) {
            //console.error('Erro ao inserir dados em conversas', error);
            return false;
        }

        //console.log('Conversa adicionada com sucesso:', data);
        const resultNew = await verifyConversaId(userNumber, key);
        //console.log('resultNew', resultNew);
        return resultNew;
    } else {
        //console.log('Um registro correspondente já existe.');
        return dadoExiste;
    }
}

async function uploadSUp(filePath, filename) {
    const fileContent = readFileSync(filePath)
    const storagePath = `arquivos/${filename}`;
    
    let { error } = await supabase.storage
    .from('chat')
    .upload(storagePath, fileContent);
    
    if (error) throw error;
    unlinkSync(filePath)

}

async function deleteDataFromtable(tableName, matchCriteria) {
    try {
        const {data, error} = await supabase.from(tableName).delete().match(matchCriteria)

        if (error) {
            console.error('Error deleting data:', error);
            return null;
        } else {
            return data;
        }
    }catch (error) {
        console.error('An unexpected error occurred:', error);
        return null;
    }
}


module.exports = {
    sendDataToSupabase,
    adicionaRegistro,
    fetchAllDataFromTable,
    updateDataInTable,
    uploadSUp,
    deleteDataFromtable,
    getIdConexoes,
    getSingleConversa
};
