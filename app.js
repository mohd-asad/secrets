require('dotenv').config();

const express=require('express');
const bodyParser=require('body-parser');
//const ejs=require('ejs');
const mongoose = require("mongoose");
//const encrypt = require('mongoose-encryption');
//const bcrypt= require('bcrypt'); 
//const saltRounds= 10;
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose =require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app=express();

mongoose.set("strictQuery",true);

app.use(bodyParser.urlencoded({extended:true}));
app.set('view engine','ejs');
app.use(express.static("public"));

app.use(session({
    secret:"our secret",
    resave: false,
    saveUninitialized:false
}));

app.use(passport.initialize());
app.use(passport.session());

main().catch((err)=> console.log(err));
async function main() {
    await mongoose.connect("mongodb://127.0.0.1:27017/userdb");
}

const userSchema= new mongoose.Schema({
    email: String,
    password: String,
    googleId:String,
    secret:String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User= new mongoose.model('User',userSchema);

passport.use(User.createStrategy());

//passport.serializeUser(User.serializeUser());
//passport.deserializeUser(User.deserializeUser());

passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(function(id, done) {
    User.findById(id) 
    .exec()
    .then((user)=>{
       done(null,user);
    });
  });

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/",function(req,res){
    res.render("home");
});

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/login",function(req,res){
    res.render("login");
});

app.get("/register",function(req,res){
    res.render("register");
});

app.get("/secrets", function(req,res){
    
  User.find({secret:{$ne:null}})
  .then((foundUsers)=>{
    res.render("secrets",{secretList:foundUsers});
  })
  .catch(err=>{
    if(err)
      console.log(err);
  });
});

app.get("/submit", function(req,res){
  if(req.isAuthenticated())
      res.render("submit");
  else
     res.redirect("/login");
});

app.get("/logout",function(req,res){
    req.logOut(function(err){
      if(err){
        console.log(err);
      }
    });
    res.redirect("/");
  });

app.post("/register",function(req,res){

    User.register({username: req.body.username}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.redirect("/register");
        }
        else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });
        }
    });
   /* bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        const newUser= new User({
            email: req.body.username,
            password: hash
        });
    
        newUser.save()
        .then (function(){
                res.render("secrets");
        })
        .catch(function(){
            console.log(err);
        });
    });*/
});

app.post("/login", function(req,res){

    const user= new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user,function(err){
        if(err)
          console.log(err);
        else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets");
            });
        }  
    });

    /*const username = req.body.username;
    const password = req.body.password;

    User.findOne({email: username}) 
    .then(function(foundUser){
        bcrypt.compare(password, foundUser.password, function(err, result) {
            if(result === true){
                res.render('secrets');
            }
        });  
    })
    .catch(function(err){console.log(err)});*/

});

app.post("/submit", function(req,res){

  User.findById(req.user.id)
  .then((foundUser)=>{
    if(foundUser){
      foundUser.secret=req.body.secret;
      foundUser.save();
      res.redirect("/secrets");
    }
  })
  .catch(err=>{
      if(err)
        console.log(err);
    });
});

app.listen(3000, function(){
    console.log("server is running on port 3000");
});
