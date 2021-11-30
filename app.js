const { Client } = require('whatsapp-web.js');
const express = require('express');
const {body, validationResult} = require('express-validator');
const socketIo = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');

const port = process.env.PORT || 8000;
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.urlencoded(({extended: true})));

const SESSION_FILE_PATH = './whatsapp_session.json';
let sessionCfg;
if (fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: __dirname});
});
// Jika headless : false maka membuka browser jika false maka lewat terminal
const client = new Client({ 
    puppeteer: { 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-sandbox',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }, 
    session: sessionCfg 
});

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

client.initialize();

// Socket IO
io.on('connection', function(socket){
    socket.emit('message', 'Connecting...');

    client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit('qr', url);
            socket.emit('message', 'QR Code Received, Scan Please...');
        });
    });

    client.on('ready', () => {
        socket.emit('ready', 'Whatsapp is ready');
        socket.emit('message', 'Whatsapp is ready');
    });

    client.on('authenticated', (session) => {
        socket.emit('authenticated', 'Whatsapp is authenticated');
        socket.emit('message', 'Whatsapp is authenticated');

        console.log('AUTHENTICATED', session);
        sessionCfg=session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
            if (err) {
                console.error(err);
            }
        });
    });
});

const checkRegisteredNumber = async function(number){
    const isRegistered = await client.isRegisteredUser(number);
    return isRegistered;
}
// Send Message
app.post('/send-message', [
    body('number').notEmpty(),
    body('message').notEmpty()
], async (req, res) => {
    const errors = validationResult(req).formatWith(({msg}) => {
        return msg;
    });

    if (!errors.isEmpty()) {
        return res.status(422).json({
            status: false,
            message: errors.mapped()
        })
    }
    const number = phoneNumberFormatter(req.body.number);
    const message = req.body.message;
    const isRegisteredNumber = await checkRegisteredNumber(number);
    if (!isRegisteredNumber) {
        return res.status(422).json({
            status: false,
            message: 'The Number is not registered!'
        });
    }
    client.sendMessage(number, message).then(response => {
        res.status(200).json({
            status: true,
            response: response
        })
    }).catch(err => {
        res.status(500).json({
            status: false,
            response: err
        });
    })
});

server.listen(port, function(){
    console.log('App Running on *: ' + port);
});