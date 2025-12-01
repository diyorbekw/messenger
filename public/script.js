document.addEventListener('DOMContentLoaded', function() {
    const loginContainer = document.getElementById('login-container');
    const chatContainer = document.getElementById('chat-container');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages-container');
    const currentUserName = document.getElementById('current-user-name');
    const currentUserAvatar = document.getElementById('current-user-avatar');
    const otherUserStatus = document.getElementById('other-user-status');
    const rememberMe = document.getElementById('remember-me');
    
    let currentUser = null;
    let currentToken = null;
    let otherUser = null;
    let messageCheckInterval = null;
    let userCheckInterval = null;
    let lastMessageId = 0;
    
    // Sahifa yuklanganda avtomatik login
    autoLogin();
    
    async function autoLogin() {
        const savedToken = localStorage.getItem('messenger_token');
        const savedUser = localStorage.getItem('messenger_user');
        
        if (savedToken && savedUser) {
            try {
                const response = await fetch('/api/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: savedToken })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.valid) {
                        const user = JSON.parse(savedUser);
                        await loginWithToken(user, savedToken);
                        return;
                    }
                }
            } catch (error) {
                console.log('Token tekshirishda xato:', error);
            }
        }
        
        showLoginPage();
    }
    
    async function loginWithToken(user, token) {
        currentUser = user;
        currentToken = token;
        otherUser = currentUser.id === 1 ? 
            { id: 2, name: 'Jahongir' } : 
            { id: 1, name: 'Nafisa' };
        
        await updateOnlineStatus(true);
        showChatPage();
        loadMessages();
        loadUsers();
    }
    
    async function updateOnlineStatus(online) {
        try {
            await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, online })
            });
        } catch (error) {
            console.error('Online status yangilashda xato:', error);
        }
    }
    
    loginBtn.addEventListener('click', async function() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
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
                otherUser = currentUser.id === 1 ? 
                    { id: 2, name: 'Jahongir' } : 
                    { id: 1, name: 'Nafisa' };
                
                if (rememberMe.checked) {
                    localStorage.setItem('messenger_token', currentToken);
                    localStorage.setItem('messenger_user', JSON.stringify(currentUser));
                }
                
                await updateOnlineStatus(true);
                showChatPage();
                loadMessages();
                loadUsers();
            } else {
                alert('Login yoki parol noto\'g\'ri!');
            }
        } catch (error) {
            console.error('Login xatosi:', error);
            alert('Server bilan aloqa xatosi!');
        }
    });
    
    logoutBtn.addEventListener('click', async function() {
        await updateOnlineStatus(false);
        localStorage.removeItem('messenger_token');
        localStorage.removeItem('messenger_user');
        
        if (messageCheckInterval) clearInterval(messageCheckInterval);
        if (userCheckInterval) clearInterval(userCheckInterval);
        
        showLoginPage();
        currentUser = null;
        currentToken = null;
        otherUser = null;
        lastMessageId = 0;
        
        messagesContainer.innerHTML = '<div class="welcome-message"><h3>Xush kelibsiz!</h3><p>Xabarlar bu yerda ko\'rinadi...</p></div>';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    });
    
    async function loadMessages() {
        try {
            const response = await fetch('/api/messages');
            const messages = await response.json();
            
            const latestMessage = messages[messages.length - 1];
            if (latestMessage && latestMessage.id !== lastMessageId) {
                lastMessageId = latestMessage.id;
                displayMessages(messages);
                scrollToBottom();
                await checkAllMessages(messages);
            } else if (messages.length === 0 && lastMessageId !== 0) {
                displayMessages(messages);
                lastMessageId = 0;
            }
        } catch (error) {
            console.error('Xabarlarni yuklash xatosi:', error);
        }
    }
    
    function displayMessages(messages) {
        if (messages.length > 0) {
            const welcomeMessage = messagesContainer.querySelector('.welcome-message');
            if (welcomeMessage) welcomeMessage.remove();
        } else {
            if (!messagesContainer.querySelector('.welcome-message')) {
                messagesContainer.innerHTML = '<div class="welcome-message"><h3>Xush kelibsiz!</h3><p>Xabarlar bu yerda ko\'rinadi...</p></div>';
            }
            return;
        }
        
        messagesContainer.innerHTML = '';
        messages.forEach(message => addMessageToUI(message));
    }
    
    function addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.senderId === currentUser.id ? 'sent' : 'received'}`;
        messageElement.setAttribute('data-message-id', message.id);
        
        const messageTime = new Date(message.timestamp);
        const timeString = messageTime.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
        
        let seenStatus = '';
        if (message.senderId === currentUser.id) {
            if (message.seen && message.seenAt) {
                const seenTime = new Date(message.seenAt);
                const seenTimeString = seenTime.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
                seenStatus = `<div class="message-status seen">
                    <i class="fas fa-check-double"></i>
                    <span class="seen-text">ko'rildi ${seenTimeString}</span>
                </div>`;
            } else {
                seenStatus = `<div class="message-status">
                    <i class="fas fa-check"></i>
                </div>`;
            }
        }
        
        messageElement.innerHTML = `
            <div class="message-content">${message.content}</div>
            <div class="message-info">
                <div class="message-time">${timeString}</div>
                ${seenStatus}
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
    }
    
    sendBtn.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    async function sendMessage() {
        const content = messageInput.value.trim();
        if (!content) return;
        
        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: currentToken, content })
            });
            
            const data = await response.json();
            
            if (data.success) {
                messageInput.value = '';
                messageInput.focus();
                addMessageToUI(data.message);
                scrollToBottom();
                
                // 2 soniyadan keyin seen qilish
                setTimeout(async () => {
                    await markMessageAsSeen(data.message.id);
                }, 2000);
            }
        } catch (error) {
            console.error('Xabar yuborish xatosi:', error);
            alert('Xabar yuborishda xato!');
        }
    }
    
    async function markMessageAsSeen(messageId) {
        try {
            await fetch('/api/messages', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId, token: currentToken })
            });
        } catch (error) {
            console.error('Xabarni ko\'rilgan deb belgilash xatosi:', error);
        }
    }
    
    async function checkAllMessages(messages) {
        const theirMessages = messages.filter(m => 
            m.senderId === otherUser.id && !m.seen
        );
        
        for (const message of theirMessages) {
            await markMessageAsSeen(message.id);
        }
    }
    
    async function loadUsers() {
        try {
            const response = await fetch('/api/users');
            const users = await response.json();
            
            users.forEach(user => {
                updateUserStatus(user.id, user.online, user.lastSeen);
            });
        } catch (error) {
            console.error('Foydalanuvchilarni yuklash xatosi:', error);
        }
    }
    
    function updateUserStatus(userId, online, lastSeen) {
        if (otherUser && userId === otherUser.id) {
            if (online) {
                otherUserStatus.textContent = `${otherUser.name} onlayn`;
                otherUserStatus.style.color = '#4caf50';
            } else {
                const lastSeenDate = new Date(lastSeen);
                const timeString = lastSeenDate.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
                otherUserStatus.textContent = `${otherUser.name} oxirgi marta ${timeString}`;
                otherUserStatus.style.color = '#65676b';
            }
        }
        
        if (currentUser && userId === currentUser.id) {
            currentUserAvatar.textContent = currentUser.name.charAt(0);
        }
    }
    
    function showLoginPage() {
        chatContainer.style.display = 'none';
        loginContainer.style.display = 'block';
        document.getElementById('username').focus();
    }
    
    function showChatPage() {
        loginContainer.style.display = 'none';
        chatContainer.style.display = 'block';
        
        currentUserName.textContent = currentUser.name;
        currentUserAvatar.textContent = currentUser.name.charAt(0);
        currentUserAvatar.title = currentUser.name;
        
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
        
        if (messageCheckInterval) clearInterval(messageCheckInterval);
        messageCheckInterval = setInterval(loadMessages, 2000);
        
        if (userCheckInterval) clearInterval(userCheckInterval);
        userCheckInterval = setInterval(loadUsers, 3000);
    }
    
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });
    
    document.getElementById('username').focus();
});