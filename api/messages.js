// Memory storage
let messages = [];
let onlineStatus = {
  1: false,
  2: false
};

// Message seen status
const seenStatus = {};

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // Xabarlarni olish
    res.status(200).json(messages);
  } else if (req.method === 'POST') {
    // Yangi xabar yuborish
    const { token, content } = req.body;
    
    if (!token || !content) {
      return res.status(400).json({ success: false, message: 'Token va content kerak' });
    }
    
    const userId = parseInt(token.split('_')[0]);
    const user = getUserById(userId);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Avtorizatsiya xatosi' });
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
    
    // Xabarni ko'rilgan deb belgilash
    setTimeout(() => {
      seenStatus[message.id] = false;
    }, 1000);
    
    res.status(200).json({ success: true, message });
  } else if (req.method === 'PUT') {
    // Xabarni ko'rilgan deb belgilash
    const { messageId, token } = req.body;
    
    if (!messageId || !token) {
      return res.status(400).json({ success: false, message: 'messageId va token kerak' });
    }
    
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      messages[messageIndex].seen = true;
      messages[messageIndex].seenAt = new Date().toISOString();
      seenStatus[messageId] = true;
      
      res.status(200).json({ success: true });
    } else {
      res.status(404).json({ success: false, message: 'Xabar topilmadi' });
    }
  } else {
    res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}

function getUserById(id) {
  const users = [
    { id: 1, username: "nafisa_177", name: "Nafisa" },
    { id: 2, username: "jahongir_177", name: "Jahongir" }
  ];
  return users.find(u => u.id === id);
}