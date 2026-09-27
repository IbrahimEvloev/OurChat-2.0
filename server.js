const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const os = require("os");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

let users = {}; // { username: { passwordHash, online } }
let chats = {}; // { chatId: [ { id, text, from, time, read, edited, replyTo } ] }

const socketUser = {};   // socket.id -> username
const onlineCounts = {}; // username -> number of open sockets

const USERNAME_REGEX = /^[a-zA-Zа-яА-ЯёЁ0-9_.-]{3,20}$/;

function isValidUsername(username) {
  return typeof username === "string" && USERNAME_REGEX.test(username);
}

function chatIdFor(a, b) {
  return [a, b].sort().join("_");
}

// Регистрация
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Заполните все поля" });
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: "Ник: 3-20 символов, разрешены буквы, цифры, _ . -" });
  }
  if (users[username]) return res.status(400).json({ error: "Такой ник уже занят" });
  const passwordHash = await bcrypt.hash(password, 10);
  users[username] = { passwordHash, online: false };
  res.json({ success: true });
});

// Вход
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user) return res.status(400).json({ error: "Неверные данные" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: "Неверные данные" });
  user.online = true;
  res.json({ success: true });
});

// Выход
app.post("/logout", (req, res) => {
  const { username } = req.body;
  if (users[username]) users[username].online = false;
  res.json({ success: true });
});

// Поиск / список пользователей
app.get("/search", (req, res) => {
  const { username } = req.query;
  if (!username) return res.json(Object.keys(users));
  const results = Object.keys(users).filter((u) => u.includes(username));
  if (results.length === 0) return res.status(404).json({ error: "Пользователь не найден" });
  res.json(results);
});

// Текущий онлайн-статус пользователя
app.get("/status", (req, res) => {
  const { username } = req.query;
  if (!username) return res.json({ online: false });
  res.json({ online: !!(users[username] && users[username].online) });
});

// Последнее сообщение с каждым собеседником (для превью в списке чатов)
app.get("/last-messages", (req, res) => {
  const { user } = req.query;
  if (!user) return res.json({});
  const result = {};
  for (const chatId in chats) {
    const [a, b] = chatId.split("_");
    if (a === user || b === user) {
      const other = a === user ? b : a;
      const msgs = chats[chatId];
      if (msgs.length) result[other] = msgs[msgs.length - 1];
    }
  }
  res.json(result);
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("Пользователь подключился:", socket.id);

  socket.on("identify", ({ user }) => {
    if (!user) return;
    socketUser[socket.id] = user;
    onlineCounts[user] = (onlineCounts[user] || 0) + 1;
    if (users[user]) users[user].online = true;
    io.emit("presence", { user, online: true });
  });

  socket.on("join", ({ chat, user }) => {
    if (!chat || !user) return;
    const chatId = chatIdFor(chat, user);
    socket.join(chatId);
    if (!chats[chatId]) chats[chatId] = [];
    socket.emit("history", chats[chatId]);
  });

  socket.on("message", ({ chat, user, msg }) => {
    if (!chat || !user || !msg) return;
    const chatId = chatIdFor(chat, user);
    if (!chats[chatId]) chats[chatId] = [];
    chats[chatId].push(msg);
    io.to(chatId).emit("message", msg);
    io.emit("notify", { to: chat, from: user, preview: msg.audio ? "🎤 Голосовое сообщение" : msg.text });
  });

  socket.on("edit-message", ({ chat, user, msgId, text }) => {
    if (!chat || !user || !msgId || !text) return;
    const chatId = chatIdFor(chat, user);
    const arr = chats[chatId];
    if (!arr) return;
    const msg = arr.find((m) => m.id === msgId && m.from === user);
    if (!msg) return;
    msg.text = text;
    msg.edited = true;
    io.to(chatId).emit("message-edited", { id: msgId, text, edited: true });
  });

  // Пользователь ("user") подтверждает, что прочитал сообщения от собеседника ("chat")
  socket.on("read", ({ chat, user }) => {
    if (!chat || !user) return;
    const chatId = chatIdFor(chat, user);
    const arr = chats[chatId];
    if (!arr) return;
    const ids = [];
    arr.forEach((m) => {
      if (m.from === chat && !m.read) {
        m.read = true;
        ids.push(m.id);
      }
    });
    if (ids.length) {
      io.to(chatId).emit("messages-read", { reader: user, ids });
    }
  });

  socket.on("typing", ({ chat, user }) => {
    if (!chat || !user) return;
    const chatId = chatIdFor(chat, user);
    socket.to(chatId).emit("typing", { from: user });
  });

  socket.on("delete-message", ({ chat, user, msgId }) => {
    if (!chat || !user || !msgId) return;
    const chatId = chatIdFor(chat, user);
    const arr = chats[chatId];
    if (!arr) return;
    const idx = arr.findIndex((m) => m.id === msgId && m.from === user);
    if (idx !== -1) {
      arr.splice(idx, 1);
      io.to(chatId).emit("message-deleted", { id: msgId });
    }
  });

  socket.on("disconnect", () => {
    const user = socketUser[socket.id];
    if (user) {
      onlineCounts[user] = Math.max(0, (onlineCounts[user] || 1) - 1);
      if (onlineCounts[user] === 0) {
        if (users[user]) users[user].online = false;
        io.emit("presence", { user, online: false });
      }
      delete socketUser[socket.id];
    }
    console.log("Пользователь отключился:", socket.id);
  });
});

app.get("/", (req, res) => res.sendFile(path.join(publicPath, "index.html")));
app.get("/chats.html", (req, res) => res.sendFile(path.join(publicPath, "chats.html")));
app.get("/chat.html", (req, res) => res.sendFile(path.join(publicPath, "chat.html")));
app.get("*", (req, res) => res.sendFile(path.join(publicPath, "index.html")));

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log("Открой с телефона (та же Wi-Fi сеть) по одному из адресов:");
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        console.log(`  http://${net.address}:${PORT}`);
      }
    }
  }
});
