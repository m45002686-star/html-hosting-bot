const API_BASE = "https://yamensy-chat-zoon.hf.space";
const AI_BOT_ID = "65f1c2b3a4f5e6d7c8b9a012";

let currentUser = JSON.parse(localStorage.getItem("chat_zoon_user")) || null;
let isLoginMode = true;
let activeTarget = { type: 'room', id: 'room_general', name: 'العامة', desc: 'الرسائل الجارية' };
let attachedFileBase64 = null;
let attachedFileType = null;
let attachedFileName = null;
let pollingInterval = null;
let lastMessagesCount = 0; 
let lastMessageId = null;
let isWindowFocused = true;

// حالة تفعيل AI لكل محادثة خاصة
const aiToggleState = {};

const authScreen = document.getElementById("authScreen");
const appContainer = document.getElementById("appContainer");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const nameGroup = document.getElementById("nameGroup");
const authName = document.getElementById("authName");
const authUsername = document.getElementById("authUsername");
const authPassword = document.getElementById("authPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const toggleAuthLink = document.getElementById("toggleAuthLink");
const toggleAuthText = document.getElementById("toggleAuthText");

const messagesContainer = document.getElementById("messagesContainer");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const fileInput = document.getElementById("fileInput");
const filePreviewBar = document.getElementById("filePreviewBar");
const filePreviewName = document.getElementById("filePreviewName");
const removeFileBtn = document.getElementById("removeFileBtn");
const roomsList = document.getElementById("roomsList");
const usersList = document.getElementById("usersList");
const activeChatTitle = document.getElementById("activeChatTitle");
const activeChatDesc = document.getElementById("activeChatDesc");
const logoutBtn = document.getElementById("logoutBtn");

const randomChatBtn = document.getElementById("randomChatBtn");
const searchUserIdInput = document.getElementById("searchUserIdInput");
const searchUserBtn = document.getElementById("searchUserBtn");
const aiToggleBtn = document.getElementById("aiToggleBtn"); // زر التفعيل الجديد
const notificationSound = document.getElementById("notificationSound");

const sidebar = document.getElementById("sidebar");
const toggleSidebar = document.getElementById("toggleSidebar");
const closeSidebar = document.getElementById("closeSidebar");
const themeToggle = document.getElementById("themeToggle");

const savedTheme = localStorage.getItem("chat_zoon_theme") || "dark";
if (savedTheme === "light") {
    document.body.classList.add("light-mode");
    if (themeToggle) themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
}

if (themeToggle) {
    themeToggle.addEventListener("click", function() {
        document.body.classList.toggle("light-mode");
        let activeTheme = "dark";
        if (document.body.classList.contains("light-mode")) {
            activeTheme = "light";
            themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        } else {
            themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
        localStorage.setItem("chat_zoon_theme", activeTheme);
    });
}

function checkAuth() {
    if (currentUser) {
        authScreen.style.display = "none";
        appContainer.style.display = "flex";
        document.getElementById("myProfileName").textContent = currentUser.name;
        
        const tagBox = document.getElementById("myProfileTag");
        tagBox.textContent = `ID: ${currentUser._id}`;
        tagBox.onclick = function() {
            navigator.clipboard.writeText(currentUser._id);
            alert("تم نسخ معرّف الـ ID الشخصي بنجاح إلى الحافظة!");
        };
        
        document.getElementById("myAvatarLetter").textContent = currentUser.name.charAt(0).toUpperCase();
        initAppCore();
    } else {
        authScreen.style.display = "flex";
        appContainer.style.display = "none";
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }
}

toggleAuthLink.addEventListener("click", function(e) {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.textContent = "تسجيل الدخول";
        authSubtitle.textContent = "أدخل بيانات الحساب للوصول للمحادثات";
        nameGroup.style.display = "none";
        authSubmitBtn.textContent = "دخول";
        toggleAuthText.textContent = "ليس لديك حساب؟";
        toggleAuthLink.textContent = "إنشاء حساب";
    } else {
        authTitle.textContent = "إنشاء حساب";
        authSubtitle.textContent = "سجل حسابك لتبادل الرسائل والملفات";
        nameGroup.style.display = "block";
        authSubmitBtn.textContent = "تأكيد التسجيل";
        toggleAuthText.textContent = "لديك حساب بالفعل؟";
        toggleAuthLink.textContent = "تسجيل الدخول";
    }
});

authForm.addEventListener("submit", async function(e) {
    e.preventDefault();
    const username = authUsername.value.trim();
    const password = authPassword.value;
    const name = authName.value.trim();

    const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/register";
    const payload = isLoginMode ? { username, password } : { name, username, password };

    try {
        const res = await fetch(API_BASE + endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error("فشلت عملية التحقق، السيرفر عاد باستجابة غير صالحة.");
        }

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error("استجابة السيرفر الحالية غير مدعومة كـ JSON، قد تكون الاستضافة متوقفة حالياً.");
        }

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        localStorage.setItem("chat_zoon_user", JSON.stringify(data.user));
        currentUser = data.user;
        checkAuth();
    } catch (err) { 
        alert(err.message); 
    }
});

logoutBtn.addEventListener("click", function() {
    localStorage.removeItem("chat_zoon_user");
    currentUser = null;
    checkAuth();
});

function updateAiToggleButton() {
    if (!aiToggleBtn) return;
    // يظهر الزر فقط في المحادثات الخاصة مع مستخدمين آخرين (ليس AI وليس غرف)
    if (activeTarget.type === 'user' && activeTarget.id !== AI_BOT_ID) {
        aiToggleBtn.style.display = "flex";
        const isActive = aiToggleState[activeTarget.id] === true;
        aiToggleBtn.classList.toggle("active", isActive);
        aiToggleBtn.querySelector("span").textContent = isActive ? "إيقاف AI" : "تفعيل AI";
    } else {
        aiToggleBtn.style.display = "none";
    }
}

// زر AI Toggle
if (aiToggleBtn) {
    aiToggleBtn.addEventListener("click", function() {
        if (activeTarget.type !== 'user' || activeTarget.id === AI_BOT_ID) return;
        const newState = !aiToggleState[activeTarget.id];
        aiToggleState[activeTarget.id] = newState;
        updateAiToggleButton();
        alert(newState ? "تم تفعيل AI للمحادثة" : "تم إيقاف AI");
    });
}

function initAppCore() {
    loadRooms();
    loadUsersAndCore();
    syncMessages(true);
    
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(function() {
        syncMessages(false);
        loadUsersAndCore();
    }, 2000);
}

async function loadRooms() {
    try {
        const res = await fetch(API_BASE + "/api/rooms");
        if (!res.ok) return;
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) return;

        const rooms = await res.json();
        roomsList.innerHTML = "";
        
        rooms.forEach(function(room) {
            const div = document.createElement("div");
            const isActive = activeTarget.type === 'room' && activeTarget.id === room._id;
            div.className = `room-item ${isActive ? 'active' : ''}`;
            div.innerHTML = `<i class="fa-solid fa-hashtag"></i> <span>${room.name}</span>`;
            
            div.onclick = function() {
                activeTarget = { type: 'room', id: room._id, name: room.name, desc: 'الرسائل الجارية' };
                updateHeaderUI();
                syncMessages(true);
                document.querySelectorAll(".room-item, .user-item").forEach(function(el) {
                    el.classList.remove("active");
                });
                div.classList.add("active");
                if (window.innerWidth <= 768) sidebar.classList.remove("open");
                updateAiToggleButton();
            };
            roomsList.appendChild(div);
        });
    } catch (e) { 
        console.log("خطأ في جلب الغرف."); 
    }
}

async function loadUsersAndCore() {
    try {
        const res = await fetch(API_BASE + "/api/users");
        if (!res.ok) return;
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) return;

        const users = await res.json();
        usersList.innerHTML = "";

        const aiDiv = document.createElement("div");
        const isAiActive = activeTarget.id === AI_BOT_ID;
        aiDiv.className = `user-item ${isAiActive ? 'active' : ''}`;
        aiDiv.innerHTML = `<i class="fa-solid fa-robot" style="color: #b31b2a;"></i> <span style="font-weight:bold; color:#b31b2a;">DeepSeek AI</span>`;
        
        aiDiv.onclick = function() {
            activeTarget = { type: 'user', id: AI_BOT_ID, name: 'DeepSeek AI', desc: 'محادثة خاصة ومباشرة مع الذكاء الاصطناعي بذاكرة نشطة' };
            updateHeaderUI();
            syncMessages(true);
            document.querySelectorAll(".room-item, .user-item").forEach(function(el) {
                el.classList.remove("active");
            });
            aiDiv.classList.add("active");
            if (window.innerWidth <= 768) sidebar.classList.remove("open");
            updateAiToggleButton();
        };
        usersList.appendChild(aiDiv);

        const uniqueUserNames = new Set();

        users.forEach(function(user) {
            if (user._id === currentUser._id) return;
            
            const standardizedName = user.name.trim().toLowerCase();
            if (uniqueUserNames.has(standardizedName)) return;
            uniqueUserNames.add(standardizedName);

            const div = document.createElement("div");
            const isUserActive = activeTarget.type === 'user' && activeTarget.id === user._id;
            div.className = `user-item ${isUserActive ? 'active' : ''}`;
            div.innerHTML = `<i class="fa-solid fa-circle-user"></i> <span>${user.name}</span>`;
            
            div.onclick = function() {
                activeTarget = { type: 'user', id: user._id, name: user.name, desc: `محادثة خاصة` };
                updateHeaderUI();
                syncMessages(true);
                document.querySelectorAll(".room-item, .user-item").forEach(function(el) {
                    el.classList.remove("active");
                });
                div.classList.add("active");
                if (window.innerWidth <= 768) sidebar.classList.remove("open");
                updateAiToggleButton();
            };
            usersList.appendChild(div);
        });
    } catch (e) { 
        console.log("خطأ في تحديث واجهة المستخدمين."); 
    }
}

function updateHeaderUI() {
    activeChatTitle.textContent = activeTarget.name;
    activeChatDesc.textContent = activeTarget.desc;
}

searchUserBtn.addEventListener("click", async function() {
    const targetId = searchUserIdInput.value.trim();
    if (!targetId) return;
    if (targetId === currentUser._id) {
        alert("لا يمكنك مراسلة حسابك الشخصي!");
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/users`);
        if (!res.ok) throw new Error("فشل السيرفر في جلب البيانات.");
        
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) throw new Error("استجابة غير صالحة من السيرفر.");

        const users = await res.json();
        const targetUser = users.find(function(u) { return u._id === targetId; });

        if (!targetUser) throw new Error("عذراً، هذا الـ ID غير مسجل بالمنصة.");

        activeTarget = { type: 'user', id: targetUser._id, name: targetUser.name, desc: `محادثة خاصة` };
        
        searchUserIdInput.value = "";
        updateHeaderUI();
        loadUsersAndCore();
        syncMessages(true);
        updateAiToggleButton();
    } catch (err) { 
        alert(err.message); 
    }
});

randomChatBtn.addEventListener("click", async function() {
    randomChatBtn.disabled = true;
    randomChatBtn.classList.add("searching");
    randomChatBtn.innerHTML = `<i class="fa-solid fa-spinner"></i> <span>جاري البحث...</span>`;

    try {
        const res = await fetch(`${API_BASE}/api/users`);
        if (!res.ok) throw new Error("فشل في استلام الاتصال بالخادم.");
        const users = await res.json();

        const availablePartners = users.filter(function(user) { 
            return user._id !== currentUser._id; 
        });
        
        await new Promise(function(resolve) { setTimeout(resolve, 1200); });

        if (availablePartners.length === 0) {
            alert("لا يوجد مستخدمون متصلون حالياً لبدء شات عشوائي.");
            return;
        }

        const randomIndex = Math.floor(Math.random() * availablePartners.length);
        const randomPartner = availablePartners[randomIndex];

        activeTarget = { type: 'user', id: randomPartner._id, name: `شريك عشوائي: ${randomPartner.name}`, desc: `محادثة عشوائية` };
        
        updateHeaderUI();
        loadUsersAndCore();
        syncMessages(true);
        updateAiToggleButton();
    } catch (err) {
        alert("حدث خطأ أثناء محاولة التوصيل العشوائي.");
    } finally {
        randomChatBtn.disabled = false;
        randomChatBtn.classList.remove("searching");
        randomChatBtn.innerHTML = `<i class="fa-solid fa-shuffle"></i> <span>محادثة عشوائية</span>`;
    }
});

async function syncMessages(skipSound = false) {
    if (!currentUser) return;
    let url = API_BASE + "/api/messages?";
    if (activeTarget.type === 'room') {
        url += `roomId=${activeTarget.id}`;
    } else {
        url += `chatWith=${activeTarget.id}&myId=${currentUser._id}`;
    }

    try {
        const res = await fetch(url);
        if (!res.ok) return;
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) return;

        const messages = await res.json();
        
        if (!skipSound && messages.length > lastMessagesCount) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg && lastMsg.sender_id !== currentUser._id) {
                notificationSound.play().catch(function() {});
                document.title = "🔔 رسالة جديدة!";
                setTimeout(function() { document.title = "Chat Zoon"; }, 3000);
            }
        }
        lastMessagesCount = messages.length;

        // بعد تحديث الرسائل، إذا كان AI مفعلًا وآخر رسالة من الطرف الآخر، استدعاء AI تلقائيًا
        if (activeTarget.type === 'user' && activeTarget.id !== AI_BOT_ID && aiToggleState[activeTarget.id]) {
            const latestMsg = messages[messages.length - 1];
            if (latestMsg && latestMsg.sender_id !== currentUser._id && !latestMsg.is_ai && latestMsg.sender_id !== AI_BOT_ID) {
                // تأكد من أننا لم نعالج هذه الرسالة مسبقاً
                if (latestMsg._id !== lastAiProcessedId) {
                    lastAiProcessedId = latestMsg._id;
                    triggerAiInChat(latestMsg.text);
                }
            }
        }

        const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop <= messagesContainer.clientHeight + 100;

        messagesContainer.innerHTML = "";
        
        messages.forEach(function(msg) {
            const isMe = msg.sender_id === currentUser._id;
            const bubble = document.createElement("div");
            
            let isAiNode = msg.is_ai || msg.sender_id === AI_BOT_ID;
            bubble.className = `message-bubble ${isMe ? 'outgoing' : 'incoming'} ${isAiNode ? 'ai-message' : ''}`;

            const timeString = new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
            
            let mediaMarkup = "";
            if (msg.mediaData && msg.mediaType) {
                if (msg.mediaType.startsWith('image/')) {
                    mediaMarkup = `<img src="${msg.mediaData}" class="bubble-img" onclick="window.open('${msg.mediaData}')">`;
                } else {
                    mediaMarkup = `
                        <div class="file-attachment-box">
                            <i class="fa-solid fa-file-invoice" style="font-size:1.2rem; color:#b31b2a; margin-left:10px;"></i>
                            <a href="${msg.mediaData}" download="${msg.fileName || 'document'}" class="file-download-link">
                                تحميل: ${msg.fileName || 'ملف مرفق'} <i class="fa-solid fa-download"></i>
                            </a>
                        </div>`;
                }
            }

            bubble.innerHTML = `
                <div class="bubble-meta">${msg.sender_name} • ${timeString}</div>
                <div class="bubble-content">
                    <div>${msg.text}</div>
                    ${mediaMarkup}
                </div>
            `;
            messagesContainer.appendChild(bubble);
        });

        if (isAtBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } catch (e) { 
        console.log("خطأ في مزامنة الرسائل."); 
    }
}

let lastAiProcessedId = null; // لتجنب تكرار استدعاء AI لنفس الرسالة

async function compileConversationMemory() {
    let memoryUrl = API_BASE + "/api/messages?";
    if (activeTarget.type === 'room') {
        memoryUrl += `roomId=${activeTarget.id}`;
    } else {
        memoryUrl += `chatWith=${activeTarget.id}&myId=${currentUser._id}`;
    }
    
    try {
        const response = await fetch(memoryUrl);
        if (!response.ok) return "";
        
        const historyData = await response.json();
        if (!Array.isArray(historyData) || historyData.length === 0) return "";
        
        const limitedHistory = historyData.slice(-15);
        let memoryPayload = "تاريخ وسياق المحادثة السابقة لتتذكرها وتجيب بناء عليها:\n";
        
        limitedHistory.forEach(function(record) {
            let isAiSender = record.is_ai || record.sender_id === AI_BOT_ID;
            let identity = isAiSender ? "الذكاء الاصطناعي" : `المستخدم (${record.sender_name})`;
            memoryPayload += `[${identity}]: ${record.text}\n`;
        });
        
        memoryPayload += "\nانتهى سياق المحادثة المكتوب بالأعلى. الآن أجب مباشرة على السؤال التالي والجديد للمستخدم معتمداً على هذا السياق:\n";
        return memoryPayload;
    } catch (memoryError) {
        return "";
    }
}

async function handleSendMessage() {
    const text = messageInput.value.trim();
    if (!text && !attachedFileBase64) return;

    const isAiMentioned = text.toLowerCase().includes("@ai");
    const isDirectAiRoom = activeTarget.id === AI_BOT_ID;

    const payload = {
        sender_id: currentUser._id,
        sender_name: currentUser.name,
        text: text,
        room_id: activeTarget.type === 'room' ? activeTarget.id : null,
        receiver_id: activeTarget.type !== 'room' ? activeTarget.id : null,
        mediaData: attachedFileBase64,
        mediaType: attachedFileType,
        fileName: attachedFileName
    };

    messageInput.value = "";
    attachedFileBase64 = null;
    attachedFileType = null;
    attachedFileName = null;
    filePreviewBar.style.display = "none";
    fileInput.value = "";

    try {
        const res = await fetch(API_BASE + "/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            syncMessages(true);
            // استدعاء AI حسب الحالة
            if (isDirectAiRoom || (activeTarget.type === 'user' && activeTarget.id !== AI_BOT_ID && aiToggleState[activeTarget.id])) {
                triggerAiInChat(text);
            } else if (isAiMentioned) {
                triggerAiInChat(text.replace("@ai", "").trim());
            }
        }
    } catch (err) { 
        console.log("فشل السيرفر في إرسال الرسالة."); 
    }
}

async function triggerAiInChat(promptText) {
    const cleanPrompt = promptText.replace("@ai", "").trim();
    const conversationalHistoryContext = await compileConversationMemory();
    const combinedPromptPayload = conversationalHistoryContext + cleanPrompt;

    try {
        await fetch(API_BASE + "/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: combinedPromptPayload,
                model: "deepseek/deepseek-chat", 
                room_id: activeTarget.type === 'room' ? activeTarget.id : null,
                receiver_id: activeTarget.type !== 'room' ? activeTarget.id : null
            })
        });
        syncMessages(true);
    } catch (e) { 
        console.log("فشل الـ AI في الاستجابة."); 
    }
}

fileInput.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (!file || file.type.startsWith('video/')) return;

    attachedFileName = file.name;
    attachedFileType = file.type;
    
    const reader = new FileReader();
    reader.onloadend = function() {
        attachedFileBase64 = reader.result;
        filePreviewName.textContent = file.name;
        filePreviewBar.style.display = "flex";
    };
    reader.readAsDataURL(file);
});

removeFileBtn.addEventListener("click", function() {
    attachedFileBase64 = null; 
    filePreviewBar.style.display = "none";
    fileInput.value = "";
});

sendBtn.addEventListener("click", handleSendMessage);
messageInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { 
        e.preventDefault(); 
        handleSendMessage(); 
    }
});

if (toggleSidebar) toggleSidebar.addEventListener("click", function() { sidebar.classList.add("open"); });
if (closeSidebar) closeSidebar.addEventListener("click", function() { sidebar.classList.remove("open"); });

window.addEventListener("focus", function() { isWindowFocused = true; });
window.addEventListener("blur", function() { isWindowFocused = false; });

checkAuth();