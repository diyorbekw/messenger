const users = [
  {
    id: 1,
    username: "nafisa_177",
    password: "nafisa2010",
    name: "Nafisa"
  },
  {
    id: 2,
    username: "jahongir_177",
    password: "jahongir2010",
    name: "Jahongir"
  }
];

// Global storage (har bir function chaqirilganda yangilanadi)
let onlineStatus = {};
let lastSeen = {};

module.exports = function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { username, password } = req.body;
    
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      // Online statusni yangilash
      onlineStatus[user.id] = true;
      lastSeen[user.id] = new Date().toISOString();
      
      // Simple token yaratish
      const token = `${user.id}_${Date.now()}`;
      
      res.status(200).json({
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
  } else {
    res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}