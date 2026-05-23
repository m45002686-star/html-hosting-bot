const express = require('express');
const app = express();
const mongoose = require('mongoose');

// إعدادات بسيطة
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ربط قاعدة البيانات (استبدل الرابط بـ MongoDB Atlas)
mongoose.connect('mongodb://localhost:27017/telegramLinks');

const LinkSchema = new mongoose.Schema({
    type: String, // bot, channel, group
    url: String,
    description: String,
    date: { type: Date, default: Date.now }
});
const Link = mongoose.model('Link', LinkSchema);

// الصفحة الرئيسية
app.get('/', async (req, res) => {
    const links = await Link.find().sort({ date: -1 });
    res.render('index', { links });
});

// إضافة رابط
app.post('/add', async (req, res) => {
    await Link.create(req.body);
    res.redirect('/');
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
