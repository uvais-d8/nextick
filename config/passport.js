
const passport = require("passport");
const User = require("../model/usermodal");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const env = require("dotenv").config();
 
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback"
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const existUser = await User.findOne({ googleId: profile.id });
        console.log(existUser)
        if (existUser) {
          return done(null, existUser);
        } else {
          const newUser = await new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id
          });
          const savedUser = await newUser.save();
          console.log(savedUser)
          req.session.userId = savedUser._id;
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
