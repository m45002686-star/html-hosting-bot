// موقع مم
console.log('🌐 تم تحميل موقع "مم"');

// تهيئة الموقع
document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ الموقع جاهز للعمل');
    
    // تأثيرات للبطاقات
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
    });
    
    // ظهور تدريجي
    setTimeout(() => {
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.transition = 'all 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 150);
        });
    }, 500);
    
    // تحديث الوقت
    function updateTime() {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        };
        const timeString = now.toLocaleDateString('ar-SA', options);
        
        const timeElement = document.getElementById('current-time');
        if (timeElement) {
            timeElement.textContent = timeString;
        }
    }
    
    // إنشاء عنصر الوقت إذا لم يكن موجوداً
    const footer = document.querySelector('footer');
    if (footer) {
        const timeElement = document.createElement('p');
        timeElement.id = 'current-time';
        timeElement.className = 'time';
        footer.insertBefore(timeElement, footer.querySelector('.credit'));
        updateTime();
        setInterval(updateTime, 60000);
    }
    
    // إضافة تفاعل
    cards.forEach(card => {
        card.addEventListener('click', function() {
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = '';
            }, 200);
        });
    });
});

// دالة لعرض الإشعارات
function showAlert(message, type = 'info') {
    console.log(`📢 [${type}] ${message}`);
    alert(message);
}

// بدء التطبيق
showAlert('مرحباً بك في موقعك الجديد!', 'success');