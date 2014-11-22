Express 4.x and Passport Local Example
=====================

We are assuming that you already completed the [CRUD tutorial](https://github.com/cortezcristian/express4crud). The main application has this urls:

| URL           | Method | Description              |
| :----         | :----: | :----                    |
| /list         | GET    | List all persons         |
| /p/new        | GET    | Displays creation form   |
| /p/new        | POST   | Handles persons creation |
| /p/delete/:id | GET    | Delete records           |
| /p/edit/:id   | GET    | Display edit form        |
| /p/edit/:id   | POST   | Edit persons information |

Now we want to add a local authentication layer to protect the listed urls. We are creating an administrator role, that'll access the private urls via login in a new url called `/login`. Let's enumerate a list of tasks we do need to accomplish for this to happen:

1. Create Admin model. (Model: `./models/admin.js`)
2. Add an admin fixture, to be preloaded when server start. (Credentials: admin@admin.com:123456)
3. Create `/login` route. (Route: `./routes/main.js`)
4. Create a login form. (View: `./views/login.jade`)
5. Create Passport Local Strategy
6. Handle login form via POST to `/login`. (Route: `./routes/main.js`)
7. Use Local Strategy
8. Securitize CRUD routes (Route: `./routes/main.js`)
9. Create Logout route (Route: `./routes/main.js`)
10. Destroy Session Data
11. Add Log-out button into the layout

![Task Graph](https://raw.githubusercontent.com/cortezcristian/express4passport-local/master/pics/auth-layer-passport-local.png)

## Create Admin Model

Let's create a basic model `./models/admins.js` with basic credentials fields like so:

```javascript
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var adminSchema = new Schema({
    email: String,
    password: String
});

var adminModel = mongoose.model('Admins', adminSchema);

module.exports = adminModel;
```

So we have the basic model, let's create a basic test `test/admins-test.js`:
```javascript
var Admin = require('../models/admins');
var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/crudtest');

var a = new Admin({ email:"admin@admin.com", password: "123456" });
a.save(function(err, doc){
    console.log(err, doc);    
});

```

If we run this, we'll create an admin.

```bash
$ node test/admins-test.js
null { __v: 0,
  email: 'admin@admin.com',
  password: '123456',
  _id: 546fe06f0aff37711bb5a517 }

```

Something is really bad here. Did you noticed? We are storing a plain password, that's not good let's improve our model a little bit:

```javascript
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
+var crypto = require('crypto');

var adminSchema = new Schema({
    email: String,
    password: String
});

+/**
+ * Pre-Save Hook
+ * http://mongoosejs.com/docs/api.html#schema_Schema-pre
+ */
+
+adminSchema.pre("save", function(next) {
+    if(this.isModified('password'))
+        this.password = crypto.createHash('md5').update(this.password).digest("hex");
+    next();
+});

var adminModel = mongoose.model('Admins', adminSchema);

module.exports = adminModel;
```
We just added the [crypto module](http://nodejs.org/api/crypto.html) to use the MD5 hash creation method, we are also adding functionallity to add a [pre-save hook](http://mongoosejs.com/docs/api.html#schema_Schema-pre) to our schema definition. 

```bash
$ node test/admins-test.js 
null { __v: 0,
  email: 'admin@admin.com',
  password: 'e10adc3949ba59abbe56e057f20f883e',
  _id: 546fed1f3561b0641e4eb34b }
```

As we can see now if password is modified we automatically turn that into a MD5 hash.
