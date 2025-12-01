// Global storage (memory da)
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

module.exports = (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { pathname } = new URL(req.url || '', `http://${req.headers.host}`);
  
  // Path ga qarab route
  if (pathname === '/api/login' && req.method === 'POST') {
    handleLogin(req, res);
  } else if (pathname === '/api/verify' && req.method === 'POST') {
    handleVerify(req, res);
  } else if (pathname === '/api/messages') {
    if (req.method === 'GET') {
      handleGetMessages(req, res);
    } else if (req.method === 'POST') {
      handleSendMessage(req, res);
    } else if (req.method === 'PUT') {
      handleMarkSeen(req, res);
    }
  } else if (pathname === '/api/users') {
    if (req.method === 'GET') {
      handleGetUsers(req, res);
    } else if (req.method === 'POST') {
      handleUpdateUserStatus(req, res);
    }
  } else {
    res.status(404).json({ success: false, message: 'Endpoint topilmadi' });
  }
};

// Login
function handleLogin(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      const { username, password } = JSON.parse(body);
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
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid JSON' }));
    }
  });
}

// Verify token
function handleVerify(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      const { token } = JSON.parse(body);
      
      if (!token) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ valid: false }));
      }
      
      const userId = parseInt(token.split('_')[0]);
      
      if ([1, 2].includes(userId)) {
        const user = users.find(u => u.id === userId);
        
        if (user) {
          // Update status
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
    } catch (error) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false }));
    }
  });
}

// Get messages
function handleGetMessages(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(messages));
}

// Send message
function handleSendMessage(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      const { token, content } = JSON.parse(body);
      
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
      
      // Keep only last 100 messages
      if (messages.length > 100) {
        messages = messages.slice(-100);
      }
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid JSON' }));
    }
  });
}

// Mark message as seen
function handleMarkSeen(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      const { messageId, token } = JSON.parse(body);
      
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
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid JSON' }));
    }
  });
}

// Get users
function handleGetUsers(req, res) {
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
function handleUpdateUserStatus(req, res) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    try {
      const { userId, online } = JSON.parse(body);
      
      if (userId && (online === true || online === false)) {
        onlineStatus[userId] = online;
        lastSeen[userId] = new Date().toISOString();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'userId va online kerak' }));
      }
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Invalid JSON' }));
    }
  });
}