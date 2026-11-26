const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const express = require('express');
const cron = require('node-cron');

const app = express();
let qrImage = 'Waiting...';
let clientReady = false;

const GROUP_NAME = 'OSM DRIVERS';
const OSM_NUMBER = '447000000000@c.us'; // <-- CHANGE THIS to OSM's real number, e.g. 447911123456@c.us

const DRIVERS = [
  { name: 'Driver 1', number: '447000000001@c.us' },
  { name: 'Driver 2', number: '447000000002@c.us' },
  { name: 'Driver 3', number: '447000000003@c.us' },
  { name: 'Driver 4', number: '447000000004@c.us' },
  { name: 'Driver 5', number: '447000000005@c.us' },
  { name: 'Driver 6', number: '447000000006@c.us' },
  { name: 'Driver 7', number: '447000000007@c.us' },
  { name: 'Driver 8', number: '447000000008@c.us' },
];

let morningMsgId = null;
let reacted = new Set();

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', async (qr) => {
  qrImage = await qrcode.toDataURL(qr);
  console.log('QR READY - open your Render link /qr');
});

client.on('ready', () => { clientReady = true; console.log('READY'); });

client.on('message_reaction', async (reaction) => {
  if (reaction.msgId && reaction.msgId._serialized === morningMsgId) {
    reacted.add(reaction.senderId);
  }
});

async function findGroup() {
  const chats = await client.getChats();
  return chats.find(c => c.isGroup && c.name === GROUP_NAME);
}

async function sendMorning() {
  const group = await findGroup();
  if (!group) return;
  reacted.clear();
  const msg = await group.sendMessage('Good morning drivers ☀️ Please react 👍 to this message to confirm you are awake and ready for today.');
  morningMsgId = msg.id._serialized;
}

async function sendReport(timeLabel) {
  const missing = DRIVERS.filter(d => !reacted.has(d.number));
  let text = `⏰ ${timeLabel} Report\n\n`;
  if (missing.length === 0) text += '✅ Everyone has reacted. All drivers ready.';
  else {
    text += `❌ Still missing (${missing.length}):\n`;
    missing.forEach(d => text += `- ${d.name}\n`);
  }
  await client.sendMessage(OSM_NUMBER, text);
}

cron.schedule('0 7 * * *', sendMorning, { timezone: 'Europe/London' });
cron.schedule('30 7 * * *', () => sendReport('7:30am'), { timezone: 'Europe/London' });
cron.schedule('0 8 * * *', () => sendReport('8:00am'), { timezone: 'Europe/London' });
cron.schedule('30 8 * * *', () => sendReport('8:30am'), { timezone: 'Europe/London' });

app.get('/', (req, res) => res.send(clientReady ? 'Bot is running ✅' : 'Bot starting... scan QR at /qr'));
app.get('/qr', (req, res) => res.send(`<img src="${qrImage}" style="width:300px"><p>Scan this in WhatsApp > Linked Devices</p>`));

app.get('/test-morning', async (req, res) => { await sendMorning(); res.send('Morning sent'); });
app.get('/test-report', async (req, res) => { await sendReport('TEST'); res.send('Report sent'); });

client.initialize();
app.listen(process.env.PORT || 3000);
