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
    let socket = null;
    let messageCheckInterval = null;
    
    // Sahifa yuklanganda avtomatik login
    autoLogin();
    
    // Avtomatik login funksiyasi
    async function autoLogin() {
        const savedToken = localStorage.getItem('messenger_token');
        const savedUser = localStorage.getItem('messenger_user');
        
        if (savedToken && savedUser) {
            try {
                // Tokenni tekshirish
                const response = await fetch('/api/verify-token', {
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
            { id: 2, name: 'Jahongir', username: 'jahongir_177' } : 
            { id: 1, name: 'Nafisa', username: 'nafisa_177' };
        
        showChatPage();
        
        // WebSocket ulanishini o'rnatish
        setupWebSocket();
        
        // Xabarlarni yuklash
        loadMessages();
        
        // Foydalanuvchilar holatini yuklash
        loadUsers();
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
                    { id: 2, name: 'Jahongir', username: 'jahongir_177' } : 
                    { id: 1, name: 'Nafisa', username: 'nafisa_177' };
                
                // Eshatib qolish
                if (rememberMe.checked) {
                    localStorage.setItem('messenger_token', currentToken);
                    localStorage.setItem('messenger_user', JSON.stringify(currentUser));
                }
                
                showChatPage();
                
                // WebSocket ulanishini o'rnatish
                setupWebSocket();
                
                // Xabarlarni yuklash
                loadMessages();
                
                // Foydalanuvchilar holatini yuklash
                loadUsers();
            } else {
                alert('Login yoki parol noto\'g\'ri!');
            }
        } catch (error) {
            console.error('Login xatosi:', error);
            alert('Server bilan aloqa xatosi!');
        }
    });
    
    // Logout funksiyasi
    logoutBtn.addEventListener('click', function() {
        // Saqlangan ma'lumotlarni o'chirish
        localStorage.removeItem('messenger_token');
        localStorage.removeItem('messenger_user');
        
        // Intervallarni to'xtatish
        if (messageCheckInterval) clearInterval(messageCheckInterval);
        
        // WebSocket ulanishini yopish
        if (socket) socket.close();
        
        // Login sahifasiga qaytish
        showLoginPage();
        
        // Ma'lumotlarni tozalash
        currentUser = null;
        currentToken = null;
        otherUser = null;
        
        // Xabarlar maydonini tozalash
        messagesContainer.innerHTML = '<div class="welcome-message"><h3>Xush kelibsiz!</h3><p>Xabarlar bu yerda ko\'rinadi...</p></div>';
        
        // Input maydonlarini tozalash
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    });
    
    // WebSocket ulanishini o'rnatish
    function setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        socket = new WebSocket(wsUrl);
        
        socket.onopen = function() {
            console.log('WebSocket ulandi');
            // User ID ni serverga yuborish
            socket.send(JSON.stringify({
                type: 'register',
                userId: currentUser.id
            }));
        };
        
        socket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };
        
        socket.onclose = function() {
            console.log('WebSocket ulanishi uzildi');
            // 5 soniyadan keyin qayta ulanishni sinash
            setTimeout(setupWebSocket, 5000);
        };
        
        socket.onerror = function(error) {
            console.error('WebSocket xatosi:', error);
        };
    }
    
    // WebSocket xabarlarini qayta ishlash
    function handleWebSocketMessage(data) {
        switch (data.type) {
            case 'new_message':
                addMessageToUI(data.message);
                // Agar xabar boshqa foydalanuvchidan bo'lsa va men onlayn bo'lsam, ko'rilgan deb belgilash
                if (data.message.senderId !== currentUser.id && socket.readyState === WebSocket.OPEN) {
                    markMessageAsSeen(data.message.id);
                }
                break;
                
            case 'message_seen':
                updateMessageStatus(data.messageId, data.seenAt);
                break;
                
            case 'user_status':
                updateUserStatus(data.userId, data.online, data.lastSeen);
                break;
        }
    }
    
    // Xabarlarni yuklash
    async function loadMessages() {
        try {
            const response = await fetch('/api/messages');
            const messages = await response.json();
            
            // Agar xabarlar soni o'zgarmagan bo'lsa, yangilash shart emas
            if (messages.length === getMessageCountInUI()) {
                return;
            }
            
            // Xabarlarni UI ga chiqarish
            displayMessages(messages);
            
            // Oxirgi xabarga o'tish
            scrollToBottom();
            
            // Barcha xabarlarni tekshirish va ko'rilgan deb belgilash
            checkAllMessages(messages);
        } catch (error) {
            console.error('Xabarlarni yuklash xatosi:', error);
        }
    }
    
    // UI dagi xabarlar sonini olish
    function getMessageCountInUI() {
        const messages = messagesContainer.querySelectorAll('.message:not(.welcome-message)');
        return messages.length;
    }
    
    // Xabarlarni UI ga chiqarish
    function displayMessages(messages) {
        // Welcome xabarini olib tashlash (agar xabarlar mavjud bo'lsa)
        if (messages.length > 0) {
            const welcomeMessage = messagesContainer.querySelector('.welcome-message');
            if (welcomeMessage) {
                welcomeMessage.remove();
            }
        }
        
        // Avvalgi xabarlarni tozalash (faqat message class'li elementlarni)
        const oldMessages = messagesContainer.querySelectorAll('.message:not(.welcome-message)');
        oldMessages.forEach(msg => msg.remove());
        
        // Har bir xabarni chiqarish
        messages.forEach(message => {
            addMessageToUI(message);
        });
    }
    
    // Xabarni UI ga qo'shish
    function addMessageToUI(message) {
        // Xabar allaqachon mavjud bo'lmasligi kerak
        const existingMessage = document.querySelector(`[data-message-id="${message.id}"]`);
        if (existingMessage) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.senderId === currentUser.id ? 'sent' : 'received'}`;
        messageElement.setAttribute('data-message-id', message.id);
        
        // Vaqtni formatlash
        const messageTime = new Date(message.timestamp);
        const timeString = messageTime.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
        
        // Ko'rilganlik holati
        let seenStatus = '';
        if (message.senderId === currentUser.id) {
            if (message.seen) {
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
                // Xabar UI ga WebSocket orqali qo'shiladi
                scrollToBottom();
            }
        } catch (error) {
            console.error('Xabar yuborish xatosi:', error);
            alert('Xabar yuborishda xato!');
        }
    }
    
    // Xabarni ko'rilgan deb belgilash
    async function markMessageAsSeen(messageId) {
        try {
            await fetch(`/api/messages/${messageId}/seen`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token: currentToken })
            });
        } catch (error) {
            console.error('Xabarni ko\'rilgan deb belgilash xatosi:', error);
        }
    }
    
    // Barcha xabarlarni tekshirish
    async function checkAllMessages(messages) {
        // Barcha o'z xabarlarimni tekshirish
        const myUnseenMessages = messages.filter(m => 
            m.senderId === currentUser.id && !m.seen
        );
        
        // Agar boshqa foydalanuvchi onlayn bo'lsa, barcha xabarlarni ko'rilgan deb belgilash
        if (socket.readyState === WebSocket.OPEN && otherUser) {
            for (const message of myUnseenMessages) {
                await markMessageAsSeen(message.id);
            }
        }
        
        // Boshqa foydalanuvchining xabarlarini ko'rilgan deb belgilash
        const theirUnseenMessages = messages.filter(m => 
            m.senderId === otherUser.id && !m.seen && m.senderId !== currentUser.id
        );
        
        for (const message of theirUnseenMessages) {
            await markMessageAsSeen(message.id);
        }
    }
    
    // Xabar holatini yangilash
    function updateMessageStatus(messageId, seenAt) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const statusElement = messageElement.querySelector('.message-status:not(.seen)');
            if (statusElement) {
                const seenTime = new Date(seenAt);
                const seenTimeString = seenTime.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
                
                statusElement.className = 'message-status seen';
                statusElement.innerHTML = `
                    <i class="fas fa-check-double"></i>
                    <span class="seen-text">ko'rildi ${seenTimeString}</span>
                `;
            }
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
        currentUserAvatar.innerHTML = `<i class="fas fa-user"></i>`;
        currentUserAvatar.title = currentUser.name;
        
        // Input maydonini yoqish
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
        
        // Interval orqali xabarlarni tekshirish
        if (messageCheckInterval) clearInterval(messageCheckInterval);
        messageCheckInterval = setInterval(loadMessages, 2000);
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
    
    // Sayt yuklanganda parol maydoniga fokus
    document.getElementById('username').focus();
});