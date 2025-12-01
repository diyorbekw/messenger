let onlineStatus = {
  1: false,
  2: false
};
let lastSeen = {
  1: new Date().toISOString(),
  2: new Date().toISOString()
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    const users = [
      {
        id: 1,
        username: "nafisa_177",
        name: "Nafisa",
        online: onlineStatus[1],
        lastSeen: lastSeen[1]
      },
      {
        id: 2,
        username: "jahongir_177",
        name: "Jahongir",
        online: onlineStatus[2],
        lastSeen: lastSeen[2]
      }
    ];
    
    res.status(200).json(users);
  } else if (req.method === 'POST') {
    // Online statusni yangilash
    const { userId, online } = req.body;
    
    if (userId && (online === true || online === false)) {
      onlineStatus[userId] = online;
      lastSeen[userId] = new Date().toISOString();
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ success: false, message: 'userId va online kerak' });
    }
  } else {
    res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}