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
    const { token } = req.body;
    
    if (!token) {
      return res.status(200).json({ valid: false });
    }
    
    try {
      const userId = parseInt(token.split('_')[0]);
      
      if ([1, 2].includes(userId)) {
        const users = [
          { id: 1, username: "nafisa_177", name: "Nafisa" },
          { id: 2, username: "jahongir_177", name: "Jahongir" }
        ];
        
        const user = users.find(u => u.id === userId);
        
        if (user) {
          res.status(200).json({ 
            valid: true, 
            user: {
              id: user.id,
              username: user.username,
              name: user.name
            }
          });
        } else {
          res.status(200).json({ valid: false });
        }
      } else {
        res.status(200).json({ valid: false });
      }
    } catch (error) {
      res.status(200).json({ valid: false });
    }
  } else {
    res.status(405).json({ success: false, message: 'Method not allowed' });
  }
}