let currentUser = null;
let currentToken = null;
let messageCheckInterval = null;
let userCheckInterval = null;

// Sahifa yuklanganda avtomatik login
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
            console.log('Auto login failed:', error);
        }
    }
    
    showLogin();
}

async function loginWithToken(user, token) {
    currentUser = user;
    currentToken = token;
    
    // Update online status
    try {
        await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, online: true })
        });
    } catch (error) {
        console.log('Status update failed');
    }
    
    showChat();
    loadMessages();
    loadUsers();
    
    // Start intervals
    if (messageCheckInterval) clearInterval(messageCheckInterval);
    if (userCheckInterval) clearInterval(userCheckInterval);
    
    messageCheckInterval = setInterval(loadMessages, 2000);
    userCheckInterval = setInterval(loadUsers, 3000);
}

// Login funksiyasi
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const remember = document.getElementById('remember-me').checked;
    
    if (!username || !password) {
        alert('Iltimos, login va parolni kiriting!');
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
            
            // Update online status
            try {
                await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, online: true })
                });
            } catch (error) {
                console.log('Status update failed');
            }
            
            showChat();
            loadMessages();
            loadUsers();
            
            // Start intervals
            if (messageCheckInterval) clearInterval(messageCheckInterval);
            if (userCheckInterval) clearInterval(userCheckInterval);
            
            messageCheckInterval = setInterval(loadMessages, 2000);
            userCheckInterval = setInterval(loadUsers, 3000);
            
        } else {
            alert('Login yoki parol noto\'g\'ri!');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Server bilan aloqa xatosi!');
    }
}

// Logout funksiyasi
async function logout() {
    // Update online status
    try {
        await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, online: false })
        });
    } catch (error) {
        console.log('Status update failed');
    }
    
    localStorage.removeItem('messenger_token');
    localStorage.removeItem('messenger_user');
    
    // Clear intervals
    if (messageCheckInterval) clearInterval(messageCheckInterval);
    if (userCheckInterval) clearInterval(userCheckInterval);
    
    currentUser = null;
    currentToken = null;
    
    // Clear messages container
    document.getElementById('messages-container').innerHTML = 
        '<div class="welcome-message"><h3>Xush kelibsiz!</h3><p>Xabarlar bu yerda ko\'rinadi...</p></div>';
    
    showLogin();
}

// Xabarlarni yuklash
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
                
                // Format time
                const time = new Date(msg.timestamp);
                const timeStr = time.toLocaleTimeString('uz-UZ', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                // Seen status
                let seenStatus = '';
                if (msg.senderId === currentUser.id) {
                    if (msg.seen) {
                        const seenTime = new Date(msg.seenAt);
                        const seenTimeStr = seenTime.toLocaleTimeString('uz-UZ', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                        seenStatus = `<div class="message-status">ko'rildi ${seenTimeStr}</div>`;
                    } else {
                        seenStatus = `<div class="message-status">yuborildi</div>`;
                    }
                }
                
                div.innerHTML = `
                    <div class="message-content">${msg.content}</div>
                    <div class="message-info">
                        <span>${timeStr}</span>
                        ${seenStatus}
                    </div>
                `;
                
                container.appendChild(div);
            });
            
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
            
            // Mark other user's messages as seen
            markMessagesAsSeen(messages);
        }
    } catch (error) {
        console.log('Xabarlarni yuklashda xato:', error);
    }
}

// Xabarlarni ko'rilgan deb belgilash
async function markMessagesAsSeen(messages) {
    const otherUserMessages = messages.filter(msg => 
        msg.senderId !== currentUser.id && !msg.seen
    );
    
    for (const msg of otherUserMessages) {
        try {
            await fetch('/api/messages', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    messageId: msg.id, 
                    token: currentToken 
                })
            });
        } catch (error) {
            console.log('Mark as seen failed:', error);
        }
    }
}

// Foydalanuvchilarni yuklash
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        
        const otherUser = users.find(u => u.id !== currentUser.id);
        if (otherUser) {
            const statusText = otherUser.online 
                ? 'onlayn' 
                : `oxirgi marta ${new Date(otherUser.lastSeen).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}`;
            
            document.getElementById('status-info').textContent = 
                `${otherUser.name} - ${statusText}`;
        }
    } catch (error) {
        console.log('Foydalanuvchilarni yuklashda xato:', error);
    }
}

// Xabar yuborish
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
        console.log('Xabar yuborishda xato:', error);
        alert('Xabar yuborishda xatolik!');
    }
}

// Sahifalarni ko'rsatish
function showLogin() {
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('chat-container').style.display = 'none';
    document.getElementById('username').focus();
}

function showChat() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';
    document.getElementById('current-user-name').textContent = currentUser.name;
    document.getElementById('message-input').focus();
}

// DOM yuklanganda
document.addEventListener('DOMContentLoaded', function() {
    autoLogin();
    
    // Event listeners
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    
    // Enter bilan login
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
    
    // Enter bilan xabar yuborish
    document.getElementById('message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Username ga autofocus
    document.getElementById('username').focus();
});