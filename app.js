require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const passport = require('./passport');
const bcrypt = require('bcrypt');
const flash = require('connect-flash');
const User = require('./models/user');
const Goal = require('./models/goal');
const Milestone = require('./models/milestone');

// MongoDB コネクション
const mongoose = require('mongoose');
const dbUrl  = process.env.MONGO_URL || 'mongodb+srv://takuto_oda:In260tXLR5JSIF37@cluster0.jv2vw.mongodb.net/schedule_app?retryWrites=true&w=majority';
mongoose.connect(dbUrl)
.then(() => { console.log('MongoDB コネクションOK!!'); })
.catch((err) => { console.log('MongoDB コネクションERROR!!', err); });

// クッキーをパースするためのミドルウェア
app.use(cookieParser());

// セッションの設定
app.use(session({
    secret: process.env.SECRET || 'mysecret',  // セッションの暗号化に使用するキー。強力なランダムな文字列にすることを推奨
    resave: false,            // セッションが変更されていなくても再保存するかどうか
    saveUninitialized: true,  // 未初期化のセッションも保存するかどうか
    store: MongoStore.create({
        mongoUrl: dbUrl
    }),
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // クッキーの有効期限（ここでは24時間）
        secure: true,  // `true` にすると HTTPS でのみクッキーを送信（本番環境で有効にする）
    }
}));

// フラッシュメッセージ設定
app.use(flash());

// パスポートの初期化
app.use(passport.initialize());
app.use(passport.session());

// EJS セットアップ
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// req.body取得
app.use(express.urlencoded({extended: true}));
// method-override
app.use(methodOverride('_method'));

const isLoggedIn = function(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'ログインしてください。');
    res.redirect('/login');
}

// フラッシュメッセージをビューに渡すミドルウェア
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.user;
    next();
});


// プロジェクトのセットアップ
app.get('/', (req, res) => {
    res.render('home');
});

app.get('/goal', isLoggedIn, async(req, res) => {
    const goals = await Goal.find({});
    res.render('schedules/goal', { goals });
});

// 新規目標投稿ページ
app.get('/goal/new', (req, res) => {
    res.render('schedules/new');
});

// 詳細ページ
app.get('/goal/:id', async(req, res) => {
    const goal = await Goal.findById(req.params.id).populate({ path: 'milestones' });
    res.render('schedules/show', { goal });
});

// 新規投稿POSTルート
app.post('/goal', async(req, res) => {
    const goal = new Goal(req.body.goal);
    await goal.save();
    res.redirect('/goal');
});

// 目標編集ページ
app.get('/goal/:id/edit', async(req, res) => {
    const { id } = req.params;
    const goal = await Goal.findById(id);
    res.render('schedules/edit', { goal });
});

// 編集内容送信
app.put('/goal/:id', async(req, res) => {
    const { id } = req.params;
    const goal = await Goal.findByIdAndUpdate(id,{ ...req.body.goal });
    await goal.save();
    res.redirect(`/goal/${goal._id}`);
});

// マイルストーンページ
app.post('/goal/:id/milestone', async(req, res) => {
    const { id } = req.params;
    const goal = await Goal.findById(id);
    const milestone = new Milestone(req.body.milestone);
    goal.milestones.push(milestone);
    await milestone.save();
    await goal.save();
    res.redirect(`/goal/${goal._id}`);
});

// マイルストーン削除
app.delete('/goal/:id/milestone/:milestoneId', async(req, res) => {
    const { id, milestoneId } = req.params;
    await Goal.findByIdAndUpdate(id, {$pull:{milestones: milestoneId}});
    await Milestone.findByIdAndDelete(milestoneId);
    res.redirect(`/goal/${id}`); 
});

// 目標ページ削除
app.delete('/goal/:id', async(req, res) => {
    const { id } = req.params;
    await Goal.findByIdAndDelete(id);
    res.redirect('/goal');
});

// ユーザー登録
app.get('/register', (req, res) => {
    res.render('user/register');
});
app.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            req.flash('error', 'このユーザー名は既に使用されています。');
            return res.redirect('/register');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ email, username, password: hashedPassword });
        await newUser.save();
        req.flash('success', '登録が成功しました！');
        res.redirect('/login');
    } catch (err) {
        req.flash('error', '登録中にエラーが発生しました。もう一度お試しください。');
        res.redirect('/register');
    }
});

// ログイン
app.get('/login', (req, res) => {
    res.render('user/login');
});

app.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: 'ユーザー名またはパスワードが無効です。'
}), (req, res) => {
    req.flash('success', 'ようこそ');
    res.redirect('/goal');
});

// ログアウト
app.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) { return next(err); }
        res.redirect('/login');
    });
});

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if(!err.message) {
        err.message = '問題が起きました';
    }
    res.status(statusCode).render('error', { err });
});

app.listen(3000, () => {
    console.log('ポート3000でリクエスト受付中...');
});