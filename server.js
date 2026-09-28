const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const os = require("os");

const app = express();
const server = http.createServer(app);
// Голосовые приходят как base64 dataURL. Лимит socket.io по умолчанию — 1 МБ,
// при превышении соединение просто рвётся, поэтому поднимаем до 10 МБ.
const io = new Server(server, { maxHttpBufferSize: 10e6 });

app.use(cors());
app.use(express.json());

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

// Object.create(null): иначе ник вроде "constructor" или "__proto__"
// находит свойства Object.prototype и ломает логику
const users = Object.create(null);      // { username: { passwordHash, online } }
const chats = Object.create(null);      // { chatId: [ { id, text, from, time, read, edited, replyTo } ] }
const socketUser = Object.create(null); // socket.id -> username
const onlineCounts = Object.create(null); // username -> число открытых сокетов

const USERNAME_REGEX = /^[a-zA-Zа-яА-ЯёЁ0-9_.-]{3,20}$/;
const MAX_TEXT = 4000;

function isValidUsername(username) {
  return typeof username === "string" && USERNAME_REGEX.test(username);
}

// В нике разрешён "_", поэтому склеивать через "_" нельзя:
// "a_b"+"c" и "a"+"b_c" давали один и тот же chatId, а split("_") ломался.
// "|" в нике запрещён регуляркой, так что он однозначный разделитель.
function chatIdFor(a, b) {
  return [a, b].sort().join("|");
}

function usernameTaken(username) {
  const lower = username.toLowerCase();
  return Object.keys(users).some((u) => u.toLowerCase() === lower);
}

// Регистрация
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Заполните все поля" });
    if (typeof password !== "string") return res.status(400).json({ error: "Неверные данные" });
    if (!isValidUsername(username)) {
      return res.status(400).json({ error: "Ник: 3-20 символов, разрешены буквы, цифры, _ . -" });
    }
    if (usernameTaken(username)) return res.status(400).json({ error: "Такой ник уже занят" });
    const passwordHash = await bcrypt.hash(password, 10);
    // повторная проверка: за время await такой же ник могли зарегистрировать параллельно
    if (usernameTaken(username)) return res.status(400).json({ error: "Такой ник уже занят" });
    users[username] = { passwordHash, online: false };
    res.json({ success: true });
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Вход
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Неверные данные" });
    }
    const user = users[username];
    if (!user) return res.status(400).json({ error: "Неверные данные" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ error: "Неверные данные" });
    user.online = true;
    res.json({ success: true });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Выход
app.post("/logout", (req, res) => {
  const { username } = req.body || {};
  if (typeof username === "string" && users[username]) {
    // если у пользователя ещё открыт сокет на другом устройстве/вкладке — он остаётся онлайн
    users[username].online = (onlineCounts[username] || 0) > 0;
  }
  res.json({ success: true });
});

// Поиск / список пользователей
app.get("/search", (req, res) => {
  const { username } = req.query;
  if (!username || typeof username !== "string") return res.json(Object.keys(users));
  const q = username.toLowerCase();
  const results = Object.keys(users).filter((u) => u.toLowerCase().includes(q));
  if (results.length === 0) return res.status(404).json({ error: "Пользователь не найден" });
  res.json(results);
});

// Текущий онлайн-статус пользователя
app.get("/status", (req, res) => {
  const { username } = req.query;
  if (!username || typeof username !== "string") return res.json({ online: false });
  res.json({ online: !!(users[username] && users[username].online) });
});

// Последнее сообщение с каждым собеседником (для превью в списке чатов)
app.get("/last-messages", (req, res) => {
  const { user } = req.query;
  if (!user || typeof user !== "string") return res.json({});
  const result = {};
  for (const chatId in chats) {
    const [a, b] = chatId.split("|");
    if (a === user || b === user) {
      const other = a === user ? b : a;
      const msgs = chats[chatId];
      if (msgs.length) {
        const last = msgs[msgs.length - 1];
        // для превью не нужно тянуть весь base64 голосового
        result[other] = last.audio ? { ...last, audio: true } : last;
      }
    }
  }
  res.json(result);
});

function cleanReply(r) {
  if (!r || typeof r !== "object") return null;
  return {
    id: r.id,
    text: typeof r.text === "string" ? r.text.slice(0, 500) : "",
    from: typeof r.from === "string" ? r.from.slice(0, 20) : "",
    audio: !!r.audio
  };
}

// Socket.IO
io.on("connection", (socket) => {
  console.log("Пользователь подключился:", socket.id);

  socket.on("identify", ({ user } = {}) => {
    if (!isValidUsername(user)) return;
    // повторный identify на том же сокете иначе завышал бы счётчик онлайна навсегда
    if (socketUser[socket.id]) return;
    socketUser[socket.id] = user;
    socket.join("user:" + user); // личная комната для уведомлений
    onlineCounts[user] = (onlineCounts[user] || 0) + 1;
    if (users[user]) users[user].online = true;
    io.emit("presence", { user, online: true });
  });

  socket.on("join", ({ chat, user } = {}) => {
    if (!isValidUsername(chat) || !isValidUsername(user)) return;
    const chatId = chatIdFor(chat, user);
    socket.join(chatId);
    if (!chats[chatId]) chats[chatId] = [];
    socket.emit("history", chats[chatId]);
  });

  socket.on("message", ({ chat, user, msg } = {}) => {
    if (!isValidUsername(chat) || !isValidUsername(user) || !msg || typeof msg !== "object") return;

    const text = typeof msg.text === "string" ? msg.text.slice(0, MAX_TEXT) : "";
    const hasAudio = typeof msg.audio === "string" && msg.audio.startsWith("data:audio/");
    if (!text.trim() && !hasAudio) return;

    const chatId = chatIdFor(chat, user);
    if (!chats[chatId]) chats[chatId] = [];
    const arr = chats[chatId];

    // id = время в мс; при коллизии сдвигаем, чтобы id в чате был уникальным
    let id = Number(msg.id);
    if (!Number.isFinite(id)) id = Date.now();
    while (arr.some((m) => m.id === id)) id++;

    // Собираем сообщение сами, а не доверяем клиентскому объекту целиком
    // (иначе можно подставить чужое "from" или произвольные поля)
    const clean = {
      id,
      text,
      from: user,
      time: typeof msg.time === "string" ? msg.time.slice(0, 16) : "",
      read: false,
      edited: false,
      replyTo: cleanReply(msg.replyTo)
    };
    if (hasAudio) {
      clean.audio = msg.audio;
      clean.duration = Number(msg.duration) || 0;
    }

    arr.push(clean);
    io.to(chatId).emit("message", clean);
    // раньше notify уходил ВСЕМ подключённым сокетам, и любой мог читать чужие превью
    io.to("user:" + chat).emit("notify", {
      to: chat,
      from: user,
      preview: clean.audio ? "🎤 Голосовое сообщение" : clean.text
    });
  });

  socket.on("edit-message", ({ chat, user, msgId, text } = {}) => {
    if (!isValidUsername(chat) || !isValidUsername(user) || !msgId || typeof text !== "string") return;
    const newText = text.slice(0, MAX_TEXT);
    if (!newText.trim()) return;
    const chatId = chatIdFor(chat, user);
    const arr = chats[chatId];
    if (!arr) return;
    const msg = arr.find((m) => m.id === msgId && m.from === user);
    if (!msg || msg.audio) return;
    msg.text = newText;
    msg.edited = true;
    io.to(chatId).emit("message-edited", { id: msgId, text: newText, edited: true });
  });

  // Пользователь ("user") подтверждает, что прочитал сообщения от собеседника ("chat")
  socket.on("read", ({ chat, user } = {}) => {
    if (!isValidUsername(chat) || !isValidUsername(user)) return;
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

  socket.on("typing", ({ chat, user } = {}) => {
    if (!isValidUsername(chat) || !isValidUsername(user)) return;
    const chatId = chatIdFor(chat, user);
    socket.to(chatId).emit("typing", { from: user });
  });

  socket.on("delete-message", ({ chat, user, msgId } = {}) => {
    if (!isValidUsername(chat) || !isValidUsername(user) || !msgId) return;
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
