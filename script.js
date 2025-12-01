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
    
    // Test API connection
    testAPI();
    
    // Avtomatik login
    autoLogin();
    
    // Test API connection
    async function testAPI() {
        try {
            console.log('Testing API connection...');
            const response = await fetch('/api/test');
            if (response.ok) {
                const data = await response.json();
                console.log('API test result:', data);
            } else {
                console.log('API test failed:', response.status);
            }
        } catch (error) {
            console.log('API test error:', error);
        }
    }
    
    // Avtomatik login funksiyasi
    async function autoLogin() {
        console.log('Auto login started...');
        const savedToken = localStorage.getItem('messenger_token');
        const savedUser = localStorage.getItem('messenger_user');
        
        if (savedToken && savedUser) {
            console.log('Found saved credentials');
            try {
                const response = await fetch('/api/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token: savedToken })
                });
                
                console.log('Verify response status:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Verify response:', data);
                    
                    if (data.valid) {
                        console.log('Token valid, logging in...');
                        const user = JSON.parse(savedUser);
                        await loginWithToken(user, savedToken);
                        return;
                    } else {
                        console.log('Token invalid');
                    }
                } else {
                    console.log('Verify request failed:', response.status);
                }
            } catch (error) {
                console.log('Auto login error:', error);
            }
        } else {
            console.log('No saved credentials found');
        }
        
        showLoginPage();
    }
    
    // Token bilan login qilish
    async function loginWithToken(user, token) {
        console.log('Login with token:', user.name);
        currentUser = user;
        currentToken = token;
        
        // Boshqa foydalanuvchini aniqlash
        otherUser = currentUser.id === 1 ? 
            { id: 2, name: 'Jahongir' } : 
            { id: 1, name: 'Nafisa' };
        
        // Update online status
        try {
            await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    userId: currentUser.id, 
                    online: true 
                })
            });
            console.log('Online status updated');
        } catch (error) {
            console.log('Online status update error:', error);
        }
        
        showChatPage();
        await loadMessages();
        await loadUsers();
        
        // Start intervals
        startIntervals();
    }
    
    // Login funksiyasi
    loginBtn.addEventListener('click', async function() {
        console.log('Login button clicked');
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!username || !password) {
            alert('Login va parolni kiriting!');
            return;
        }
        
        console.log('Attempting login with:', username);
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            console.log('Login response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Login response data:', data);
            
            if (data.success) {
                console.log('Login successful!');
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
                
                // Update online status
                try {
                    await fetch('/api/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: currentUser.id, online: true })
                    });
                } catch (error) {
                    console.log('Status update error:', error);
                }
                
                showChatPage();
                await loadMessages();
                await loadUsers();
                
                // Start intervals
                startIntervals();
            } else {
                console.log('Login failed');
                alert('Login yoki parol noto\'g\'ri!');
            }
        } catch (error) {
            console.error('Login xatosi:', error);
            alert('Server bilan aloqa xatosi! ' + error.message);
        }
    });
    
    // Logout funksiyasi
    logoutBtn.addEventListener('click', async function() {
        console.log('Logout clicked');
        
        if (currentUser) {
            // Update online status
            try {
                await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, online: false })
                });
            } catch (error) {
                console.log('Status update error:', error);
            }
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
        
        // Xabarlar maydonini tozalash
        messagesContainer.innerHTML = '<div class="welcome-message"><h3>Xush kelibsiz!</h3><p>Xabarlar bu yerda ko\'rinadi...</p></div>';
        
        // Input maydonlarini tozalash
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    });
    
    // Xabarlarni yuklash
    async function loadMessages() {
        try {
            console.log('Loading messages...');
            const response = await fetch('/api/messages');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const messages = await response.json();
            console.log('Messages loaded:', messages.length);
            
            displayMessages(messages);
            scrollToBottom();
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
        
        console.log('Sending message:', content);
        
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
            
            console.log('Send message response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Send message response:', data);
            
            if (data.success) {
                messageInput.value = '';
                messageInput.focus();
                addMessageToUI(data.message);
                scrollToBottom();
                console.log('Message sent successfully');
            } else {
                alert('Xabar yuborishda xato: ' + (data.message || 'Noma\'lum xato'));
            }
        } catch (error) {
            console.error('Xabar yuborish xatosi:', error);
            alert('Xabar yuborishda xato! ' + error.message);
        }
    }
    
    // Foydalanuvchilarni yuklash
    async function loadUsers() {
        try {
            const response = await fetch('/api/users');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
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
        
        console.log('Starting intervals...');
        messageCheckInterval = setInterval(loadMessages, 2000);
        userCheckInterval = setInterval(loadUsers, 5000);
        
        console.log('Intervals started');
    }
    
    // Intervallarni to'xtatish
    function stopIntervals() {
        if (messageCheckInterval) {
            clearInterval(messageCheckInterval);
            messageCheckInterval = null;
        }
        
        if (userCheckInterval) {
            clearInterval(userCheckInterval);
            userCheckInterval = null;
        }
        
        console.log('Intervals stopped');
    }
    
    // Login sahifasini ko'rsatish
    function showLoginPage() {
        console.log('Showing login page');
        chatContainer.style.display = 'none';
        loginContainer.style.display = 'block';
        document.getElementById('username').focus();
    }
    
    // Chat sahifasini ko'rsatish
    function showChatPage() {
        console.log('Showing chat page');
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
        
        console.log('Chat page ready for:', currentUser.name);
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