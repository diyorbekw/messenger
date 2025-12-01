const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// JSON ma'lumotlar bazasi fayli
const DB_FILE = 'db.json';

// Boshlang'ich ma'lumotlar
const initialData = {
  users: [
    {
      id: 1,
      username: "nafisa_177",
      password: "nafisa2010",
      name: "Nafisa",
      online: false,
      lastSeen: new Date().toISOString()
    },
    {
      id: 2,
      username: "jahongir_177",
      password: "jahongir2010",
      name: "Jahongir",
      online: false,
      lastSeen: new Date().toISOString()
    }
  ],
  messages: [],
  sessions: {}
};

// DB faylini tekshirish va yaratish
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

// Ma'lumotlarni o'qish
function readDB() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('DB faylni o\'qishda xato:', error);
    return initialData;
  }
}

// Ma'lumotlarni yozish
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('DB faylga yozishda xato:', error);
    return false;
  }
}

// WebSocket klientlari
const clients = new Map();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Token tekshirish endpoint
app.post('/api/verify-token', (req, res) => {
  const { token } = req.body;
  const db = readDB();
  
  if (db.sessions[token]) {
    const userId = db.sessions[token].userId;
    const user = db.users.find(u => u.id === userId);
    
    if (user) {
      // Userning onlayn holatini yangilash
      user.online = true;
      user.lastSeen = new Date().toISOString();
      writeDB(db);
      
      return res.json({ 
        valid: true, 
        user: {
          id: user.id,
          username: user.username,
          name: user.name
        }
      });
    }
  }
  
  res.json({ valid: false });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  
  const user = db.users.find(u => u.username === username && u.password === password);
  
  if (user) {
    // Eski sessionlarni tozalash (faqat bir device dan kirish)
    Object.keys(db.sessions).forEach(token => {
      if (db.sessions[token].userId === user.id) {
        delete db.sessions[token];
      }
    });
    
    // Yangi session token yaratish
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    db.sessions[token] = { userId: user.id, timestamp: Date.now() };
    
    // Userning onlayn holatini yangilash
    user.online = true;
    user.lastSeen = new Date().toISOString();
    
    writeDB(db);
    
    // WebSocket orqali boshqa userga xabar berish
    broadcast({ 
      type: 'user_status', 
      userId: user.id, 
      online: true, 
      lastSeen: user.lastSeen 
    });
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name
      }
    });
  } else {
    res.status(401).json({ success: false, message: 'Login yoki parol noto\'g\'ri' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  const { token } = req.body;
  const db = readDB();
  
  if (db.sessions[token]) {
    const userId = db.sessions[token].userId;
    delete db.sessions[token];
    
    // Userning onlayn holatini yangilash
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.online = false;
      user.lastSeen = new Date().toISOString();
    }
    
    writeDB(db);
    
    // WebSocket orqali boshqa userga xabar berish
    broadcast({ 
      type: 'user_status', 
      userId, 
      online: false, 
      lastSeen: user.lastSeen 
    });
    
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: 'Token topilmadi' });
  }
});

// Xabarlarni olish
app.get('/api/messages', (req, res) => {
  const db = readDB();
  res.json(db.messages);
});

// Xabar yuborish
app.post('/api/messages', (req, res) => {
  const { token, content } = req.body;
  const db = readDB();
  
  if (!db.sessions[token]) {
    return res.status(401).json({ success: false, message: 'Avtorizatsiya xatosi' });
  }
  
  const senderId = db.sessions[token].userId;
  const sender = db.users.find(u => u.id === senderId);
  
  const message = {
    id: Date.now(),
    senderId,
    senderName: sender.name,
    content,
    timestamp: new Date().toISOString(),
    seen: false,
    seenAt: null
  };
  
  db.messages.push(message);
  writeDB(db);
  
  // Barcha clientlarga yangi xabar haqida xabar berish
  broadcast({ type: 'new_message', message });
  
  res.json({ success: true, message });
});

// Xabarni ko'rilgan deb belgilash
app.post('/api/messages/:id/seen', (req, res) => {
  const { id } = req.params;
  const { token } = req.body;
  const db = readDB();
  
  if (!db.sessions[token]) {
    return res.status(401).json({ success: false, message: 'Avtorizatsiya xatosi' });
  }
  
  const messageIndex = db.messages.findIndex(m => m.id === parseInt(id));
  if (messageIndex !== -1) {
    db.messages[messageIndex].seen = true;
    db.messages[messageIndex].seenAt = new Date().toISOString();
    writeDB(db);
    
    // Barcha clientlarga xabar ko'rilganligi haqida xabar berish
    broadcast({ 
      type: 'message_seen', 
      messageId: parseInt(id), 
      seenAt: db.messages[messageIndex].seenAt 
    });
    
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: 'Xabar topilmadi' });
  }
});

// Foydalanuvchilar ro'yxatini olish
app.get('/api/users', (req, res) => {
  const db = readDB();
  const users = db.users.map(u => ({
    id: u.id,
    username: u.username,
    name: u.name,
    online: u.online,
    lastSeen: u.lastSeen
  }));
  res.json(users);
});

// WebSocket server
wss.on('connection', (ws) => {
  console.log('Yangi client ulandi');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'register') {
        const userId = data.userId;
        clients.set(userId, ws);
        console.log(`Client ro'yxatdan o'tdi: ${userId}`);
        
        // Foydalanuvchini onlayn qilish
        const db = readDB();
        const user = db.users.find(u => u.id === userId);
        if (user) {
          user.online = true;
          user.lastSeen = new Date().toISOString();
          writeDB(db);
        }
        
        // Boshqa foydalanuvchilarga onlayn holatini bildirish
        broadcast({ 
          type: 'user_status', 
          userId: userId, 
          online: true,
          lastSeen: user.lastSeen
        });
      }
    } catch (error) {
      console.error('Xabar oshkor qilishda xato:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client ulanishi uzildi');
  });
});

function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Statik fayllarni xizmat qilish
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serverni ishga tushirish
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlamoqda`);
});