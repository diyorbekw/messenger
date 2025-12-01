// Memory storage - Vercel'da faqat memory ishlatamiz
let messages = [];
let onlineStatus = { 1: false, 2: false };
let lastSeen = { 
  1: new Date().toISOString(), 
  2: new Date().toISOString() 
};

const users = [
  { id: 1, username: "nafisa_177", password: "nafisa2010", name: "Nafisa" },
  { id: 2, username: "jahongir_177", password: "jahongir2010", name: "Jahongir" }
];

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.url || '';
  let body = {};

  // Parse body for POST/PUT requests
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      if (req.body) {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      }
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid JSON' });
    }
  }

  // Login endpoint
  if (url === '/api/login' && req.method === 'POST') {
    const { username, password } = body;
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      onlineStatus[user.id] = true;
      lastSeen[user.id] = new Date().toISOString();
      
      const token = `${user.id}_${Date.now()}`;
      
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
  
  // Verify token
  else if (url === '/api/verify' && req.method === 'POST') {
    const { token } = body;
    
    if (!token) {
      return res.status(200).json({ valid: false });
    }
    
    const userId = parseInt(token.split('_')[0]);
    
    if ([1, 2].includes(userId)) {
      const user = users.find(u => u.id === userId);
      
      if (user) {
        onlineStatus[userId] = true;
        lastSeen[userId] = new Date().toISOString();
        
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
  
  // Get messages
  else if (url === '/api/messages' && req.method === 'GET') {
    return res.status(200).json(messages);
  }
  
  // Send message
  else if (url === '/api/messages' && req.method === 'POST') {
    const { token, content } = body;
    
    if (!token || !content) {
      return res.status(400).json({ success: false, message: 'Token va content kerak' });
    }
    
    const userId = parseInt(token.split('_')[0]);
    const user = users.find(u => u.id === userId);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Avtorizatsiya xatosi' });
    }
    
    const message = {
      id: Date.now(),
      senderId: userId,
      senderName: user.name,
      content,
      timestamp: new Date().toISOString(),
      seen: false,
      seenAt: null
    };
    
    messages.push(message);
    
    // Faqat oxirgi 100 ta xabarni saqlash
    if (messages.length > 100) {
      messages = messages.slice(-100);
    }
    
    return res.status(200).json({ success: true, message });
  }
  
  // Mark message as seen
  else if (url === '/api/messages' && req.method === 'PUT') {
    const { messageId, token } = body;
    
    if (!messageId || !token) {
      return res.status(400).json({ success: false, message: 'messageId va token kerak' });
    }
    
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      messages[messageIndex].seen = true;
      messages[messageIndex].seenAt = new Date().toISOString();
      
      return res.status(200).json({ success: true });
    } else {
      return res.status(404).json({ success: false, message: 'Xabar topilmadi' });
    }
  }
  
  // Get users
  else if (url === '/api/users' && req.method === 'GET') {
    const userList = users.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      online: onlineStatus[user.id],
      lastSeen: lastSeen[user.id]
    }));
    
    return res.status(200).json(userList);
  }
  
  // Update user status
  else if (url === '/api/users' && req.method === 'POST') {
    const { userId, online } = body;
    
    if (userId && (online === true || online === false)) {
      onlineStatus[userId] = online;
      lastSeen[userId] = new Date().toISOString();
      
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ success: false, message: 'userId va online kerak' });
    }
  }
  
  // Not found
  else {
    return res.status(404).json({ success: false, message: 'Endpoint topilmadi' });
  }
};