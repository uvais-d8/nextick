
const passport = require("passport");
const User = require("../model/usermodal");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const env = require("dotenv").config();

// const FacebookStrategy = require('passport-facebook').Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:7000/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const existUser = await User.findOne({ googleId: profile.id });
        if (existUser) {
          return done(null, existUser);
        } else {
          const newUser = await new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id
          });
          const savedUser = await newUser.save();
          return done(null, savedUser);
        }
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => [done(null, user.id)]);
passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err, null);
    });
});

module.exports = passport;
