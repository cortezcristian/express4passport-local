var Admin = require('../models/admins');
var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/crudtest');

var a = new Admin({ name:"Cristian", age:27 });
a.save(function(err, doc){
    console.log(err, doc);    
});

