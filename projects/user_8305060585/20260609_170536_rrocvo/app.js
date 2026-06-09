/* =========================================
   أدوات المساعدة والتحكم للواجهة
   ========================================= */
const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];

function showToast(msg, type = 'success') {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} text-white px-5 py-2.5 rounded-full shadow-lg text-xs font-bold transform transition-all duration-300 translate-y-5 opacity-0 flex items-center gap-2`;
  toast.innerHTML = `<i class="fa-solid ${type==='success'?'fa-check-circle':'fa-triangle-exclamation'}"></i> ${msg}`;
  container.appendChild(toast);
  
  requestAnimationFrame(() => toast.classList.remove('translate-y-5', 'opacity-0'));
  setTimeout(() => {
    toast.classList.add('translate-y-5', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

// ثيم الإضاءة / والوضع المظلم
const themeBtn = $('#themeBtn');
const themeIcon = $('#themeIcon');
if(localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
  themeIcon.className = 'fa-solid fa-sun text-yellow-400';
}
themeBtn.onclick = () => {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.theme = isDark ? 'dark' : 'light';
  themeIcon.className = isDark ? 'fa-solid fa-sun text-yellow-400' : 'fa-solid fa-moon text-gray-500';
};

$('#year').textContent = new Date().getFullYear();

/* =========================================
   ميزة توليد هدايات وتدبر عشوائي علوي
   ========================================= */
const TADABOR_DATA = [
  { a: "﴿ إن مع العسر يسراً ﴾", t: "يقين تام بأن فرج الله قادم مهما طال زمن الشدة والتعب وضيق النفوس." },
  { a: "﴿ فاذكروني أذكركم ﴾", t: "أكبر وسام شرف للمسلم أن يذكره رب الكون في الملأ الأعلى عند ذكره له." },
  { a: "﴿ وما كان الله معذبهم وهم يستغفرون ﴾", t: "الاستغفار أمان الأرض الباقي، فلا تتركه يفارق لسانك أبداً." }
];
const pickTab = TADABOR_DATA[Math.floor(Math.random() * TADABOR_DATA.length)];
$('#tadaborAyah').textContent = pickTab.a;
$('#tadaborTafseer').textContent = pickTab.t;

/* =========================================
   مواقيت الأذان والصلوات الجغرافية (123)
   ========================================= */
let userPos = { lat: null, lon: null };
const prayMap = { Fajr: "الفجر", Sunrise: "الشروق", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };
let nextPrayerDate = null;
let countdownTimer = null;

const gDate = new Date();
$('#gregBox').textContent = gDate.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
try {
  $('#hijriBox').textContent = new Intl.DateTimeFormat('ar-TN-u-ca-islamic', { year: 'numeric', month: 'long', day: 'numeric' }).format(gDate);
} catch (e) { $('#hijriBox').textContent = 'التقويم الهجري نشط'; }

function loadPrayerTimesByCoords() {
  const url = `https://api.aladhan.com/v1/timings?latitude=${userPos.lat}&longitude=${userPos.lon}&method=5`;
  fetchPrayerData(url);
}

function loadPrayerTimesByCity(city, country) {
  const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&method=5`;
  fetchPrayerData(url);
}

function fetchPrayerData(url) {
  fetch(url).then(r => r.json()).then(j => {
    if(!j.data) { showToast('يرجى التحقق من اسم المدينة المكتوب', 'error'); return; }
    const t = j.data.timings;
    const grid = $('#prayTimes');
    grid.innerHTML = '';

    Object.entries({ Fajr: t.Fajr, Sunrise: t.Sunrise, Dhuhr: t.Dhuhr, Asr: t.Asr, Maghrib: t.Maghrib, Isha: t.Isha }).forEach(([k, v]) => {
      const card = document.createElement('div');
      card.className = "rounded-xl p-3 border dark:border-gray-800 bg-gray-50 dark:bg-gray-950/40 shadow-inner";
      card.innerHTML = `<div class="text-gray-400 text-xs font-semibold mb-0.5">${prayMap[k]}</div><div class="text-lg font-black tracking-wider text-gray-800 dark:text-gray-200">${v}</div>`;
      grid.appendChild(card);
    });

    const now = new Date();
    const todayTimes = Object.entries({ Fajr: t.Fajr, Dhuhr: t.Dhuhr, Asr: t.Asr, Maghrib: t.Maghrib, Isha: t.Isha })
      .map(([k, v]) => ({ name: prayMap[k], time: new Date(now.toDateString() + ' ' + v) })).filter(x => !isNaN(x.time));

    let next = todayTimes.find(x => x.time > now);
    if (!next) { next = todayTimes[0]; next.time.setDate(next.time.getDate() + 1); }

    $('#nextPrayerName').textContent = next.name;
    nextPrayerDate = next.time;
    startLiveCountdown();
  }).catch(() => showToast('خطأ بالاتصال بخادم المواقيت', 'error'));
}

function startLiveCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  const updateTick = () => {
    if (!nextPrayerDate) return;
    const diffMs = nextPrayerDate - new Date();
    if (diffMs <= 0) {
      $('#liveCountdown').textContent = "00:00:00";
      clearInterval(countdownTimer);
      loadPrayerTimesByCoords();
      return;
    }
    const h = Math.floor((diffMs / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
    const m = Math.floor((diffMs / 1000 / 60) % 60).toString().padStart(2, '0');
    const s = Math.floor((diffMs / 1000) % 60).toString().padStart(2, '0');
    $('#liveCountdown').textContent = `${h}:${m}:${s}`;
  };
  updateTick();
  countdownTimer = setInterval(updateTick, 1000);
}

$('#manualLocBtn').onclick = () => {
  const city = $('#manualCity').value.trim();
  const country = $('#manualCountry').value.trim();
  if(!city || !country) { showToast('أدخل اسم المدينة والبلد بدقة أولاً', 'error'); return; }
  $('#locBox').textContent = `${city}، ${country}`;
  loadPrayerTimesByCity(city, country);
  showToast('تم تحديث أوقات الصلاة بنجاح');
};

/* =========================================
   ميكانيزم مشغل استوديو وليد الصوتي المتقدم 🎵
   ========================================= */
const surahSelect = $('#surahSelect');
const reciterSelect = $('#reciterSelect');
const mainAudio = $('#mainAudio');
const audioProgress = $('#audioProgress');
const currentTimeDisplay = $('#currentTime');
const totalDurationDisplay = $('#totalDuration');
const playPauseBtn = $('#playPauseBtn');
const playPauseIcon = $('#playPauseIcon');
const discIcon = $('#discIcon');

let isRepeatMode = false;       
let isContinuousMode = false;   
let totalAyahsCount = 0;        // حفظ عدد آيات السورة الحالية برمجياً للمزامنة

// جلب وتعبئة قائمة السور كاملة مضافاً إليها عدد الآيات لكل سورة
async function loadSurahList() {
  try {
    const r = await fetch('https://api.alquran.cloud/v1/surah');
    const j = await r.json();
    j.data.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.number;
      // ميزة إضافة عدد الآيات بشكل واضح بجانب اسم السورة في القائمة المنسدلة
      opt.textContent = `${s.number}. سورة ${s.name} (${s.numberOfAyahs} آية)`;
      surahSelect.appendChild(opt);
    });
    surahSelect.value = localStorage.getItem('lastSurah_w') || 1;
    updatePlayerMetadata();
  } catch {}
}

function updatePlayerMetadata() {
  const selectedText = surahSelect.options[surahSelect.selectedIndex]?.text || "سورة الفاتحة";
  $('#nowPlayingTitle').textContent = selectedText.split('(')[0].trim();
  $('#nowPlayingSub').textContent = reciterSelect.options[reciterSelect.selectedIndex].text;
}

// تعديل الحدث عند تغيير السورة أو القارئ لتحديث المسار فوراً وسلاسة تامة
surahSelect.onchange = () => { 
  updatePlayerMetadata(); 
  if (!mainAudio.paused || mainAudio.src) {
    playSelectedSurah();
  }
};

reciterSelect.onchange = () => { 
  updatePlayerMetadata(); 
  if (mainAudio.src) {
    playSelectedSurah(); 
  }
};

function formatTime(secs) {
  if (isNaN(secs)) return "00:00";
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// دالة بدء التلاوة والبث الصوتي المباشر للسورة كاملة
function playSelectedSurah() {
  const surahNum = surahSelect.value;
  const reciter = reciterSelect.value;
  localStorage.setItem('lastSurah_w', surahNum);
  updatePlayerMetadata();

  // إيقاف أي بث نشط سابق لتجنب التعليق
  mainAudio.pause();
  mainAudio.src = `https://cdn.islamic.network/quran/audio-surah/128/${reciter}/${surahNum}.mp3`;
  mainAudio.playbackRate = parseFloat($('#audioSpeed').value);
  
  // التشغيل المباشر السلس للمسار المحدث
  mainAudio.play().then(() => {
    setAudioUIVisuals(true);
  }).catch(() => {
    showToast('خطأ أثناء تحميل ملف التلاوة الصوتي', 'error');
    setAudioUIVisuals(false);
  });

  // إذا كانت لوحة الآيات النصية معروضة، يتم جلب نصوص السورة الجديدة فوراً لتتوافق مع المشغل
  if (!$('#quranTextArea').classList.contains('hidden')) {
    loadAndShowText(surahNum);
  }
}

// دالة التحكم المرئي في شكل وحركة عناصر المشغل حسب حالة الصوت
function setAudioUIVisuals(isPlaying) {
  if (isPlaying) {
    playPauseIcon.className = 'fa-solid fa-pause';
    discIcon.style.animationPlayState = 'running';
    $('#musicPlayerContainer').classList.add('playing');
  } else {
    playPauseIcon.className = 'fa-solid fa-play';
    discIcon.style.animationPlayState = 'paused';
    $('#musicPlayerContainer').classList.remove('playing');
  }
}

// تفعيل ميكانيزم زر التحكم الموحد التبادلي (Play / Pause)
playPauseBtn.onclick = () => {
  if (mainAudio.src && !mainAudio.paused) {
    mainAudio.pause();
    setAudioUIVisuals(false);
  } else {
    if (mainAudio.src) {
      mainAudio.play();
      setAudioUIVisuals(true);
    } else {
      playSelectedSurah();
    }
  }
};

$('#stopSurahBtn').onclick = () => {
  mainAudio.pause();
  mainAudio.currentTime = 0;
  audioProgress.value = 0;
  currentTimeDisplay.textContent = "00:00";
  setAudioUIVisuals(false);
  // إزالة أي إضاءة خفيفة عن الآيات عند الإيقاف الكلي
  $$('.ayah-item').forEach(el => el.classList.remove('ayah-active-glow'));
  showToast('تم إيقاف التشغيل كلياً');
};

// التنقل للسورة التالية والسابقة
$('#nextSurahBtn').onclick = () => {
  let current = parseInt(surahSelect.value);
  if (current < 114) {
    surahSelect.value = current + 1;
    playSelectedSurah();
  } else {
    showToast('وصلت إلى نهاية المصحف الشريف (سورة الناس)');
  }
};

$('#prevSurahBtn').onclick = () => {
  let current = parseInt(surahSelect.value);
  if (current > 1) {
    surahSelect.value = current - 1;
    playSelectedSurah();
  }
};

// إدارة أزرار التكرار والإعادة والتشغيل التلقائي المتتالي
$('#repeatModeBtn').onclick = () => {
  isRepeatMode = !isRepeatMode;
  if (isRepeatMode) {
    isContinuousMode = false;
    $('#continuousModeBtn').classList.remove('bg-emerald-500', 'text-white');
    $('#repeatModeBtn').classList.add('bg-emerald-500', 'text-white');
    showToast('تم تفعيل وضع تكرار نفس السورة 🔁');
  } else {
    $('#repeatModeBtn').classList.remove('bg-emerald-500', 'text-white');
  }
};

$('#continuousModeBtn').onclick = () => {
  isContinuousMode = !isContinuousMode;
  if (isContinuousMode) {
    isRepeatMode = false;
    $('#repeatModeBtn').classList.remove('bg-emerald-500', 'text-white');
    $('#continuousModeBtn').classList.add('bg-emerald-500', 'text-white');
    showToast('تم تفعيل التشغيل المستمر المتتالي للسور 🔀');
  } else {
    $('#continuousModeBtn').classList.remove('bg-emerald-500', 'text-white');
  }
};

$('#audioSpeed').onchange = (e) => {
  mainAudio.playbackRate = parseFloat(e.target.value);
};

/* =========================================
   ميكانيزم المزامنة وإضاءة الكلمات والبحث الزمني
   ========================================= */
mainAudio.addEventListener('timeupdate', () => {
  if (mainAudio.duration) {
    const pct = (mainAudio.currentTime / mainAudio.duration) * 100;
    audioProgress.value = pct;
    currentTimeDisplay.textContent = formatTime(mainAudio.currentTime);
    
    // محاكاة إضاءة خفيفة للآية المقروءة حالياً بناءً على نسبة التقدم في السورة
    if (totalAyahsCount > 0) {
      const currentRatio = mainAudio.currentTime / mainAudio.duration;
      const calculatedIndex = Math.min(Math.floor(currentRatio * totalAyahsCount), totalAyahsCount - 1);
      
      const activeAyahElement = $(`#ayah-idx-${calculatedIndex}`);
      if (activeAyahElement && !activeAyahElement.classList.contains('ayah-active-glow')) {
        $$('.ayah-item').forEach(el => el.classList.remove('ayah-active-glow'));
        activeAyahElement.classList.add('ayah-active-glow');
        
        // التمرير التلقائي السلس للآية النشطة لتبقى في مجال رؤية القارئ
        activeAyahElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }
});

mainAudio.addEventListener('loadedmetadata', () => {
  totalDurationDisplay.textContent = formatTime(mainAudio.duration);
});

audioProgress.addEventListener('input', (e) => {
  if (mainAudio.duration) {
    const newTime = (e.target.value / 100) * mainAudio.duration;
    mainAudio.currentTime = newTime;
  }
});

mainAudio.addEventListener('ended', () => {
  if (isRepeatMode) {
    mainAudio.currentTime = 0;
    mainAudio.play();
    showToast('إعادة تكرار السورة تلقائياً...');
  } else if (isContinuousMode) {
    let nextNum = parseInt(surahSelect.value) + 1;
    if (nextNum <= 114) {
      surahSelect.value = nextNum;
      playSelectedSurah();
      showToast('الانتقال التلقائي للسورة التالية...');
    } else {
      $('#stopSurahBtn').click();
      showToast('اكتملت التلاوة المتتالية بنهاية المصحف الشريف');
    }
  } else {
    $('#stopSurahBtn').click();
  }
});

/* =========================================
   جلب النص القرآني وعرضه ومزامنة الوهج والإضاءة
   ========================================= */
async function loadAndShowText(n) {
  $('#quranTextArea').classList.remove('hidden');
  $('#toggleTextBtn').classList.remove('hidden');
  $('#ayahs').innerHTML = '<div class="text-emerald-500 font-bold text-xs animate-pulse">جاري تحميل الآيات المكتوبة وتفعيل وهج الإضاءة...</div>';
  
  try {
    const r = await fetch(`https://api.alquran.cloud/v1/surah/${n}/ar.alafasy`);
    const j = await r.json();
    const s = j.data;
    totalAyahsCount = s.numberOfAyahs; // تعيين عدد الآيات
    
    $('#surahMeta').textContent = `سورة ${s.name} • ${s.numberOfAyahs} آية مكتوبة بأرقام 123`;
    
    const box = document.createElement('div');
    box.className = "p-2 space-y-2";
    
    s.ayahs.forEach((a, index) => {
      const item = document.createElement('div');
      // إضافة المعرفات والـ Classes المخصصة لغرض إضاءة الكلمات التفاعلية
      item.id = `ayah-idx-${index}`;
      item.className = "ayah-item inline-block p-2 m-1 border border-transparent text-lg font-serif leading-loose rounded-lg";
      
      let text = a.text;
      if (index === 0 && n != 1 && n != 9) text = text.replace('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ', '');
      
      item.innerHTML = `${text} <span class="text-emerald-500 font-bold text-xs">(${a.numberInSurah})</span>`;
      
      // ميزة إضافية: إمكانية الضغط على آية لتسليط الضوء عليها يدوياً
      item.onclick = () => {
        $$('.ayah-item').forEach(el => el.classList.remove('ayah-active-glow'));
        item.classList.add('ayah-active-glow');
        showToast(`ممتد بالنظر إلى الآية رقم ${a.numberInSurah}`);
      };
      
      box.appendChild(item);
    });
    
    $('#ayahs').innerHTML = '';
    if (n != 1 && n != 9) {
      $('#ayahs').innerHTML = `<div class="text-center text-xl font-bold mb-3 text-emerald-600 font-serif">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>`;
    }
    $('#ayahs').appendChild(box);
  } catch { $('#ayahs').textContent = 'حدث خطأ أثناء جلب النص.'; }
}

$('#loadSurahText').onclick = () => loadAndShowText(surahSelect.value);
$('#toggleTextBtn').onclick = () => {
  $('#quranTextArea').classList.add('hidden');
  $('#toggleTextBtn').classList.add('hidden');
};

/* =========================================
   الأذكار المهيكلة وقائمة المهام
   ========================================= */
const AZKAR = {
  morning: ["أصبحنا وأصبح الملك لله والحمد لله وحده لا شريك له.", "رضيت بالله رباً وبالإسلام ديناً وبمحمد ﷺ نبياً.", "يا حي يا قيوم برحمتك أستغيث أصلح لي شأني كله."],
  evening: ["أرخينا وأمسى الملك لله وحده لا شريك له ولا نعبد إلا إياه.", "اللهم بك أمسينا وبك أصبحنا وبك نحيا وبك نموت وإليك النشور.", "أعوذ بكلمات الله التامات من شر ما خلق."],
  afterPrayer: ["أستغفر الله، أستغفر الله، أستغفر الله العظيم.", "اللهم أنت السلام ومنك السلام تباركت يا ذا الجلال والإكرام.", "لا حول ولا قوة إلا بالله العلي العظيم القدير."]
};

window.setAzkar = function(type, btnElement) {
  $$('.z-tab').forEach(btn => btn.className = "flex-1 py-1.5 rounded-lg text-xs font-semibold text-gray-500 z-tab cursor-pointer");
  if(btnElement) btnElement.className = "flex-1 py-1.5 rounded-lg bg-white dark:bg-gray-900 text-xs font-bold text-emerald-600 z-tab cursor-pointer shadow-sm";

  const box = $('#azkarBox'); box.innerHTML = '';
  AZKAR[type].forEach((z) => {
    const item = document.createElement('label');
    item.className = 'flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950/30 cursor-pointer select-none text-right';
    item.innerHTML = `<input type="checkbox" class="mt-1 w-4 h-4 accent-emerald-600 rounded"><span class="text-xs leading-relaxed text-gray-700 dark:text-gray-300">${z}</span>`;
    box.appendChild(item);
  });
};
setTimeout(() => setAzkar('morning', $$('.z-tab')[0]), 300);

/* =========================================
   مسبحة إلكترونية ونظام اهتزاز ذكي مدمج مع مفتاح تشغيل/إيقاف
   ========================================= */
let tasbeehCount = parseInt(localStorage.getItem('tasbeeh_w_v3')) || 0;
let isVibrationEnabled = localStorage.getItem('tasbeeh_vibe_w') !== 'false'; // القيمة الافتراضية true

const counterDisplay = $('#counter');
const vibrateToggleBtn = $('#vibrateToggleBtn');
const vibrateStatusText = $('#vibrateStatusText');

counterDisplay.textContent = tasbeehCount;

// دالة تحديث مظهر زر الاهتزاز
function updateVibrateUI() {
  if (isVibrationEnabled) {
    vibrateStatusText.textContent = "مفعّل";
    vibrateToggleBtn.classList.remove('border-red-200', 'text-red-600');
    vibrateToggleBtn.classList.add('border-gray-100', 'text-gray-600');
  } else {
    vibrateStatusText.textContent = "ملغى";
    vibrateToggleBtn.classList.remove('border-gray-100', 'text-gray-600');
    vibrateToggleBtn.classList.add('border-red-200', 'text-red-500');
  }
}

// التحكم في تشغيل وإلغاء الاهتزاز عند النقر
vibrateToggleBtn.onclick = () => {
  isVibrationEnabled = !isVibrationEnabled;
  localStorage.setItem('tasbeeh_vibe_w', isVibrationEnabled);
  updateVibrateUI();
  showToast(isVibrationEnabled ? 'تم تفعيل اهتزاز المسبحة الخفيف' : 'تم إلغاء تفعيل اهتزاز المسبحة');
};

$('#tasbeehBtn').onclick = () => {
  tasbeehCount++;
  counterDisplay.textContent = tasbeehCount; 
  localStorage.setItem('tasbeeh_w_v3', tasbeehCount);
  
  // تنفيذ الاهتزاز اللمسي فقط في حال سماح المستخدم وتوافق الجهاز
  if (isVibrationEnabled && navigator.vibrate) {
    if(tasbeehCount % 33 === 0) navigator.vibrate([30, 30, 30]); // اهتزاز مميز عند قفل التسبيحة
    else navigator.vibrate(12); // نقرة اهتزازية خفيفة جداً
  }
};

window.resetCounter = function() {
  tasbeehCount = 0;
  counterDisplay.textContent = 0;
  localStorage.setItem('tasbeeh_w_v3', 0);
  showToast('تم تصفير عداد المسبحة');
};

/* =========================================
   حساب زاوية القبلة والبوصلة المصلحة
   ========================================= */
const KAABA = { lat: 21.4225, lon: 39.8262 };
function toRad(d) { return d * Math.PI / 180 }
function toDeg(r) { return r * 180 / Math.PI }

function bearing(from, to) {
  const φ1 = toRad(from.lat), φ2 = toRad(to.lat), Δλ = toRad(to.lon - from.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

let qiblaBearing = 0;
function updateNeedle(heading) {
  if (heading === null || isNaN(heading)) return;
  // الحساب الصحيح لتدوير الإبرة لتعمل بتوافق حقيقي مع الشمال المغناطيسي
  const rotation = (qiblaBearing - heading + 360) % 360;
  $('#needle').style.transform = `rotate(${rotation}deg)`;
}

function initGeo() {
  if (!('geolocation' in navigator)) { $('#locBox').textContent = 'الـ GPS غير مدعوم بجهازك'; return; }
  
  navigator.geolocation.getCurrentPosition(pos => {
    userPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userPos.lat}&lon=${userPos.lon}&accept-language=ar`)
      .then(r => r.json()).then(j => {
        $('#locBox').textContent = j.address?.city || j.address?.town || j.address?.state || 'تم رصد إحداثياتك';
      }).catch(() => $('#locBox').textContent = 'تم الرصد التلقائي عبر الـ GPS');

    qiblaBearing = bearing(userPos, KAABA);
    $('#qiblaInfo').textContent = `زاوية القبلة المحسوبة: ${Math.round(qiblaBearing)} درجة من الشمال`;
    
    loadPrayerTimesByCoords();
    
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', e => {
        // دعم الهواتف الذكية المختلفة (Android و iOS) للرصد المباشر
        let heading = e.webkitCompassHeading !== undefined ? e.webkitCompassHeading : (e.alpha !== null ? Math.abs(e.alpha - 360) : null);
        if (heading !== null) updateNeedle(heading);
      }, true);
    }
  }, err => {
    $('#locBox').textContent = 'صلاحية الموقع مرفوضة. استخدم ميزة البحث بالأسفل.';
  }, { enableHighAccuracy: true, timeout: 8000 });
}

/* =========================================
   💡 ركن النصائح والحكم الدينية المتجددة بالتناوب
   ========================================= */
const WISDOM_COLLECTION = [
  "الاستغفار يفتح الأقفال، ويشرح البال، ويكثر المال، ويصلح الحال والمآل.. فلا تغفل عنه يومك.",
  "احرص على ركعتي الضحى، فإنها تجزئ عن كل سلامى في جسدك (360 صدقة يومية تفتح لك أبواب التيسير).",
  "من أصلح مابينه وبين الله، أصلح الله مابينه وبين الناس، ومن أصلح أمر آخرته أصلح الله له أمر دنياه.",
  "إذا ضاق صدرك وتزاحمت الأفكار والهموم في عقلك، هرول نحو سجادتك وأطل السجود، فهناك تتبخر المصاعب.",
  "لن تجد أحنّ من الله عليك، فوض أمرك كله إليه، ونم قرير العين، فالخير كله فيما يختاره سبحانه لك.",
  "أفضل استثمار في يومك هو تثبيت ورد ثابت وقراءة ما تيسر من القرآن، فإنه يجلب البركة في الوقت والجهد."
];

$('#nextWisdomBtn').onclick = () => {
  const currentWisdom = $('#wisdomText').textContent;
  let filtered = WISDOM_COLLECTION.filter(w => w !== currentWisdom);
  const randomWisdom = filtered[Math.floor(Math.random() * filtered.length)];
  
  $('#wisdomText').style.opacity = 0;
  setTimeout(() => {
    $('#wisdomText').textContent = randomWisdom;
    $('#wisdomText').style.opacity = 1;
  }, 200);
  showToast('تم جلب نصيحة وحكمة جديدة ✨');
};

/* التشغيل الأولي الفوري عند فتح التطبيق */
window.onload = () => {
  initGeo();
  loadSurahList();
  updateVibrateUI(); // تشغيل حالة الاهتزاز المخزنة مسبقاً للمسبحة
};
