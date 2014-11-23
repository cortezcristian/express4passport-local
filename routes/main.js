var app = module.parent.exports.app;
var passport = module.parent.exports.passport;
var Persons = require('../models/persons.js');
var Admins = require('../models/admins.js');

var adminAuth = function(req, res, next){
    //authorize role
    if(typeof req.user != "undefined"){
        next();
    }else{
        //Not authorized redirect
        res.redirect('/');
    }
}

app.get('/login', function(req, res){
    res.render('login', { title: 'Login'});
});

app.post('/login', passport.authenticate('AdminLogin', 
    { successRedirect: '/list',
      failureRedirect: '/login',
      failureFlash: true }));

app.get('/list', adminAuth, function(req, res){
    var msg = req.flash('message');
    Persons.find({}, function(err, docs){
        res.render('list', { title: 'List', persons: docs, flashmsg: msg});
    });
});

app.get('/p/new', adminAuth, function(req, res){
    req.flash('message', 'You visited /new');
    res.render('new', { title: 'New'});
});

app.post('/p/new', adminAuth, function(req, res){
    console.log(req.body);
    var p = new Persons({ name: req.body.name, age: req.body.age });
    p.save(function(err, doc){
        if(!err){
            res.redirect('/list');
        } else {
            res.end(err);    
        }    
    });
});

app.get('/p/delete/:id', adminAuth, function(req, res){
    Persons.remove({ _id: req.params.id }, function(err, doc){
        if(!err){
            res.redirect('/list');
        } else {
            res.end(err);    
        }    
    });
});

app.get('/p/edit/:id', adminAuth, function(req, res){
    Persons.findOne({ _id: req.params.id }, function(err, doc){
        if(!err){
            res.render('edit', { title: 'Edit', person: doc});
        } else {
            res.end(err);    
        }    
    });
});

app.post('/p/edit/:id', adminAuth, function(req, res){
    Persons.findOne({ _id: req.params.id }, function(err, doc){
        if(!err){
            doc.name = req.body.name; 
            doc.age = req.body.age;
            doc.save(function(err, doc){
                if(!err){
                    res.redirect('/list');
                } else {
                    res.end(err);    
                }    
            }); 
        } else {
            res.end(err);    
        }    
    });
});
