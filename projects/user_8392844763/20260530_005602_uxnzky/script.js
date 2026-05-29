// عرض التسجيل / تسجيل الدخول
function showRegister(){ document.querySelector('.login-wrap').style.display='none'; document.querySelector('.register-wrap').style.display='block'; }
function showLogin(){ document.querySelector('.register-wrap').style.display='none'; document.querySelector('.login-wrap').style.display='block'; }

// بيانات وهمية لتجربة
let users = [];
let bots = [];

function login(){
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const user = users.find(u=>u.username===username && u.password===password);
    if(user){
        alert("تم تسجيل الدخول!");
        document.querySelector('.login-wrap').style.display='none';
        document.querySelector('.dashboard').style.display='block';
        loadBots();
    } else {
        alert("اسم المستخدم أو كلمة المرور خاطئة!");
    }
}

function register(){
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    if(users.find(u=>u.username===username)){
        alert("اسم المستخدم موجود بالفعل!");
        return;
    }
    users.push({username,password});
    alert("تم إنشاء الحساب!");
    showLogin();
}

function uploadBot(){
    const botFile = document.getElementById('botFile').files[0];
    const botName = document.getElementById('botName').value;
    if(!botFile || !botName){
        alert("اختر ملف واسم للبوت!");
        return;
    }
    bots.push({name: botName, status: "متوقف"});
    alert("تم رفع البوت (وهمية)!");
    loadBots();
}

function loadBots(){
    const list = document.getElementById('botsList');
    list.innerHTML='';
    bots.forEach((bot,index)=>{
        const div = document.createElement('div');
        div.innerHTML = `${bot.name} - ${bot.status} <button onclick="startBot(${index})">تشغيل</button> <button onclick="stopBot(${index})">إيقاف</button>`;
        list.appendChild(div);
    });
}

function startBot(index){
    bots[index].status = "قيد التشغيل";
    loadBots();
}

function stopBot(index){
    bots[index].status = "متوقف";
    loadBots();
}