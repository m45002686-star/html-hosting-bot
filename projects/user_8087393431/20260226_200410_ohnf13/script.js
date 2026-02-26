document.getElementById("channelMenuBtn").addEventListener("click", function() {
  document.getElementById("channelMenu").style.display = "block";
  document.getElementById("musicBotBtn").style.display = "none";
  document.getElementById("storeOwnerBtn").style.display = "none";
});

function goBack() {
  document.getElementById("channelMenu").style.display = "none";
  document.getElementById("musicBotBtn").style.display = "none";
  document.getElementById("storeOwnerBtn").style.display = "none";
}

document.getElementById("toggleLang").addEventListener("click", function() {
  alert("تم تغيير اللغة!");
  // هنا يمكنك إضافة الكود الخاص بتغيير اللغة
});

document.getElementById("toggleDarkMode").addEventListener("click", function() {
  document.body.classList.toggle("dark-mode");
});