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

let users = {}; // { phone: { passwordHash, online } }
let chats = {}; // { chatId: [ { id, text, from, time } ] }

function chatIdFor(a, b) {
  return [a, b].sort().join("_");
}

// Регистрация
app.post("/register", async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: "Заполните все поля" });
  if (users[phone]) return res.status(400).json({ error: "Пользователь уже существует" });
  const passwordHash = await bcrypt.hash(password, 10);
  users[phone] = { passwordHash, online: false };
  res.json({ success: true });
});

// Вход
app.post("/login", async (req, res) => {
  const { phone, password } = req.body;
  const user = users[phone];
  if (!user) return res.status(400).json({ error: "Неверные данные" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: "Неверные данные" });
  user.online = true;
  res.json({ success: true });
});

// Выход
app.post("/logout", (req, res) => {
  const { phone } = req.body;
  if (users[phone]) users[phone].online = false;
  res.json({ success: true });
});

// Поиск / список пользователей
app.get("/search", (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.json(Object.keys(users));
  const results = Object.keys(users).filter((u) => u.includes(phone));
  if (results.length === 0) return res.status(404).json({ error: "Пользователь не найден" });
  res.json(results);
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("Пользователь подключился:", socket.id);

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
  });

  socket.on("disconnect", () => console.log("Пользователь отключился:", socket.id));
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
