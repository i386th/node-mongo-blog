var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var fs = require('fs');
var FileStreamRotator = require('File-Stream-Rotator');


var logDir = __dirname + '/logs/';

// ensure log directory exists
fs.existsSync(logDir) || fs.mkdirSync(logDir);

//create a rotating write stream
var accessLogStreamD = FileStreamRotator.getStream({
  filename: logDir + 'access-D-%DATE%.log',
  frequency: 'daily',  //有四种频率 daily/m/h/test
  date_format: 'YYYYMMDDHH',
  verbose: true  //默认true
})

var accessLogStreamH = FileStreamRotator.getStream({
  filename: logDir + 'access-H-%DATE%.log',
  frequency: 'h',  //有四种频率 daily/m/h/test
  date_format: 'YYYYMMDDHH',
  verbose: false  //默认true
})
var accessLogStreamM = FileStreamRotator.getStream({
  filename: logDir + 'access-M-%DATE%.log',
  frequency: 'm',  //有四种频率 daily/m/h/test
  date_format: 'YYYYMMDDHHmm',
  verbose: false  //默认true
})
var errorLogStream = FileStreamRotator.getStream({
  filenma: logDir + 'error-%DATE%.log',
  frequency: 'daily',
  date_format: 'YYYYMMDDHH',
  verbose: false  //默认true
})


var accessLogfile = fs.createWriteStream(logDir + 'access.log', {flags: 'a'});
var errorLogfile = fs.createWriteStream(logDir + 'error.log', {flags: 'a'});



//日志模块
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');
//此js文件，专门放了cookie的私钥cookieSecret
var credentials = require('./credentials.js');
 
//导入配置文件
var settings = require('./settings');
//支持会话信息
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
//flash 是一个在 session 中用于存储信息的特定区域
var flash = require('connect-flash');

//生成一个express实例app
var app = express();

// app.set()是Express的参数设置工具，接受一个键(key)和一个值(value)
//设置views文件夹为存放视图文件的目录，即存放模版文件的地方
//__dirname为全局变量，存储当前正在执行的脚本所在的目录。
// view engine setup
app.set('views', path.join(__dirname, 'views'));
//设置视图模版引擎为jade
app.set('view engine', 'jade');


//app.use()启用中间件
//信息写入flash，下次显示完毕后即被清除
app.use(flash());
//加载日志中间件morgan,有5种格式： combined/common/dev/short/tiny
app.use(logger('dev', {stream: accessLogfile}));
app.use(logger('combined', {stream: accessLogStreamD}));
app.use(logger('tiny', {stream: errorLogStream}));
app.use(logger('dev', {stream: errorLogfile}));

app.use(logger('short', {stream: accessLogStreamH}));
app.use(logger('common', {stream: accessLogStreamM}));


// uncomment after placing your favicon in /public
// 设置/public/favicon.ico为favicon图标
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
//加载解析json的中间件
app.use(bodyParser.json());
//加载解析urlencoded请求体中的中间件
app.use(bodyParser.urlencoded({ extended: false }));
//加载解析cookie的中间件,并添加私钥[必须添加(Secret string must be provided.)]
app.use(cookieParser(credentials.cookieSecret));
//消息会话
app.use(session());
// 设置public文件夹为存放静态文件的目录.
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
  //如果有即显消息，把它传到上下文中，然后清除它
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

//路由控制器
app.use('/', routes);
app.use('/users', users);

//捕获404错误，并转发到错误处理器.
// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;

  var meta = '[' + new Date() + ']' + req.url + '\n';
  errorLogfile.write(meta + err.stack + '\n');

  next(err);
});

//错误处理器
// error handlers

//开发环境下的错误处理器，
// 将错误信息渲染到error模版并显示到浏览器中（打印堆栈信息）.
// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

//生产环境下的错误处理器
//将错误信息渲染到error模版并显示到浏览器中（不打印堆栈信息）
// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

app.use(session({
  resave:false,//resave ——重新保存：强制会话保存即使是未修改的，默认为true
  saveUninitialized: true,//强制保存未初始化的会话到存储器  
  secret: settings.cookieSecret,
  key: settings.db,//cookie name
  cookie: {maxAge: 1000 * 60 * 60 * 24 * 30}, //30 days
  store: new MongoStore({
    db: settings.db,
    host: settings.host,
    port: settings.port
  })
}));


//导出app实例供其他模块调用。
module.exports = app;
