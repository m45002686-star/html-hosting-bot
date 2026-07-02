const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        // markOnlineOnConnect: false
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ Bot connected successfully!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && msg.message) {
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const from = msg.key.remoteJid;

            console.log(`Received message: ${text} from ${from}`);

            if (text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello') {
                await sock.sendMessage(from, { text: 'Hello! I am your WhatsApp Bot 🤖 How can I help you?' });
            } else if (text.toLowerCase() === 'ping') {
                await sock.sendMessage(from, { text: 'Pong! 🏓' });
            } else {
                await sock.sendMessage(from, { text: `You said: ${text}` });
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startBot().catch(console.error);

console.log('Bot is starting...');
