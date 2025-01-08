const passport = require("passport");
const User = require("../model/usermodal");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
require("dotenv").config();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          console.log("Existing user found:", user);
          return done(null, user);
        } else {
          const newUser = new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
            referralCode,
          });

          const savedUser = await newUser.save();
          console.log("New user created:", savedUser);

          req.session.userId = savedUser._id;
          return done(null, savedUser);
        }
      } catch (error) {
        console.error("Error in Google Strategy:", error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id)
    .then(user => {
      done(null, user);
    })
    .catch(err => {
      done(err, null);
    });
});

const generateReferralCode = () => {
  const prefix = "NEXTICK";
  const randomString = Math.random().toString(36).substr(2, 5).toUpperCase();
  const timestamp = Date.now().toString(36).slice(-3).toUpperCase();

  return `${prefix}${randomString}${timestamp}`;
};

const referralCode = generateReferralCode();

module.exports = passport;
