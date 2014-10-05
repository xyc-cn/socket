var express = require('express');
var http = require('http');
var app = express();
var async = require('async');
var Controllers = require('./controllers')
var server = http.createServer(app);
var MongoStore = require('connect-mongo')(express);
var io = require('socket.io').listen(server);
app.use(express.static(__dirname + '/static'));
var sessionStore = new MongoStore({
    url: 'mongodb://localhost/technode'
});
app.use(express.bodyParser())
app.use(express.cookieParser())
app.use(express.session({
    secret: 'technode',
    cookie: {
        maxAge: 60 * 1000
    },
    store: sessionStore
}))

app.get('/stooges/chat', function(req, res, next) {
    res.render('chat');
});
var messages = ['Why I oughta...',
    'Nyuk Nyuk Nyuk!', 'Poifect!', 'Spread out!',
    'Say a few syllables!', 'Soitenly!']
io.sockets.on('connection', function(socket) {
    var sendChat = function( title, text ) {
        socket.emit('chat', {
            title: title,
            contents: text
        });
    };

    socket.on('technode.read', function() {
        async.parallel([
                function(done) {
                    Controllers.User.getOnlineUsers(done)
                },
                function(done) {
                    Controllers.Message.read(done)
                }
            ],
            function(err, results) {
                if (err) {
                    socket.emit('err', {
                        msg: err
                    })
                } else {
                    socket.emit('technode.read', {
                        users: results[0],
                        messages: results[1]
                    })
                }
            });
    })
    socket.on('messages.create', function(message) {
        Controllers.Message.create(message, function (err, message) {
            if (err) {
                socket.emit('err', {msg: err})
            } else {
                io.sockets.emit('messages.add', message)
            }
        })
    })
   /* setInterval(function() {
        var randomIndex = Math.floor(Math.random()*catchPhrases.length)
        sendChat('Stooge', catchPhrases[randomIndex]);
    }, 5000);
    sendChat('Welcome to Stooge Chat', 'The Stooges are on the line');
    socket.on('chat', function(data){
        sendChat('You', data.text);
    });*/
});

/*app.get('/?', function(req, res){
    res.render('index');
});*/
app.use(function(req, res) {
    res.sendfile('./static/index.html')
})

app.get('/api/validate', function(req, res) {
    _userId = req.session._userId
    if (_userId) {
        Controllers.User.findUserById(_userId, function(err, user) {
            if (err) {
                res.json(401, {
                    msg: err
                })
            } else {
                res.json(user)
            }
        })
    } else {
        res.json(401, null)
    }
})
app.post('/api/login', function(req, res) {
    email = req.body.email
    if (email) {
        Controllers.User.findByEmailOrCreate(email, function(err, user) {
            if (err) {
                res.json(500, {
                    msg: err
                })
            } else {
                req.session._userId = user._id
                Controllers.User.online(user._id, function(err, user) {
                    if (err) {
                        res.json(500, {
                            msg: err
                        })
                    } else {
                        res.json(user)
                    }
                })
            }
        })
    } else {
        res.json(403)
    }
})

app.get('/api/logout', function(req, res) {
    _userId = req.session._userId
    Controllers.User.offline(_userId, function(err, user) {
        if (err) {
            res.json(500, {
                msg: err
            })
        } else {
            res.json(200)
            delete req.session._userId
        }
    })
})

var port = 8080;
server.listen(port);
console.log('Listening on port ' + port);
