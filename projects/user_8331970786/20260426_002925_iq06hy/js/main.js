// ============== البيانات الأساسية ==============
let users = JSON.parse(localStorage.getItem('bamatech_users_final')) || [
    { id: 1, username: 'owner', name: 'مالك المنصة', password: 'owner123', isOwner: true, isAdmin: true, verified: true, verifiedPlus: true, bio: '👑 مؤسس BAMA TECH', avatar: '', banned: false, createdAt: Date.now() },
    { id: 2, username: 'admin1', name: 'أمير الإدمن', password: 'admin123', isOwner: false, isAdmin: true, verified: true, verifiedPlus: true, bio: 'مدير عام المنصة', avatar: '', banned: false, createdAt: Date.now() },
    { id: 3, username: 'admin2', name: 'المشرف العام', password: 'admin123', isOwner: false, isAdmin: true, verified: true, verifiedPlus: false, bio: 'مراقب المحتوى', avatar: '', banned: false, createdAt: Date.now() },
];

let posts = JSON.parse(localStorage.getItem('bamatech_posts_final')) || [];
let messages = JSON.parse(localStorage.getItem('bamatech_messages')) || [];
let notifications = JSON.parse(localStorage.getItem('bamatech_notifications')) || [];
let advertisements = JSON.parse(localStorage.getItem('bamatech_ads')) || [];
let contests = JSON.parse(localStorage.getItem('bamatech_contests')) || [];

let currentUserId = null;

// ============== دوال مساعدة ==============
function saveData() {
    localStorage.setItem('bamatech_users_final', JSON.stringify(users));
    localStorage.setItem('bamatech_posts_final', JSON.stringify(posts));
    localStorage.setItem('bamatech_messages', JSON.stringify(messages));
    localStorage.setItem('bamatech_notifications', JSON.stringify(notifications));
    localStorage.setItem('bamatech_ads', JSON.stringify(advertisements));
    localStorage.setItem('bamatech_contests', JSON.stringify(contests));
}

function getUserById(id) {
    return users.find(u => u.id === id);
}

function showToast(message, type = 'success') {
    let toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============== دوال تسجيل الدخول والتسجيل ==============
function registerUser(username, name, password) {
    let existingUser = users.find(u => u.username === username);
    if(existingUser) {
        showToast('اسم المستخدم موجود بالفعل!', 'error');
        return false;
    }
    
    let newUser = {
        id: Date.now(),
        username: username,
        name: name,
        password: password,
        isOwner: false,
        isAdmin: false,
        verified: false,
        verifiedPlus: false,
        bio: 'مرحباً، أنا جديد في BAMA TECH',
        avatar: '',
        banned: false,
        createdAt: Date.now()
    };
    
    users.push(newUser);
    saveData();
    showToast('تم التسجيل بنجاح! يمكنك تسجيل الدخول الآن');
    return true;
}

function loginUser(username, password) {
    let user = users.find(u => u.username === username && u.password === password);
    if(!user) {
        showToast('اسم المستخدم أو كلمة المرور غير صحيحة', 'error');
        return null;
    }
    if(user.banned) {
        showToast('هذا الحساب محظور من قبل الإدارة', 'error');
        return null;
    }
    currentUserId = user.id;
    localStorage.setItem('currentUserId', currentUserId);
    showToast(`مرحباً ${user.name} 👋`);
    return user;
}

function logout() {
    currentUserId = null;
    localStorage.removeItem('currentUserId');
    showToast('تم تسجيل الخروج بنجاح');
    window.location.href = '../index.html';
}

// ============== دوال المنشورات ==============
function createPost(content, image = '') {
    if(!content.trim()) {
        showToast('الرجاء كتابة محتوى المنشور', 'error');
        return false;
    }
    
    let newPost = {
        id: Date.now(),
        userId: currentUserId,
        content: content,
        image: image,
        timestamp: Date.now(),
        likes: [],
        comments: []
    };
    
    posts.unshift(newPost);
    saveData();
    showToast('تم نشر المنشور بنجاح ✨');
    return true;
}

function deletePost(postId) {
    let post = posts.find(p => p.id === postId);
    let currentUser = getUserById(currentUserId);
    
    if(post && (currentUser.isAdmin || currentUser.isOwner || post.userId === currentUserId)) {
        posts = posts.filter(p => p.id !== postId);
        saveData();
        showToast('تم حذف المنشور');
        return true;
    }
    return false;
}

function toggleLike(postId) {
    let post = posts.find(p => p.id === postId);
    if(post) {
        let likeIndex = post.likes.indexOf(currentUserId);
        if(likeIndex === -1) {
            post.likes.push(currentUserId);
            if(post.userId !== currentUserId) {
                addNotification(post.userId, `${getUserById(currentUserId).name} أعجب بمنشورك`);
            }
        } else {
            post.likes.splice(likeIndex, 1);
        }
        saveData();
        return true;
    }
    return false;
}

function addComment(postId, commentText) {
    if(!commentText.trim()) {
        showToast('الرجاء كتابة تعليق', 'error');
        return false;
    }
    
    let post = posts.find(p => p.id === postId);
    if(post) {
        post.comments.push({
            userId: currentUserId,
            text: commentText,
            timestamp: Date.now()
        });
        
        if(post.userId !== currentUserId) {
            addNotification(post.userId, `${getUserById(currentUserId).name} علق على منشورك: "${commentText.slice(0,50)}"`);
        }
        
        saveData();
        showToast('تم إضافة التعليق');
        return true;
    }
    return false;
}

// ============== دوال الإشعارات ==============
function addNotification(userId, message) {
    notifications.unshift({
        id: Date.now(),
        userId: userId,
        message: message,
        read: false,
        timestamp: Date.now()
    });
    saveData();
}

function getNotifications(userId) {
    return notifications.filter(n => n.userId === userId);
}

function markNotificationAsRead(notificationId) {
    let notif = notifications.find(n => n.id === notificationId);
    if(notif) notif.read = true;
    saveData();
}

// ============== دوال الدردشة ==============
function sendMessage(toUserId, text) {
    if(!text.trim()) return false;
    
    messages.push({
        id: Date.now(),
        from: currentUserId,
        to: toUserId,
        text: text,
        timestamp: Date.now(),
        read: false
    });
    
    addNotification(toUserId, `📩 رسالة جديدة من ${getUserById(currentUserId).name}`);
    saveData();
    return true;
}

function getConversation(userId1, userId2) {
    return messages.filter(m => 
        (m.from === userId1 && m.to === userId2) ||
        (m.from === userId2 && m.to === userId1)
    ).sort((a,b) => a.timestamp - b.timestamp);
}

// ============== دوال الإدمن ==============
function verifyUser(targetUserId) {
    let currentUser = getUserById(currentUserId);
    if(!currentUser.isAdmin && !currentUser.isOwner) return false;
    
    let targetUser = getUserById(targetUserId);
    if(targetUser && !targetUser.isOwner) {
        targetUser.verified = !targetUser.verified;
        saveData();
        addNotification(targetUserId, `تم ${targetUser.verified ? 'توثيق' : 'إلغاء توثيق'} حسابك بواسطة الإدارة`);
        showToast(targetUser.verified ? '✅ تم توثيق المستخدم' : '❌ تم إلغاء التوثيق');
        return true;
    }
    return false;
}

function grantVerifiedPlus(targetUserId) {
    let currentUser = getUserById(currentUserId);
    if(!currentUser.isAdmin && !currentUser.isOwner) return false;
    
    let targetUser = getUserById(targetUserId);
    if(targetUser && !targetUser.isOwner && !targetUser.isAdmin) {
        targetUser.verifiedPlus = !targetUser.verifiedPlus;
        if(targetUser.verifiedPlus) targetUser.verified = true;
        saveData();
        addNotification(targetUserId, `🎖️ لقد حصلت على شارة ${targetUser.verifiedPlus ? 'VERIFIED+ المميزة' : 'تم سحب VERIFIED+'}`);
        showToast(targetUser.verifiedPlus ? '✨ تم منح شارة VERIFIED+' : '⭐ تم سحب شارة VERIFIED+');
        return true;
    }
    return false;
}

function banUser(targetUserId) {
    let currentUser = getUserById(currentUserId);
    if(!currentUser.isAdmin && !currentUser.isOwner) return false;
    
    let targetUser = getUserById(targetUserId);
    if(targetUser && !targetUser.isOwner && !targetUser.isAdmin) {
        targetUser.banned = !targetUser.banned;
        saveData();
        addNotification(targetUserId, targetUser.banned ? '🚫 تم حظر حسابك من قبل الإدارة' : '✅ تم إلغاء حظر حسابك');
        showToast(targetUser.banned ? '🚫 تم حظر المستخدم' : '✅ تم إلغاء الحظر');
        return true;
    }
    return false;
}

function createAdmin(username, name, password) {
    let currentUser = getUserById(currentUserId);
    if(!currentUser.isOwner) return false;
    
    let newAdmin = {
        id: Date.now(),
        username: username,
        name: name,
        password: password,
        isOwner: false,
        isAdmin: true,
        verified: true,
        verifiedPlus: true,
        bio: 'إدمن في BAMA TECH',
        avatar: '',
        banned: false,
        createdAt: Date.now()
    };
    
    users.push(newAdmin);
    saveData();
    showToast(`تم إضافة الإدمن ${name} بنجاح`);
    return true;
}

// ============== دوال المسابقات ==============
function createContest(title, description, prize, endDate) {
    let currentUser = getUserById(currentUserId);
    if(!currentUser.isAdmin && !currentUser.isOwner) return false;
    
    contests.push({
        id: Date.now(),
        title: title,
        description: description,
        prize: prize,
        endDate: new Date(endDate).getTime(),
        participants: [],
        winner: null,
        active: true,
        createdBy: currentUserId,
        createdAt: Date.now()
    });
    
    saveData();
    showToast('🏆 تم إنشاء المسابقة بنجاح!');
    return true;
}

function joinContest(contestId) {
    let contest = contests.find(c => c.id === contestId);
    if(contest && contest.active && !contest.participants.includes(currentUserId)) {
        contest.participants.push(currentUserId);
        saveData();
        showToast('✅ تم التسجيل في المسابقة! حظ سعيد');
        return true;
    }
    return false;
}

// ============== دوال الإعلانات ==============
function addAdvertisement(title, content, link, imageUrl) {
    let currentUser = getUserById(currentUserId);
    if(!currentUser.isAdmin && !currentUser.isOwner) return false;
    
    advertisements.push({
        id: Date.now(),
        title: title,
        content: content,
        link: link,
        imageUrl: imageUrl,
        active: true,
        views: 0,
        clicks: 0,
        createdAt: Date.now()
    });
    
    saveData();
    showToast('📢 تم نشر الإعلان');
    return true;
}

// ============== دوال الملف الشخصي ==============
function updateProfile(name, bio, avatar) {
    let currentUser = getUserById(currentUserId);
    if(currentUser) {
        if(name) currentUser.name = name;
        if(bio) currentUser.bio = bio;
        if(avatar) currentUser.avatar = avatar;
        saveData();
        showToast('تم تحديث الملف الشخصي');
        return true;
    }
    return false;
}

// ============== دوال الإحصائيات ==============
function getStats() {
    return {
        totalUsers: users.filter(u => !u.isAdmin && !u.isOwner && !u.banned).length,
        totalAdmins: users.filter(u => u.isAdmin && !u.isOwner).length,
        totalPosts: posts.length,
        totalLikes: posts.reduce((sum, p) => sum + p.likes.length, 0),
        totalComments: posts.reduce((sum, p) => sum + p.comments.length, 0),
        totalMessages: messages.length,
        totalContests: contests.length,
        totalAds: advertisements.length,
        verifiedUsers: users.filter(u => u.verified && !u.isAdmin && !u.isOwner).length,
        verifiedPlusUsers: users.filter(u => u.verifiedPlus && !u.isAdmin && !u.isOwner).length,
        bannedUsers: users.filter(u => u.banned).length,
    };
}

// ============== دوال العرض ==============
function getUserBadges(user) {
    let badges = '';
    if(user.isOwner) badges += '<span class="badge-owner"><i class="fas fa-crown"></i> OWNER</span> ';
    if(user.isAdmin && !user.isOwner) badges += '<span class="badge-admin"><i class="fas fa-shield-alt"></i> ADMIN</span> ';
    if(user.verifiedPlus) badges += '<span class="badge-verified-plus"><i class="fas fa-gem"></i> VERIFIED+</span> ';
    else if(user.verified) badges += '<span class="badge-verified"><i class="fas fa-check-circle"></i> VERIFIED</span> ';
    return badges;
}

function renderPosts(containerId, limit = 10) {
    let container = document.getElementById(containerId);
    if(!container) return;
    
    let sortedPosts = [...posts].sort((a,b) => b.timestamp - a.timestamp).slice(0, limit);
    
    if(sortedPosts.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-newspaper"></i><p>لا توجد منشورات بعد... كن أول من ينشر!</p></div>';
        return;
    }
    
    container.innerHTML = sortedPosts.map(post => {
        let author = getUserById(post.userId);
        if(!author || author.banned) return '';
        let isLiked = post.likes.includes(currentUserId);
        
        return `
            <div class="post-card" data-post-id="${post.id}">
                <div class="post-header">
                    <div class="post-avatar" style="background: ${author.avatar ? `url(${author.avatar}) center/cover` : 'linear-gradient(135deg, #00adb5, #4facfe)'}">
                        ${author.avatar ? '' : author.name.charAt(0)}
                    </div>
                    <div class="post-info">
                        <div class="post-name">${author.name} ${getUserBadges(author)}</div>
                        <div class="post-meta">@${author.username} • ${new Date(post.timestamp).toLocaleString()}</div>
                        <div class="post-bio">${author.bio || ''}</div>
                    </div>
                </div>
                <div class="post-content">${post.content}</div>
                ${post.image ? `<img src="${post.image}" class="post-image" onerror="this.style.display='none'">` : ''}
                <div class="post-stats">
                    <span><i class="fas fa-heart"></i> ${post.likes.length}</span>
                    <span><i class="fas fa-comment"></i> ${post.comments.length}</span>
                </div>
                <div class="post-actions">
                    <button class="action-btn like-btn ${isLiked ? 'liked' : ''}" onclick="window.handleLike(${post.id})">
                        <i class="fas ${isLiked ? 'fa-heart' : 'fa-heart'}"></i> ${isLiked ? 'إلغاء الإعجاب' : 'إعجاب'}
                    </button>
                    <button class="action-btn" onclick="window.toggleComments(${post.id})">
                        <i class="fas fa-comment"></i> تعليق
                    </button>
                    ${(getUserById(currentUserId)?.isAdmin || getUserById(currentUserId)?.isOwner || post.userId === currentUserId) ? `
                        <button class="action-btn delete-btn" onclick="window.handleDeletePost(${post.id})">
                            <i class="fas fa-trash"></i> حذف
                        </button>
                    ` : ''}
                </div>
                <div class="comments-section" id="comments-${post.id}" style="display:none;">
                    <div class="comments-list">
                        ${post.comments.map(c => {
                            let commenter = getUserById(c.userId);
                            return `
                                <div class="comment">
                                    <strong>${commenter?.name || 'مستخدم'}</strong>
                                    <p>${c.text}</p>
                                    <small>${new Date(c.timestamp).toLocaleString()}</small>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="comment-input">
                        <input type="text" id="comment-text-${post.id}" placeholder="اكتب تعليقك...">
                        <button onclick="window.handleComment(${post.id}, document.getElementById('comment-text-${post.id}').value)">
                            <i class="fas fa-paper-plane"></i> إرسال
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ============== تهيئة الصفحة ==============
document.addEventListener('DOMContentLoaded', function() {
    let savedUserId = localStorage.getItem('currentUserId');
    if(savedUserId) {
        currentUserId = parseInt(savedUserId);
        let user = getUserById(currentUserId);
        if(!user || user.banned) {
            currentUserId = null;
            localStorage.removeItem('currentUserId');
        }
    }
});

// دوال عامة للاستخدام من HTML
window.handleLike = toggleLike;
window.handleDeletePost = deletePost;
window.handleComment = addComment;
window.toggleComments = (postId) => {
    let commentsDiv = document.getElementById(`comments-${postId}`);
    if(commentsDiv) {
        commentsDiv.style.display = commentsDiv.style.display === 'none' ? 'block' : 'none';
    }
};