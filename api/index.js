// Memory storage (Vercel'da faqat memory ishlatamiz)
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

  const { pathname } = new URL(req.url || '', `http://${req.headers.host}`);
  
  // Parse body for POST/PUT requests
  let body = {};
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
      });
      
      req.on('end', () => {
        if (data) {
          body = JSON.parse(data);
        }
        handleRequest();
      });
    } catch (error) {
      res.status(400).json({ success: false, message: 'Invalid JSON' });
      return;
    }
  } else {
    handleRequest();
  }

  function handleRequest() {
    // Login endpoint
    if (pathname === '/api/login' && req.method === 'POST') {
      const { username, password } = body;
      
      const user = users.find(u => u.username === username && u.password === password);
      
      if (user) {
        onlineStatus[user.id] = true;
        lastSeen[user.id] = new Date().toISOString();
        
        const token = `${user.id}_${Date.now()}`;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            name: user.name
          }
        }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Login yoki parol noto\'g\'ri' }));
      }
    }
    
    // Verify token
    else if (pathname === '/api/verify' && req.method === 'POST') {
      const { token } = body;
      
      if (!token) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ valid: false }));
      }
      
      const userId = parseInt(token.split('_')[0]);
      
      if ([1, 2].includes(userId)) {
        const user = users.find(u => u.id === userId);
        
        if (user) {
          onlineStatus[userId] = true;
          lastSeen[userId] = new Date().toISOString();
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            valid: true, 
            user: {
              id: user.id,
              username: user.username,
              name: user.name
            }
          }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: false }));
        }
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false }));
      }
    }
    
    // Get messages
    else if (pathname === '/api/messages' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(messages));
    }
    
    // Send message
    else if (pathname === '/api/messages' && req.method === 'POST') {
      const { token, content } = body;
      
      if (!token || !content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Token va content kerak' }));
      }
      
      const userId = parseInt(token.split('_')[0]);
      const user = users.find(u => u.id === userId);
      
      if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'Avtorizatsiya xatosi' }));
      }
      
      const message = {
        id: Date.now(),
        senderId: userId,
        senderName: user.name,
        content,
        timestamp: new Date().toISOString(),
        seen: false
      };
      
      messages.push(message);
      
      // Faqat oxirgi 100 ta xabarni saqlash
      if (messages.length > 100) {
        messages = messages.slice(-100);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message }));
    }
    
    // Mark message as seen
    else if (pathname === '/api/messages' && req.method === 'PUT') {
      const { messageId, token } = body;
      
      if (!messageId || !token) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: 'messageId va token kerak' }));
      }
      
      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        messages[messageIndex].seen = true;
        messages[messageIndex].seenAt = new Date().toISOString();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Xabar topilmadi' }));
      }
    }
    
    // Get users
    else if (pathname === '/api/users' && req.method === 'GET') {
      const userList = users.map(user => ({
        id: user.id,
        username: user.username,
        name: user.name,
        online: onlineStatus[user.id],
        lastSeen: lastSeen[user.id]
      }));
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(userList));
    }
    
    // Update user status
    else if (pathname === '/api/users' && req.method === 'POST') {
      const { userId, online } = body;
      
      if (userId && (online === true || online === false)) {
        onlineStatus[userId] = online;
        lastSeen[userId] = new Date().toISOString();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'userId va online kerak' }));
      }
    }
    
    // Not found
    else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Endpoint topilmadi' }));
    }
  }
};