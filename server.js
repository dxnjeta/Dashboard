if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const { google } = require('googleapis');

const express = require("express");
const GoogleStrategy = require('passport-google-oauth20');
const request = require('request');
const https = require('https');
const bodyParser = require("body-parser");
const bcrypt = require('bcrypt');
const passport = require('passport');
const path = require("path");
const flash = require('express-flash');
const session = require('express-session')
const methodOverride = require('method-override')
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const smtpTransport = require('nodemailer-smtp-transport');
const app = express()



const about = require('./about.json')

const users = []
var userProfile;

const initializePassport = require('./passport-config')
initializePassport(
  passport,
  email => users.find(user => user.email === email),
  id => users.find(user => user.id === id)
)

app.set('view-engine', 'ejs')

app.use(require('express-session')({ secret: 'keyboard cat', resave: true, saveUninitialized: true}))
app.use(passport.initialize())
app.use(passport.session())
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(bodyParser.urlencoded({ 
  extended : true
}))

// app.use(express.static(__dirname + '/public'));
app.use(express.static(path.join(__dirname, "public")));



app.use(methodOverride('_method'))

passport.use(new GoogleStrategy({
  clientID: "566212238794-0qmhbuhfgsnukdmuols3gd2f0j9ufcub.apps.googleusercontent.com",
  clientSecret: "kuUlzlJCofw-H-BHpGeSvnJm",
  callbackURL: "http://localhost:8080/auth/google/callback"
},
function(accessToken, refreshToken, profile, done) {
  userProfile=profile;
  return done(null, userProfile); // passes the profile data to serializeUser
}
));

// weatherapi
let appid = '6a093b7057e5a7dc9fb69f84e336ac5c';
// currency apikey
let apiKey = '33e20a23aa39677e5610';

// nodemailer
const transporter = nodemailer.createTransport(smtpTransport({    
  service: 'gmail',
  host: 'smtp.gmail.com', 
  auth: {        
       user: 'your_email@gmail.com',
       pass: 'password'
  }
}));

app.get('/mail', checkAuthenticated, (req, res) => {
  res.render('mail.ejs', { })
})

app.post("/send-mail", function(req,res){
  var to = req.body.to,
      subject = req.body.subject, 
      message = req.body.message;
  const mailOptions = {
       from: "dashboard.project.2021@gmail.com",
       to: to,
       subject: subject,
       html: message
   };
  transporter.sendMail(mailOptions, function(error, info){
       if (error) {
           console.log(error);
       } else {     
           console.log('Email sent: ' + info.response);  
       }   
  });
});
// until here

// currency


app.get('/currency', checkAuthenticated, (req, res) => {
  res.render('currency.ejs', { data: null, error: "Enter value to convert" })
})

//blla

app.post("/currency", (req, res) => {
  let toCurrency = req.body.toCurrency;
  let fromCurrency = req.body.fromCurrency;
  let amount = req.body.amount;

  console.log("tocurrency --->", toCurrency);
  console.log("fromcurrency --->", fromCurrency);
  console.log("amount --->", amount);

  fromCurrency = encodeURIComponent(fromCurrency);
  toCurrency = encodeURIComponent(toCurrency);
  var query = fromCurrency + '_' + toCurrency;

  var url = 'https://free.currconv.com/api/v7/convert?q='
            + query + '&compact=ultra&apiKey=' + apiKey;

  https.get(url, response => {
    var body = '';
    response.on('data', function(chunk){
        body += chunk;
    });

    response.on('end', function(){
        try {
          var jsonObj = JSON.parse(body);
          var val = jsonObj[query];
          if (val) {
            var total = val * amount;
            var total2 = Math.round(total * 100) / 100;
            console.log( Math.round(total * 100) / 100);
          } else {
            var err = new Error("Value not found for " + query);
            console.log(err);
          }
          res.render("currency.ejs", {
            data: jsonObj,
            firstCurrency: fromCurrency,
            secondCurrency: toCurrency,
            amountTo: amount,
            amountRes: total2,
            error: null
          })
        } catch(e) {
          res.render("currency.ejs", { data: null, error: "Enter value to convert" });
          console.log("Parse error: ", e);
        }
    });
}).on('error', function(e){
      console.log("Got an error: ", e);
});
});
// until here

app.get('/', checkAuthenticated, (req, res) => {
  res.render('index.ejs', { name: req.user.displayName })
})

app.get('/weather', checkAuthenticated, (req, res) => {
  res.render('weather.ejs', { data: null, error: "Enter a city name to check weather" })
})

app.post("/", (req, res) => {
  //getting users input
  let cityNames = req.body.citynames;

  //getting open weather endpoint
  const weatherData = `https://api.openweathermap.org/data/2.5/weather?q=${cityNames}&appid=${appid}&units=metric`;

  //requesting data from openWeather Servers
  https.get(weatherData, response => {

      response.on("data", data => {
          //use try and catch to catch all possible errors
          try {
              const allWeatherData = JSON.parse(data);
              const imageIcon = allWeatherData.weather[0].icon;
              const image = `http://openweathermap.org/img/wn/${imageIcon}@2x.png`;

              res.render("weather.ejs", {
                  data: allWeatherData,
                  img: image,
                  error: null
              });

          }
          catch (e) {
              res.render("weather.ejs", { data: null, error: "Enter a city name to get weather data" });
          }
      })
  })
})


// app.get('/', (req, res) => {
//   res.render('index.ejs', { name: userProfile.displayName })
// })


app.get('/main', checkNotAuthenticated, (req, res) => {
  res.render('main.ejs')
})


app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs')
})


app.get('/about.json', function(req, res) {
  res.json(about)
})

passport.serializeUser((user, cb) => {
  cb(null, user);
});

// Used to decode the received cookie and persist session
passport.deserializeUser((obj, cb) => {
  cb(null, obj);
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  }
);

app.post('/login', checkNotAuthenticated, passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true
}))

app.get('/register', checkNotAuthenticated, (req, res) => {
  res.render('register.ejs')
})

app.post('/register', checkNotAuthenticated, async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    users.push({
      id: Date.now().toString(),
      displayName: req.body.name,
      email: req.body.email,
      password: hashedPassword
    })
    res.redirect('/login')
  } catch {
    res.redirect('/register')
  }
})

app.delete('/logout', (req, res) => {
  req.logOut()
  res.redirect('/main')
})

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }

  res.redirect('/main')
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  next()
}

app.listen(8080, function () {
  console.log('Dashboard up on port 8080!');
});
