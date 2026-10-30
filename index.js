const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const qrcode = require('qrcode-terminal');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['TagAll Bot', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('Scan this QR code with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('WhatsApp Bot Connected Successfully!');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code !== DisconnectReason.loggedOut) {
        startBot();
      } else {
        console.log('WhatsApp logged out. Login again.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];

    if (!msg.message || msg.key.fromMe || !msg.key.remoteJid?.endsWith('@g.us')) {
      return;
    }

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (text.trim().toLowerCase() === '/all') {
      const group = msg.key.remoteJid;
      const metadata = await sock.groupMetadata(group);
      const participants = metadata.participants.map(p => p.id);

      const mentions = participants;
      const message = participants
        .map(jid => '@' + jid.split('@')[0])
        .join(' ');

      await sock.sendMessage(group, {
        text: message,
        mentions
      });
    }
  });
}

startBot().catch(console.error);
