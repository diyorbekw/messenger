// API for Vercel Messenger
const users = [
  { id: 1, username: "nafisa_177", password: "nafisa2010", name: "Nafisa" },
  { id: 2, username: "jahongir_177", password: "jahongir2010", name: "Jahongir" }
];

// In-memory storage
let messages = [];
let onlineStatus = { 1: false, 2: false };
let lastSeen = { 1: new Date().toISOString(), 2: new Date().toISOString() };
let sessions = {};

module.exports = async (req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse URL
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const path = url.pathname;
  
  console.log('Path:', path);

  try {
    // Parse body for POST/PUT
    let body = {};
    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks).toString();
        if (rawBody) {
          body = JSON.parse(rawBody);
        }
      } catch (parseError) {
        console.log('Parse error:', parseError);
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    // Test endpoint
    if (path === '/api/test' || path === '/api') {
      return res.status(200).json({ 
        success: true, 
        message: 'API is working',
        endpoints: ['/api/login', '/api/verify', '/api/messages', '/api/users']
      });
    }

    // Login
    if (path === '/api/login') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      const { username, password } = body;
      console.log('Login attempt for:', username);
      
      const user = users.find(u => u.username === username && u.password === password);
      
      if (user) {
        onlineStatus[user.id] = true;
        lastSeen[user.id] = new Date().toISOString();
        
        const token = `${user.id}_${Date.now()}`;
        sessions[token] = { userId: user.id, timestamp: Date.now() };
        
        console.log('Login successful:', user.name);
        
        return res.status(200).json({
          success: true,
          token,
          user: { 
            id: user.id, 
            username: user.username, 
            name: user.name 
          }
        });
      }
      
      return res.status(401).json({ 
        success: false, 
        message: 'Login yoki parol noto\'g\'ri' 
      });
    }

    // Verify token
    if (path === '/api/verify') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      const { token } = body;
      
      if (token && sessions[token]) {
        const userId = parseInt(token.split('_')[0]);
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
    if (path === '/api/messages') {
      if (req.method === 'GET') {
        return res.status(200).json(messages);
      }
      
      if (req.method === 'POST') {
        const { token, content } = body;
        
        if (!token || !content) {
          return res.status(400).json({ 
            success: false, 
            message: 'Token va content kerak' 
          });
        }
        
        const userId = parseInt(token.split('_')[0]);
        const user = users.find(u => u.id === userId);
        
        if (!user || !sessions[token]) {
          return res.status(401).json({ 
            success: false, 
            message: 'Avtorizatsiya xatosi' 
          });
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
        
        // Keep only last 100 messages
        if (messages.length > 100) {
          messages = messages.slice(-100);
        }
        
        console.log('Message sent by:', user.name, '-', content);
        
        return res.status(200).json({ success: true, message });
      }
      
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Get users
    if (path === '/api/users') {
      if (req.method === 'GET') {
        const userList = users.map(user => ({
          id: user.id,
          username: user.username,
          name: user.name,
          online: onlineStatus[user.id],
          lastSeen: lastSeen[user.id]
        }));
        
        return res.status(200).json(userList);
      }
      
      if (req.method === 'POST') {
        const { userId, online } = body;
        
        if (userId && (online === true || online === false)) {
          onlineStatus[userId] = online;
          lastSeen[userId] = new Date().toISOString();
          
          return res.status(200).json({ success: true });
        }
        
        return res.status(400).json({ 
          success: false, 
          message: 'userId va online kerak' 
        });
      }
      
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Mark message as seen
    if (path === '/api/messages/seen') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      const { token, messageId } = body;
      
      if (!token || !messageId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Token va messageId kerak' 
        });
      }
      
      const userId = parseInt(token.split('_')[0]);
      const user = users.find(u => u.id === userId);
      
      if (!user || !sessions[token]) {
        return res.status(401).json({ 
          success: false, 
          message: 'Avtorizatsiya xatosi' 
        });
      }
      
      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex !== -1) {
        messages[messageIndex].seen = true;
        messages[messageIndex].seenAt = new Date().toISOString();
        
        return res.status(200).json({ success: true });
      }
      
      return res.status(404).json({ 
        success: false, 
        message: 'Xabar topilmadi' 
      });
    }

    // Mark all messages as seen
    if (path === '/api/messages/mark-all-seen') {
      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
      }

      const { token } = body;
      
      if (!token) {
        return res.status(400).json({ 
          success: false, 
          message: 'Token kerak' 
        });
      }
      
      const userId = parseInt(token.split('_')[0]);
      const user = users.find(u => u.id === userId);
      
      if (!user || !sessions[token]) {
        return res.status(401).json({ 
          success: false, 
          message: 'Avtorizatsiya xatosi' 
        });
      }
      
      const otherUserId = userId === 1 ? 2 : 1;
      
      // Mark all messages from other user as seen
      messages.forEach(message => {
        if (message.senderId === otherUserId && !message.seen) {
          message.seen = true;
          message.seenAt = new Date().toISOString();
        }
      });
      
      return res.status(200).json({ success: true });
    }

    // Not found
    return res.status(404).json({ 
      error: 'Endpoint topilmadi', 
      path: path,
      method: req.method
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      error: 'Server xatosi', 
      message: error.message 
    });
  }
};