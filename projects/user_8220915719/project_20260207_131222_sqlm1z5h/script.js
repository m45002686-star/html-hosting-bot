// ملف JavaScript للموقع
console.log('🎉 موقع "موقعي" يعمل بنجاح!');

// تهيئة الموقع
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 تم تحميل الموقع بالكامل');
    
    // تأثيرات للبطاقات
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
    });
    
    // تأثير الظهور التدريجي
    setTimeout(() => {
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 200);
        });
    }, 300);
    
    // إضافة تفاعل للأزرار
    const buttons = document.querySelectorAll('.card');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
        });
    });
    
    // عرض رسالة ترحيب
    const welcomeMessage = `🚀 مرحباً بك في موقع "${project_name}"!`;
    console.log(welcomeMessage);
    
    // تحديث الوقت في التذييل
    function updateTime() {
        const now = new Date();
        const timeString = now.toLocaleString('ar-SA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        
        const timeElement = document.querySelector('footer p:first-child');
        if (timeElement) {
            timeElement.textContent = `آخر تحديث: ${timeString}`;
        }
    }
    
    // تحديث الوقت كل دقيقة
    updateTime();
    setInterval(updateTime, 60000);
    
    // إضافة تأثيرات إضافية
    const features = document.querySelectorAll('.feature');
    features.forEach(feature => {
        feature.addEventListener('mouseenter', function() {
            const icon = this.querySelector('i');
            if (icon) {
                icon.style.transform = 'rotate(360deg)';
                icon.style.transition = 'transform 0.6s ease';
            }
        });
        
        feature.addEventListener('mouseleave', function() {
            const icon = this.querySelector('i');
            if (icon) {
                icon.style.transform = 'rotate(0deg)';
            }
        });
    });
});

// وظائف مساعدة
function showNotification(message, type = 'info') {
    console.log(`📢 [${type}] ${message}`);
}

// دالة للتحقق من دعم المتصفح
function checkBrowserSupport() {
    const supports = {
        flex: typeof document.body.style.flex !== 'undefined',
        grid: typeof document.body.style.grid !== 'undefined',
        transform: typeof document.body.style.transform !== 'undefined',
        transition: typeof document.body.style.transition !== 'undefined'
    };
    
    console.log('🔍 دعم المتصفح:', supports);
    return supports;
}

// بدء التشغيل
checkBrowserSupport();
showNotification('موقعك جاهز للاستخدام!', 'success');