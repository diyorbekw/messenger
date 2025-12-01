let currentUser = null;
let currentToken = null;
let messageCheckInterval = null;

// Avtomatik login
async function autoLogin() {
    const token = localStorage.getItem('messenger_token');
    const user = localStorage.getItem('messenger_user');
    
    if (token && user) {
        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            if (data.valid) {
                loginWithToken(JSON.parse(user), token);
                return;
            }
        } catch (error) {
            console.log('Auto login failed');
        }
    }
    
    showLogin();
}

async function loginWithToken(user, token) {
    currentUser = user;
    currentToken = token;
    
    // Update status
    await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, online: true })
    });
    
    showChat();
    loadMessages();
    loadUsers();
    setInterval(loadMessages, 2000);
    setInterval(loadUsers, 3000);
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember-me').checked;
    
    if (!username || !password) {
        alert('Login va parolni kiriting!');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            currentToken = data.token;
            
            if (remember) {
                localStorage.setItem('messenger_token', currentToken);
                localStorage.setItem('messenger_user', JSON.stringify(currentUser));
            }
            
            // Update status
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, online: true })
            });
            
            showChat();
            loadMessages();
            loadUsers();
            
            if (messageCheckInterval) clearInterval(messageCheckInterval);
            messageCheckInterval = setInterval(loadMessages, 2000);
            setInterval(loadUsers, 3000);
        } else {
            alert('Login yoki parol noto\'g\'ri!');
        }
    } catch (error) {
        alert('Server bilan aloqa xatosi!');
    }
}

function logout() {
    // Update status
    fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, online: false })
    });
    
    localStorage.removeItem('messenger_token');
    localStorage.removeItem('messenger_user');
    
    if (messageCheckInterval) clearInterval(messageCheckInterval);
    
    currentUser = null;
    currentToken = null;
    
    document.getElementById('messages-container').innerHTML = 
        '<div class="welcome-message"><h3>Xush kelibsiz!</h3><p>Xabarlar bu yerda ko\'rinadi...</p></div>';
    
    showLogin();
}

async function loadMessages() {
    try {
        const response = await fetch('/api/messages');
        const messages = await response.json();
        
        const container = document.getElementById('messages-container');
        
        if (messages.length > 0) {
            container.innerHTML = '';
            messages.forEach(msg => {
                const div = document.createElement('div');
                div.className = `message ${msg.senderId === currentUser.id ? 'sent' : 'received'}`;
                
                const time = new Date(msg.timestamp).toLocaleTimeString('uz-UZ', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                let seen = '';
                if (msg.senderId === currentUser.id) {
                    if (msg.seen) {
                        seen = `<div class="message-status">ko'rildi</div>`;
                    } else {
                        seen = `<div class="message-status">yuborildi</div>`;
                    }
                }
                
                div.innerHTML = `
                    <div class="message-content">${msg.content}</div>
                    <div class="message-info">
                        <span>${time}</span>
                        ${seen}
                    </div>
                `;
                
                container.appendChild(div);
            });
            
            container.scrollTop = container.scrollHeight;
        }
    } catch (error) {
        console.log('Xabarlarni yuklashda xato');
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        
        const otherUser = users.find(u => u.id !== currentUser.id);
        if (otherUser) {
            const status = otherUser.online ? 'onlayn' : 'offline';
            document.getElementById('status-info').textContent = 
                `${otherUser.name} - ${status}`;
        }
    } catch (error) {
        console.log('Foydalanuvchilarni yuklashda xato');
    }
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content) return;
    
    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: currentToken, content })
        });
        
        const data = await response.json();
        if (data.success) {
            input.value = '';
            input.focus();
            loadMessages();
        }
    } catch (error) {
        console.log('Xabar yuborishda xato');
    }
}

function showLogin() {
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('chat-container').style.display = 'none';
}

function showChat() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';
    document.getElementById('current-user-name').textContent = currentUser.name;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    autoLogin();
    
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    
    document.getElementById('message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
});