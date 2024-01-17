const express = require('express')
const path = require('path')
const exceptionHandler = require('express-exception-handler')
const cors = require('cors')

exceptionHandler.handle()

const app = express()

const allowedDomains = ['https://app.chatfire.com.br', 'https://fntyzzstyetnbvrpqfre.supabase.co/functions/v1/bot'];


app.use(cors({
	    origin: function (origin, callback) {
		            if (!origin) return callback(null, true);

		            if (allowedDomains.indexOf(origin) === -1) {
				                var msg = 'A política de CORS para este site não permite acesso a partir do domínio especificado.';
				                return callback(new Error(msg), false);
				            }
		            return callback(null, true);
		        }
}));


const error = require('../api/middlewares/error')
const tokenCheck = require('../api/middlewares/tokenCheck')
const { protectRoutes } = require('./config')

app.use(express.json())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, '../api/views'))
global.WhatsAppInstances = {}

const routes = require('../api/routes/')
if (protectRoutes) {
    app.use(tokenCheck)
}
app.use('/', routes)
app.use(error.handler)

module.exports = app
