Express 4.x and Passport Auth Layer
=====================

A los fines de este tutorial, asumimos que haz completado [CRUD tutorial](https://github.com/cortezcristian/express4crud) anteriormente. Repasemos las urls principales de nuestra applicacion:

| URL           | Method | Descripción                          |
| :----         | :----: | :----                                |
| /list         | GET    | Lista todas las personas             |
| /p/new        | GET    | Muestra el form de creacion          |
| /p/new        | POST   | Se encarga de crear nuevas personas  |
| /p/delete/:id | GET    | Borra registros                      |
| /p/edit/:id   | GET    | Muestra el form de edición           |
| /p/edit/:id   | POST   | Edita la informacion de las personas |

Ahora queremos agregar una capa de autenticación local para las urls listadas. Para eso vamos a crear un rol administrador, que va a poder acceder a dichas urls privadas, luego de autenticarse en una url llamada `/login`. Ahora vamos a enumerar una lista de tareas que tenemos que completar para hacer todo esto posible.

1. Crear un modelo para el admin Admin. (Model: `./models/admin.js`)
2. Agregar un admin fixture, que pueda cargarse cada vez que iniciamos el servidor. (Con las siguientes credenciales: admin@admin.com:123456)
3. Crear la ruta `/login`. (Route: `./routes/main.js`)
4. Crear un formulario para el login. (View: `./views/login.jade`)
5. Crear una Local Strategy con Passport.
6. Manejar la submición del formulario via POST correspondiente a la ruta `/login`. (Route: `./routes/main.js`)
7. Usar la Local Strategy creada.
8. Securizar todas las rutas del ABM (CRUD) (Route: `./routes/main.js`)
9. Crear una ruta para el logout (Route: `./routes/main.js`)
10. Destruir los datos de sesión.
11. Agregar el botont de Sign-Off en el layout.

![Task Graph](https://raw.githubusercontent.com/cortezcristian/express4passport-local/master/pics/auth-layer-passport-local.png)

## Admin Model

Creamos un modelo bastante basico `./models/admins.js` con los campos mínimos e indispensables para alojar las credenciales:

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

Teniendo ese modelo basico creamos entonces un test `test/admins-test.js`:
```javascript
var Admin = require('../models/admins');
var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/crudtest');

var a = new Admin({ email:"admin@admin.com", password: "123456" });
a.save(function(err, doc){
    console.log(err, doc);    
});

```

Si lo corremos crearemos un admin.

```bash
$ node test/admins-test.js
null { __v: 0,
  email: 'admin@admin.com',
  password: '123456',
  _id: 546fe06f0aff37711bb5a517 }

```

Algo se ve bastante mal ahi. Se dieron cuenta? Guardar passwords en texto plano, no es una muy buena practica. Mejoremos entonces el modelo:

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
Agregamos el [modulo crypto](http://nodejs.org/api/crypto.html) para usar su método de creación de hashes MD5, también estamos agregando un [pre-save hook](http://mongoosejs.com/docs/api.html#schema_Schema-pre) en nuestra definición de schema. 

```bash
$ node test/admins-test.js 
null { __v: 0,
  email: 'admin@admin.com',
  password: 'e10adc3949ba59abbe56e057f20f883e',
  _id: 546fed1f3561b0641e4eb34b }
```

Como podemos apreciar cada vez que el campo password es modificado, automáticamente lo guardamos convertido en un hash MD5. Creamos un método de autenticación para poder confirmar cuando un password ingresado es correcto.

```javascript
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
+
+adminSchema.method('authenticate', function(password) {
+    return crypto.createHash('md5').update(password).digest("hex") === this.password;
+});

var adminModel = mongoose.model('Admins', adminSchema);

module.exports = adminModel;
```

Podemos testear el nuevo método modificando nuestro test `./test/admins-test.js`.

```javascript
var Admin = require('../models/admins');
var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/crudtest');

var a = new Admin({ email:"admin@admin.com", password: "123456" });
a.save(function(err, doc){
    console.log(err, doc);    
+
+    console.log("PasswordOK", a.authenticate("123456"));
+    console.log("PasswordFAIL", a.authenticate("incorrect"));
});

```

Podemos comprobar si nuestro método funciona:

```bash
$ node test/admins-test.js 
null { __v: 0,
  email: 'admin@admin.com',
  password: 'e10adc3949ba59abbe56e057f20f883e',
  _id: 546ff176b6c3be1a20c3a734 }
PasswordOK true
PasswordFAIL false
```

Eso es todo! Tenemos nuestro modelo Admin listo.

## Adding Fixtures

Los Fixtures son sets de datos que guardamos en un script y que sincronizamos con la BBDD cuando sea necesario. Son especialmente importantes cuando ejecutamos casos de prueba, o en los casos que queremos tener datos de ejemplo para nuestra applicación web. 
En este ejemplo vamos a usar [mongoose-fixtures](https://github.com/powmedia/mongoose-fixtures) para pre-cargar datos de personas y adminstradores cada vez que se inicie el servidor.

```bash
$ npm install --save mongoose-fixtures
```

Creamos una carpeta para guardar nuestros fixtures.

```bash
$ mkdir fixtures
```

Creamos un archivo para guardar los datos de las personas `fixtures/persons.js`:

```javascript
exports.Persons = [
    { name: 'Cristian', age: 27 },
    { name: 'Maria', age: 22 },
    { name: 'Ignacio', age: 32 }
];
```

Requerimos el paquete en nuestra `app.js`

```javascript
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session')
var flash = require('connect-flash');

var routes = require('./routes/index');
var users = require('./routes/user');

var mongoose = require('mongoose');
+var fixtures = require('mongoose-fixtures');

mongoose.connect('mongodb://localhost/crudtest');
+
+fixtures.load('./fixtures/persons.js');

var app = exports.app = express();
....
```

Corremos el servidor de nuevo:
```bash
$ npm start
```

Y en nuestro navegador vamos a [http://localhost:3000/list](http://localhost:3000/list):

![Fixtures List](https://raw.githubusercontent.com/cortezcristian/express4passport-local/master/pics/fixtures-list.png)

Como podras observar las fixtures de las personas se pre-cargaron y también podrás notar que cada vez que reinicies el servidor mongoose-fixtures vaciará primero las colleciones para luego rellenarlas con los set de datos especificados. Intenta borrar o agregar nuevas personas y reiniciar el server para experiementar este comportamiento.

Hagamos lo propio con los administradores, asi podemos tener por lo menos un administrador disponible durante nuestro trabajo de implementación. Agregamos lo siguiente al archivo `fixtures/admins.js`:

```javascript
exports.Admins = [
    { email: 'admin@admin.com', password: '123456' }
];

```

Seguido del siguiente cambio en `app.js`

```javascript
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session')
var flash = require('connect-flash');

var routes = require('./routes/index');
var users = require('./routes/user');

var mongoose = require('mongoose');
var fixtures = require('mongoose-fixtures');

mongoose.connect('mongodb://localhost/crudtest');

+fixtures.load('./fixtures/admins.js');
fixtures.load('./fixtures/persons.js');

```

También incluimos la llamada al nuevo modelo en `./routes/main.js`:

```javascript
var app = module.parent.exports.app;
var Persons = require('../models/persons.js');
+var Admins = require('../models/admins.js');

app.get('/list', function(req, res){
    var msg = req.flash('message');
    Persons.find({}, function(err, docs){
        res.render('list', { title: 'List', persons: docs, flashmsg: msg});
    });
});
.....
```

Felicitaciones! Hemos agregado exitosamente fixtures en nuestra applicación.

## Login Form

Creamos nuestro login form.

![Login Form](https://raw.githubusercontent.com/cortezcristian/express4passport-local/master/pics/login-form.png)

Para empezar, tenemos que agregar la ruta `/login`, en nuestro `./routes/main.js`:

```javascript
var app = module.parent.exports.app;
var Persons = require('../models/persons.js');
var Admins = require('../models/admins.js');

+app.get('/login', function(req, res){
+    res.render('login', { title: 'Login'});
+});
+
app.get('/list', function(req, res){
    var msg = req.flash('message');
```

En segundo lugar, tenemos que crear un archivo vista `./views/login.jade`:

```javascript
extends layout

block content
  h1= title
  form(action='/login',method='post')
    div
      label(for='email') E-mail:
      input(type='text', name='email', id='email', placeholder='E-mail here...')
    div
      label(for='password') Pasword:
      input(type='password', name='password', id='password', placeholder='Password...')
    div
      input(type='submit', value='Login')
  style.
    form label { min-width: 80px; display: inline-block; }
    form > div { padding: 5px; }
```

Finalmente seteamos el método POST para la ruta `/login` para recibir los datos que envia el form, por ahora solamente vamos a hacer un mock para recibir y mostrar esos datos en json. Modifiquemos `./routes/main.js`:

```javascript
var app = module.parent.exports.app;
var Persons = require('../models/persons.js');
var Admins = require('../models/admins.js');

app.get('/login', function(req, res){
    res.render('login', { title: 'Login'});
});

+app.post('/login', function(req, res){
+    res.json(req.body);
+});
+
app.get('/list', function(req, res){
    var msg = req.flash('message');
    Persons.find({}, function(err, docs){
```

Para probar todo vamos a [http://localhost:3000/login](http://localhost:3000/login), y si submitimos el form deberiamos poder ver una respuesta con los datos enviados en texto plano. No te preocupes vamos a volver a cambiar la funcionalidad de esta ruta mas adelante, avancemos con el siguiente paso.

![Post Login JSON](https://raw.githubusercontent.com/cortezcristian/express4passport-local/master/pics/login-form-json.png)

## Passport

Passport es un middleware de autenticación para Node.js, que funciona muy bien con Express, para saber mas podes visitar el sitio oficial [http://passportjs.org/](http://passportjs.org/). Passport te deja definir estrategias, para este projecto vamos a necestar el Passport core, y el paquete passport-local. Instalemos ambos:

```bash
$ npm install --save passport passport-local
```

Sigamos adelante linkeando passport en nuestra aplicación, en la cabecera de `app.js` requerimos passport:

```javascript
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session')
var flash = require('connect-flash');
+var passport = exports.passport = require('passport');

```

Cerca de la linea 33, podemos incluir lo siguiente:

```javascript
 app.use(bodyParser.urlencoded({
 app.use(cookieParser());
 app.use(express.static(path.join(__dirname, 'public')));
 app.use(session({secret: 'supersecret', saveUninitialized: true, resave: true}));
+app.use(passport.initialize());
+app.use(passport.session());
 app.use(flash());
 
+require('./auth/local-strategy.js');
+

```

De esa forma le hacemos saber a Express que estamos usando passport, nota que tambien estamos requiriendo un arhivo que va a contener la defincion de la Local Strategy.

Creamos una carpeta llamada `auth`:

```bash
$ mkdir auth
```

Y creamos un archivo para alojar nuestra passport strategy, llamemoslo `./auth/local-strategy.js`:

```javascript
var passport = module.parent.exports.passport,
  LocalStrategy = require('passport-local').Strategy,
  Admins = require('../models/admins.js');

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use('AdminLogin', new LocalStrategy(
  {
    usernameField: 'email',
    passwordField: 'password'
  },
  function(username, password, done) {
    Admins.findOne({ email:username }, function(err, adm) {
      if (err) { return done(err); }
      if (!adm) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!adm.authenticate(password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, adm);
    });
  }
));
```

Eso es! Nuestra estrategia esta definida! Es tiempo para empezar a usarla, hagamos el siguiente cambio en la ruta `/login` correspondiente al método POST en `./routes/main.js`:

```javascript
var app = module.parent.exports.app;
+var passport = module.parent.exports.passport;
var Persons = require('../models/persons.js');
var Admins = require('../models/admins.js');

app.get('/login', function(req, res){
    res.render('login', { title: 'Login'});
});

+app.post('/login', passport.authenticate('AdminLogin', 
+    { successRedirect: '/list',
+      failureRedirect: '/login',
+      failureFlash: true }));

app.get('/list', function(req, res){
    var msg = req.flash('message');
    Persons.find({}, function(err, docs){
        res.render('list', { title: 'List', persons: docs, flashmsg: msg});
    });
});
``` 

Así es como le estamos informando a la ruta que estrategia vamos a usar, y que deberá hacer en caso de éxito (success) o fracaso (failure). Ahora reinicimoe el servidor y vamos a testear nuestro form! [http://localhost:3000/login](http://localhost:3000/login)

Si ingresamos las credenciales `admin@admin.com : 123456` deberiamos ser redirigido a `/list`. Si ingresamos las credenciales incorrectas deberiamos seguir en [http://localhost:3000/login](http://localhost:3000/login).

## Headless Test

Es posible automatizar el tipo de test mencionados anteriormente. Hagamos que nuestros requerimientos cobren vida. Creamos un par de tests para probar lo siguiente.

`Success Test`

```
1. Ir a http://localhost:3000/login
2. Insertar email: admin@admin.com y password: 123456
3. Resultado esperado: ser redirigido a http://localhost:3000/panel
```

`Failure Test`

```
1. Ir a http://localhost:3000/login
2. Insertar email: admin@admin.com y password: incorrect
3. Resultado esperado: ser redirigido a http://localhost:3000/login
```

Para poder hacer esto, podemos usar [zombie.js](https://github.com/assaf/zombie/) que es un framework liviano para hacer headless testing, eso significa un navegador emulados que corre sin interfaz grafica (sin GUI). Para instalarlo, ejecutemos:

```bash
$ npm install zombie --save-dev
```

Una vez instalado podemos crear un archivo con un test sencillo, llamemoslo `./test/headless-tests.js`:

```javascript
var Browser = require('zombie');
var assert  = require('assert');

Browser.localhost('localhost', 3000);

// create new browser instance
var browser = Browser.create();

browser.visit('/login', function(err){
    browser
        .fill('email', 'admin@admin.com')
        .fill('password', '123456')
        .pressButton('Login', function(err){
            console.log('Success Test: ', browser.document.location.pathname);
        });
});

```

Para poder correr este test, necesitamos tener abierta nuestra webapp con express corriendo en una segunda consola:

`zombie.js test`

```bash
$ node test/headless-tests.js 

Success Test:  /list

```

Inspecciona la segunda termina donde esta corriendo express, y vas a poder ver las requests que dispara zombie.js:

`express server`

```bash
$ npm start

> express4crud@0.0.1 start /var/www/express4passport-local
> node ./bin/www

GET /login 200 263.565 ms - 708
POST /login 302 39.529 ms - 66
GET /list 200 35.769 ms - 892

```

Podemos ahcer un test similar para probar el otro caso, cuando falla, por ahora solo vamos a cambiar la linea que dice password y probar de nuevo:

```javascript
+        .fill('password', 'incorrect')
```

Mas adelante vamos a ordernar todos nuestros tests en una sola suite de testing.

## Securizando Rutas

Seria bueno poder agregar alguna validación extra, que prevenga a usuarios no autorizados de acceder a las rutas del ABM (CRUD). Podemos checkear si existen datos de sesión, para todos los usuarios autenticados express guarda los datos dentro de `req.user`. Para esto cremos un método interceptor llamado `adminAuth` para validar que existan los datos de sesión en `./routes/main.js`:

```javascript
var app = module.parent.exports.app;
var passport = module.parent.exports.passport;
var Persons = require('../models/persons.js');
var Admins = require('../models/admins.js');

+var adminAuth = function(req, res, next){
+    //authorize role
+    if(typeof req.user != "undefined"){
+        next();
+    }else{
+        //Not authorized redirect
+        res.redirect('/');
+    }
+}
+
app.get('/login', function(req, res){
    res.render('login', { title: 'Login'});
});

app.post('/login', passport.authenticate('AdminLogin', 
    { successRedirect: '/list',
      failureRedirect: '/login',
      failureFlash: true }));

+app.get('/list', adminAuth, function(req, res){
    var msg = req.flash('message');
    Persons.find({}, function(err, docs){
        res.render('list', { title: 'List', persons: docs, flashmsg: msg});
    });
});
```

Para cada ruta que querramos securizar necesimos agregar `adminAuth` como segundo parámetro, eso es por la naturaleza de la definición de rutas de express que nos permite anidar operaciones:

```javascript
app.get('/', operation1, operation2, operation3, function(req, res){
    /**
    * If code gets here it means all 3 operations passed and called next()
    */
    res.render('index', { title: 'Express'}); 
});
```
Ahora si intentaras acceder a [http://localhost:3000/list](http://localhost:3000/list) sin estar loggeado, vas a ser redireccionado a la home. Inspecciona la terminal que esta corriendo express, y presta especial atención a los 304 redirects:

```bash
$ npm start

> express4crud@0.0.1 start /var/www/express4passport-local
> node ./bin/www

GET / 304 330.696 ms - -
GET /css/style.css 200 4.117 ms - 111
GET /list 302 4.984 ms - 58
GET / 304 37.074 ms - -
GET /css/style.css 200 1.558 ms - 111
GET /list 302 2.479 ms - 58
GET / 304 16.337 ms - 

```

Por favor securiza todas las rutas agregando adminAuth como primera operación, exceptuando las rutas `/` y `/login`.

## Destruyendo los Datos de Sesión

Una vez que nos loggeamos no hay forma de desloggearnos agregremos un boton para poder salir. Para esto, necesitamos modificar el layout principal `./views/layout.jade`:

```jade
doctype html
html(lang='en')
  head
    meta(charset='UTF-8')
    meta(name='viewport', content='width=device-width')
    title= title
    block css
      link(rel='stylesheet', href='/css/style.css')
    block js
      script(src='http://localhost:35729/livereload.js')
  body
+    -if (user) {
+    ul#menu
+      li Welcome
+        b  #{user.email}
+      li
+        a(href="/logout") Sign-Off
+    style.
+      ul#menu { 
+        display:block; 
+        list-style: none;  
+        position: fixed;
+        top: 0;
+        background: #ccc;
+        margin: 0;
+        left: 0;
+        width: 100%;
+        padding: 10px 20px; 
+      }
+      ul#menu li { 
+        float: left; 
+        padding: 0 10px;
+      }
+    - }
    block content
```

Solo hemos agregado un menu y algo de estilos. Hagamos ahora que la variable user este disponible para todas las templates, agregando un interceptor en `./routes/main.js`:

```javascript
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

+app.use(function(req, res, next) {
+    res.locals.user = req.user;
+    next();
+});
+
app.get('/login', function(req, res){
    res.render('login', { title: 'Login'});
});

app.post('/login', passport.authenticate('AdminLogin', 
```

Si reiniciamos el servidor y nos loggeamos de vuelta, vamos a poder ver una barra en la parte superior:

![Logout Top Bar](https://raw.githubusercontent.com/cortezcristian/express4passport-local/master/pics/logout-view-change.png)

Ahora es tiempo de destruir los datos de sesión. Cada vez que los usuarios sean redirigidos a la url `/logout`, necesitamos desconectarlos completamente. Veamos los cambios necesarios en `./routes/main.js`:

```javascript
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

app.use(function(req, res, next) {
    res.locals.user = req.user;
    next();
});

app.get('/login', function(req, res){
    res.render('login', { title: 'Login'});
});

app.post('/login', passport.authenticate('AdminLogin', 
    { successRedirect: '/list',
      failureRedirect: '/login',
      failureFlash: true }));

+app.get('/logout', function(req, res){
+    req.logout();
+    res.redirect('/');
+});
+
app.get('/list', adminAuth, function(req, res){
    var msg = req.flash('message');
    Persons.find({}, function(err, docs){
        res.render('list', { title: 'List', persons: docs, flashmsg: msg});
    });
});
```

Bueno... lo logramos! Si llegaste hasta este punto significa que haz completado la integración de la capa de autenticación satisfactoriamente.

## Final

Si queres ver el demo completo, podes clonarte este repo.

```bash
$ git clone git@github.com:cortezcristian/express4passport-local.git
```

## Moving Forward

Durante los últimos 2 tutoriales estivimos generando, diferentes tipos de tests. Seria bueno agruparlos dentro de una única suite de testing con mocha. Ese será nuestro próximo tutorial.
