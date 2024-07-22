const { WebSocket } = require("ws")
try{
    const ws = new WebSocket("ws://localhost:3333/init/socket")

    ws.on('message', () => {
        console.log('oie')
    })
}catch(e) {
    console.log(e.message)
}

