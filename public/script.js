// Global variables
let currentUser = null;
let currentToken = null;
let messageCheckInterval = null;
let userCheckInterval = null;
let lastMessageId = 0;

// Auto login on page load
document.addEventListener('DOMContentLoaded', function() {
    autoLogin();
    setupEventListeners();
});

// Auto login function
async function autoLogin() {
    const token = localStorage.getItem('messenger_token');
    const user = localStorage.getItem('messenger_user');
    
    if (token && user) {
        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
            });
            
            const data = await response.json();
            if (data.valid) {
                await loginWithToken(JSON.parse(user), token);
                return;
            }
        } catch (error) {
            console.log('Auto login failed:', error);
        }
    }
    
    showLoginScreen();
}

// Login with token
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
    
    showChatScreen();
    loadMessages();
    loadUsers();
    
    // Start intervals
    startIntervals();
}

// Setup event listeners
function setupEventListeners() {
    // Login button
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Send button
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    
    // Enter key for login
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    // Enter key for sending messages
    document.getElementById('message-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// Handle login
async function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const rememberMe = document.getElementById('remember-me').checked;
    
    if (!username || !password) {
        alert('Iltimos, login va parolni kiriting!');
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            currentToken = data.token;
            
            if (rememberMe) {
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
            
            showChatScreen();
            loadMessages();
            loadUsers();
            
            // Start intervals
            startIntervals();
        } else {
            alert('Login yoki parol noto\'g\'ri!');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Server bilan aloqa xatosi!');
    }
}

// Handle logout
async function handleLogout() {
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
    
    // Clear local storage
    localStorage.removeItem('messenger_token');
    localStorage.removeItem('messenger_user');
    
    // Clear intervals
    stopIntervals();
    
    // Reset variables
    currentUser = null;
    currentToken = null;
    lastMessageId = 0;
    
    // Reset UI
    document.getElementById('messages-container').innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">
                <i class="fas fa-comment-slash"></i>
            </div>
            <h3>Hozircha xabarlar yo'q</h3>
            <p>Biror narsa yozishni boshlang!</p>
        </div>
    `;
    
    // Clear inputs
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    
    // Show login screen
    showLoginScreen();
}

// Load messages
async function loadMessages() {
    try {
        const response = await fetch('/api/messages');
        const messages = await response.json();
        
        // Check if there are new messages
        const latestMessage = messages[messages.length - 1];
        if (latestMessage && latestMessage.id !== lastMessageId) {
            lastMessageId = latestMessage.id;
            displayMessages(messages);
            scrollToBottom();
            
            // Mark other user's messages as seen
            await markMessagesAsSeen(messages);
        }
    } catch (error) {
        console.log('Xabarlarni yuklashda xato:', error);
    }
}

// Display messages
function displayMessages(messages) {
    const container = document.getElementById('messages-container');
    
    if (messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-comment-slash"></i>
                </div>
                <h3>Hozircha xabarlar yo'q</h3>
                <p>Biror narsa yozishni boshlang!</p>
            </div>
        `;
        return;
    }
    
    // Clear welcome message if exists
    const welcomeMsg = container.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    // Clear existing messages
    container.innerHTML = '';
    
    // Display all messages
    messages.forEach(message => {
        const messageElement = createMessageElement(message);
        container.appendChild(messageElement);
    });
}

// Create message element
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.senderId === currentUser.id ? 'sent' : 'received'}`;
    
    // Format time
    const messageTime = new Date(message.timestamp);
    const timeString = messageTime.toLocaleTimeString('uz-UZ', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Seen status
    let seenStatus = '';
    if (message.senderId === currentUser.id) {
        if (message.seen && message.seenAt) {
            const seenTime = new Date(message.seenAt);
            const seenTimeString = seenTime.toLocaleTimeString('uz-UZ', {
                hour: '2-digit',
                minute: '2-digit'
            });
            seenStatus = `
                <div class="message-status seen">
                    <i class="fas fa-check-double"></i>
                    <span class="seen-text">ko'rildi ${seenTimeString}</span>
                </div>
            `;
        } else {
            seenStatus = `
                <div class="message-status">
                    <i class="fas fa-check"></i>
                </div>
            `;
        }
    }
    
    div.innerHTML = `
        <div class="message-content">${message.content}</div>
        <div class="message-info">
            <div class="message-time">${timeString}</div>
            ${seenStatus}
        </div>
    `;
    
    return div;
}

// Mark messages as seen
async function markMessagesAsSeen(messages) {
    const otherUserMessages = messages.filter(msg => 
        msg.senderId !== currentUser.id && !msg.seen
    );
    
    for (const message of otherUserMessages) {
        try {
            await fetch('/api/messages', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId: message.id,
                    token: currentToken
                })
            });
        } catch (error) {
            console.log('Mark as seen failed:', error);
        }
    }
}

// Load users
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        
        const otherUser = users.find(u => u.id !== currentUser.id);
        if (otherUser) {
            const statusElement = document.getElementById('status-info');
            
            if (otherUser.online) {
                statusElement.textContent = `${otherUser.name} onlayn`;
                statusElement.style.color = '#4caf50';
            } else {
                const lastSeenTime = new Date(otherUser.lastSeen);
                const timeString = lastSeenTime.toLocaleTimeString('uz-UZ', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                statusElement.textContent = `${otherUser.name} oxirgi marta ${timeString}`;
                statusElement.style.color = '#666';
            }
        }
        
        // Update user avatar
        if (currentUser) {
            document.getElementById('user-avatar').textContent = currentUser.name.charAt(0);
        }
    } catch (error) {
        console.log('Foydalanuvchilarni yuklashda xato:', error);
    }
}

// Send message
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content) return;
    
    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: currentToken,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            input.value = '';
            input.focus();
            
            // Add message to UI immediately
            const container = document.getElementById('messages-container');
            const welcomeMsg = container.querySelector('.welcome-message');
            if (welcomeMsg) {
                welcomeMsg.remove();
            }
            
            const messageElement = createMessageElement(data.message);
            container.appendChild(messageElement);
            scrollToBottom();
            
            // Auto mark as seen after 2 seconds
            setTimeout(async () => {
                try {
                    await fetch('/api/messages', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            messageId: data.message.id,
                            token: currentToken
                        })
                    });
                } catch (error) {
                    console.log('Auto seen failed:', error);
                }
            }, 2000);
        }
    } catch (error) {
        console.log('Xabar yuborishda xato:', error);
        alert('Xabar yuborishda xatolik!');
    }
}

// Start intervals
function startIntervals() {
    stopIntervals(); // Clear any existing intervals
    
    messageCheckInterval = setInterval(loadMessages, 2000);
    userCheckInterval = setInterval(loadUsers, 3000);
}

// Stop intervals
function stopIntervals() {
    if (messageCheckInterval) {
        clearInterval(messageCheckInterval);
        messageCheckInterval = null;
    }
    
    if (userCheckInterval) {
        clearInterval(userCheckInterval);
        userCheckInterval = null;
    }
}

// Scroll to bottom
function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

// Show login screen
function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('username').focus();
}

// Show chat screen
function showChatScreen() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'block';
    document.getElementById('current-user-name').textContent = currentUser.name;
    document.getElementById('message-input').focus();
}