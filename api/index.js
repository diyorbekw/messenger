// Memory storage (old server.js logic'iga o'xshash)
let db = {
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

// WebSocket klientlarini simulatsiya qilish
const clients = new Map();

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.url || '';
  let body = {};

  // Parse body
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      if (req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid JSON' });
    }
  }

  // Login
  if (url === '/api/login' && req.method === 'POST') {
    const { username, password } = body;
    
    const user = db.users.find(u => u.username === username && u.password === password);
    
    if (user) {
      // Eski sessionlarni tozalash
      Object.keys(db.sessions).forEach(token => {
        if (db.sessions[token].userId === user.id) {
          delete db.sessions[token];
        }
      });
      
      // Yangi token
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      db.sessions[token] = { userId: user.id, timestamp: Date.now() };
      
      // User online qilish
      user.online = true;
      user.lastSeen = new Date().toISOString();
      
      // Simulate WebSocket broadcast
      broadcast({ type: 'user_status', userId: user.id, online: true, lastSeen: user.lastSeen });
      
      return res.status(200).json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name
        }
      });
    } else {
      return res.status(401).json({ success: false, message: 'Login yoki parol noto\'g\'ri' });
    }
  }
  
  // Verify
  else if (url === '/api/verify' && req.method === 'POST') {
    const { token } = body;
    
    if (db.sessions[token]) {
      const userId = db.sessions[token].userId;
      const user = db.users.find(u => u.id === userId);
      
      if (user) {
        user.online = true;
        user.lastSeen = new Date().toISOString();
        
        return res.status(200).json({ 
          valid: true, 
          user: {
            id: user.id,
            username: user.username,
            name: user.name
          }
        });
      }
    }
    
    return res.status(200).json({ valid: false });
  }
  
  // Logout
  else if (url === '/api/logout' && req.method === 'POST') {
    const { token } = body;
    
    if (db.sessions[token]) {
      const userId = db.sessions[token].userId;
      delete db.sessions[token];
      
      const user = db.users.find(u => u.id === userId);
      if (user) {
        user.online = false;
        user.lastSeen = new Date().toISOString();
      }
      
      // Simulate WebSocket broadcast
      broadcast({ type: 'user_status', userId, online: false, lastSeen: user.lastSeen });
      
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ success: false, message: 'Token topilmadi' });
    }
  }
  
  // Get messages
  else if (url === '/api/messages' && req.method === 'GET') {
    return res.status(200).json(db.messages);
  }
  
  // Send message
  else if (url === '/api/messages' && req.method === 'POST') {
    const { token, content } = body;
    
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
    
    // Simulate WebSocket broadcast
    broadcast({ type: 'new_message', message });
    
    return res.status(200).json({ success: true, message });
  }
  
  // Mark message as seen
  else if (url === '/api/messages/seen' && req.method === 'POST') {
    const { token, messageId } = body;
    
    if (!db.sessions[token]) {
      return res.status(401).json({ success: false, message: 'Avtorizatsiya xatosi' });
    }
    
    const messageIndex = db.messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      db.messages[messageIndex].seen = true;
      db.messages[messageIndex].seenAt = new Date().toISOString();
      
      // Simulate WebSocket broadcast
      broadcast({ 
        type: 'message_seen', 
        messageId: messageId, 
        seenAt: db.messages[messageIndex].seenAt 
      });
      
      return res.status(200).json({ success: true });
    } else {
      return res.status(404).json({ success: false, message: 'Xabar topilmadi' });
    }
  }
  
  // Mark all messages as seen
  else if (url === '/api/messages/mark-all-seen' && req.method === 'POST') {
    const { token } = body;
    
    if (!db.sessions[token]) {
      return res.status(401).json({ success: false, message: 'Avtorizatsiya xatosi' });
    }
    
    const userId = db.sessions[token].userId;
    const otherUserId = userId === 1 ? 2 : 1;
    
    // Mark all messages from other user as seen
    db.messages.forEach(message => {
      if (message.senderId === otherUserId && !message.seen) {
        message.seen = true;
        message.seenAt = new Date().toISOString();
        
        // Simulate WebSocket broadcast for each message
        broadcast({ 
          type: 'message_seen', 
          messageId: message.id, 
          seenAt: message.seenAt 
        });
      }
    });
    
    return res.status(200).json({ success: true });
  }
  
  // Get users
  else if (url === '/api/users' && req.method === 'GET') {
    const users = db.users.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      online: u.online,
      lastSeen: u.lastSeen
    }));
    return res.status(200).json(users);
  }
  
  // Register client (WebSocket simulation)
  else if (url === '/api/register-client' && req.method === 'POST') {
    const { userId } = body;
    
    // Simulate WebSocket connection
    clients.set(userId, { lastPing: Date.now() });
    
    // Update user online status
    const user = db.users.find(u => u.id === userId);
    if (user) {
      user.online = true;
      user.lastSeen = new Date().toISOString();
    }
    
    // Broadcast status change
    broadcast({ 
      type: 'user_status', 
      userId: userId, 
      online: true,
      lastSeen: user.lastSeen
    });
    
    return res.status(200).json({ success: true });
  }
  
  // Ping (keep connection alive)
  else if (url === '/api/ping' && req.method === 'POST') {
    const { userId } = body;
    
    if (clients.has(userId)) {
      clients.set(userId, { lastPing: Date.now() });
      
      // Update user online status
      const user = db.users.find(u => u.id === userId);
      if (user) {
        user.online = true;
        user.lastSeen = new Date().toISOString();
      }
      
      return res.status(200).json({ success: true });
    }
    
    return res.status(400).json({ success: false, message: 'Client topilmadi' });
  }
  
  // Not found
  else {
    return res.status(404).json({ success: false, message: 'Endpoint topilmadi' });
  }
};

// Simulate WebSocket broadcast
function broadcast(data) {
  // Vercel'da WebSocket yo'q, shuning uchun polling orqali ishlaymiz
  // Clientlar o'zlarini tekshirishlari kerak
  // Bu faqat server tomonida log qilish uchun
  console.log('Broadcast:', data.type);
}

// Cleanup inactive clients every minute
setInterval(() => {
  const now = Date.now();
  const timeout = 30000; // 30 seconds
  
  clients.forEach((client, userId) => {
    if (now - client.lastPing > timeout) {
      clients.delete(userId);
      
      // Mark user as offline
      const user = db.users.find(u => u.id === userId);
      if (user) {
        user.online = false;
        user.lastSeen = new Date().toISOString();
      }
      
      // Broadcast status change
      broadcast({ 
        type: 'user_status', 
        userId: userId, 
        online: false,
        lastSeen: user.lastSeen
      });
    }
  });
}, 60000); // Check every minute