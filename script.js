document.addEventListener('DOMContentLoaded', function() {
    // DOM elementlari
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
    
    // Global o'zgaruvchilar
    let currentUser = null;
    let currentToken = null;
    let otherUser = null;
    let messageCheckInterval = null;
    let userCheckInterval = null;
    let pingInterval = null;
    let lastMessageId = 0;
    
    // Sahifa yuklanganda avtomatik login
    autoLogin();
    
    // Avtomatik login funksiyasi
    async function autoLogin() {
        const savedToken = localStorage.getItem('messenger_token');
        const savedUser = localStorage.getItem('messenger_user');
        
        if (savedToken && savedUser) {
            try {
                // Tokenni tekshirish
                const response = await fetch('/api/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token: savedToken })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.valid) {
                        // Token yaroqli, avtomatik login
                        const user = JSON.parse(savedUser);
                        await loginWithToken(user, savedToken);
                        return;
                    }
                }
            } catch (error) {
                console.log('Token tekshirishda xato:', error);
            }
        }
        
        // Agar token saqlanmagan bo'lsa yoki yaroqsiz bo'lsa
        showLoginPage();
    }
    
    // Token bilan login qilish
    async function loginWithToken(user, token) {
        currentUser = user;
        currentToken = token;
        
        // Boshqa foydalanuvchini aniqlash
        otherUser = currentUser.id === 1 ? 
            { id: 2, name: 'Jahongir' } : 
            { id: 1, name: 'Nafisa' };
        
        // Clientni register qilish (WebSocket simulation)
        await registerClient();
        
        showChatPage();
        
        // Xabarlarni yuklash
        loadMessages();
        
        // Foydalanuvchilar holatini yuklash
        loadUsers();
        
        // Intervallarni boshlash
        startIntervals();
        
        // Barcha xabarlarni ko'rilgan deb belgilash
        await markAllMessagesAsSeen();
    }
    
    // Clientni register qilish
    async function registerClient() {
        try {
            await fetch('/api/register-client', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: currentUser.id })
            });
        } catch (error) {
            console.error('Client register xatosi:', error);
        }
    }
    
    // Ping yuborish (connectionni saqlash)
    async function sendPing() {
        try {
            await fetch('/api/ping', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: currentUser.id })
            });
        } catch (error) {
            console.error('Ping xatosi:', error);
        }
    }
    
    // Login funksiyasi
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
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentUser = data.user;
                currentToken = data.token;
                
                // Boshqa foydalanuvchini aniqlash
                otherUser = currentUser.id === 1 ? 
                    { id: 2, name: 'Jahongir' } : 
                    { id: 1, name: 'Nafisa' };
                
                // Eshatib qolish
                if (rememberMe.checked) {
                    localStorage.setItem('messenger_token', currentToken);
                    localStorage.setItem('messenger_user', JSON.stringify(currentUser));
                }
                
                // Clientni register qilish
                await registerClient();
                
                showChatPage();
                
                // Xabarlarni yuklash
                loadMessages();
                
                // Foydalanuvchilar holatini yuklash
                loadUsers();
                
                // Intervallarni boshlash
                startIntervals();
                
                // Barcha xabarlarni ko'rilgan deb belgilash
                await markAllMessagesAsSeen();
            } else {
                alert('Login yoki parol noto\'g\'ri!');
            }
        } catch (error) {
            console.error('Login xatosi:', error);
            alert('Server bilan aloqa xatosi!');
        }
    });
    
    // Logout funksiyasi
    logoutBtn.addEventListener('click', async function() {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: currentToken })
            });
        } catch (error) {
            console.error('Logout xatosi:', error);
        }
        
        // Saqlangan ma'lumotlarni o'chirish
        localStorage.removeItem('messenger_token');
        localStorage.removeItem('messenger_user');
        
        // Intervallarni to'xtatish
        stopIntervals();
        
        // Login sahifasiga qaytish
        showLoginPage();
        
        // Ma'lumotlarni tozalash
        currentUser = null;
        currentToken = null;
        otherUser = null;
        lastMessageId = 0;
        
        // Xabarlar maydonini tozalash
        messagesContainer.innerHTML = '<div class="welcome-message"><h3>Xush kelibsiz!</h3><p>Xabarlar bu yerda ko\'rinadi...</p></div>';
        
        // Input maydonlarini tozalash
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    });
    
    // Xabarlarni yuklash
    async function loadMessages() {
        try {
            const response = await fetch('/api/messages');
            const messages = await response.json();
            
            // Oxirgi xabarni topish
            const latestMessage = messages[messages.length - 1];
            if (latestMessage && latestMessage.id !== lastMessageId) {
                lastMessageId = latestMessage.id;
                
                // Xabarlarni UI ga chiqarish
                displayMessages(messages);
                
                // Oxirgi xabarga o'tish
                scrollToBottom();
            }
        } catch (error) {
            console.error('Xabarlarni yuklash xatosi:', error);
        }
    }
    
    // Xabarlarni UI ga chiqarish
    function displayMessages(messages) {
        // Welcome xabarini olib tashlash (agar xabarlar mavjud bo'lsa)
        if (messages.length > 0) {
            const welcomeMessage = messagesContainer.querySelector('.welcome-message');
            if (welcomeMessage) {
                welcomeMessage.remove();
            }
        } else {
            // Xabarlar bo'sh bo'lsa, welcome message qo'shish
            if (!messagesContainer.querySelector('.welcome-message')) {
                messagesContainer.innerHTML = '<div class="welcome-message"><h3>Xush kelibsiz!</h3><p>Xabarlar bu yerda ko\'rinadi...</p></div>';
            }
            return;
        }
        
        // Avvalgi xabarlarni tozalash
        messagesContainer.innerHTML = '';
        
        // Har bir xabarni chiqarish
        messages.forEach(message => {
            addMessageToUI(message);
        });
    }
    
    // Xabarni UI ga qo'shish
    function addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.senderId === currentUser.id ? 'sent' : 'received'}`;
        messageElement.setAttribute('data-message-id', message.id);
        
        // Vaqtni formatlash
        const messageTime = new Date(message.timestamp);
        const timeString = messageTime.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
        
        // Ko'rilganlik holati
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
    
    // Xabar yuborish
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
                messageInput.value = '';
                messageInput.focus();
                
                // Xabar UI ga qo'shish
                addMessageToUI(data.message);
                scrollToBottom();
                
                // Boshqa foydalanuvchi xabarni o'qiganda, seen bo'ladi
                // (Bu polling orqali tekshiriladi)
            }
        } catch (error) {
            console.error('Xabar yuborish xatosi:', error);
            alert('Xabar yuborishda xato!');
        }
    }
    
    // Xabarni ko'rilgan deb belgilash
    async function markMessageAsSeen(messageId) {
        try {
            await fetch('/api/messages/seen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    messageId: messageId, 
                    token: currentToken 
                })
            });
        } catch (error) {
            console.error('Xabarni ko\'rilgan deb belgilash xatosi:', error);
        }
    }
    
    // Barcha xabarlarni ko'rilgan deb belgilash
    async function markAllMessagesAsSeen() {
        try {
            await fetch('/api/messages/mark-all-seen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    token: currentToken 
                })
            });
        } catch (error) {
            console.error('Barcha xabarlarni ko\'rilgan deb belgilash xatosi:', error);
        }
    }
    
    // Foydalanuvchilarni yuklash
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
    
    // Foydalanuvchi holatini yangilash
    function updateUserStatus(userId, online, lastSeen) {
        // Boshqa foydalanuvchi
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
        
        // O'zimning holatim
        if (currentUser && userId === currentUser.id) {
            currentUserAvatar.textContent = currentUser.name.charAt(0);
        }
    }
    
    // Intervallarni boshlash
    function startIntervals() {
        stopIntervals(); // Avvalgi intervallarni tozalash
        
        // Xabarlarni tekshirish
        messageCheckInterval = setInterval(loadMessages, 1000);
        
        // Foydalanuvchilarni tekshirish
        userCheckInterval = setInterval(loadUsers, 3000);
        
        // Ping yuborish (connectionni saqlash)
        pingInterval = setInterval(sendPing, 15000);
    }
    
    // Intervallarni to'xtatish
    function stopIntervals() {
        if (messageCheckInterval) clearInterval(messageCheckInterval);
        if (userCheckInterval) clearInterval(userCheckInterval);
        if (pingInterval) clearInterval(pingInterval);
        
        messageCheckInterval = null;
        userCheckInterval = null;
        pingInterval = null;
    }
    
    // Login sahifasini ko'rsatish
    function showLoginPage() {
        chatContainer.style.display = 'none';
        loginContainer.style.display = 'block';
        document.getElementById('username').focus();
    }
    
    // Chat sahifasini ko'rsatish
    function showChatPage() {
        loginContainer.style.display = 'none';
        chatContainer.style.display = 'block';
        
        // UI ni yangilash
        currentUserName.textContent = currentUser.name;
        currentUserAvatar.textContent = currentUser.name.charAt(0);
        currentUserAvatar.title = currentUser.name;
        
        // Input maydonini yoqish
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
    
    // Pastga o'tish
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Enter tugmasi bilan login
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });
    
    // Sayt yuklanganda username maydoniga fokus
    document.getElementById('username').focus();
});