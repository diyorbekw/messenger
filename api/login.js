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

// Memory storage (Vercel'da database yo'q)
let messages = [];
let onlineStatus = {
  1: false,
  2: false
};
let lastSeen = {
  1: null,
  2: null
};

export default function handler(req, res) {
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