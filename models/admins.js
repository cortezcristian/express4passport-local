var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crypto = require('crypto');

var adminSchema = new Schema({
    email: String,
    password: String
});

/**
 * Pre-Save Hook
 * http://mongoosejs.com/docs/api.html#schema_Schema-pre
 */

adminSchema.pre("save", function(next) {
    if(this.isModified('password'))
        this.password = crypto.createHash('md5').update(this.password).digest("hex");
    next();
});

var adminModel = mongoose.model('Admins', adminSchema);

module.exports = adminModel;
