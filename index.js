
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const pino = require('pino');

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['TagAll Bot', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  const phoneNumber = (process.env.PHONE_NUMBER || '')
    .replace(/\D/g, '');

  if (!state.creds.registered && phoneNumber) {
    const code = await sock.requestPairingCode(phoneNumber);
    console.log('WhatsApp pairing code:', code);
    console.log(
      'WhatsApp > Linked devices > Link a device > Link with phone number instead'
    );
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('WhatsApp Bot Connected Successfully!');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;

      if (code !== DisconnectReason.loggedOut) {
        setTimeout(() => startBot().catch(console.error), 3000);
      } else {
        console.log('WhatsApp logged out. Login again.');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];

    if (
      !msg?.message ||
      msg.key.fromMe ||
      !msg.key.remoteJid?.endsWith('@g.us')
    ) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    if (text.trim().toLowerCase() === '/all') {
      const group = msg.key.remoteJid;
      const metadata = await sock.groupMetadata(group);
      const participants = metadata.participants.map(p => p.id);

      await sock.sendMessage(group, {
        text: participants
          .map(jid => '@' + jid.split('@')[0])
          .join(' '),
        mentions: participants
      });
    }
  });
}

startBot().catch(console.error);
