const express = require("express");
const app = express();
const path = require("path");
const adminroutes = require("./routes/adminroutes");
const userroutes = require('./routes/userroutes');
const session = require("express-session");
const nocache = require("nocache");
const connectdb = require("./db/connectdb");
const MongoStore = require('connect-mongo');
const hbs = require('hbs'); 
const expressHbs = require('express-handlebars');
require('dotenv').config();
const methodOverride = require('method-override');
// const password=require("./config/passport");
const passport = require("passport");
require("./config/passport")

const PORT = process.env.PORT;

// Session management
app.use(session({
  secret: 'yourSecretKey',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));



app.use(passport.initialize());
app.use(passport.session());
// Middleware
app.use(methodOverride('_method'));
app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));


// Connect to the database
connectdb();


// Register Handlebars helpers
hbs.registerHelper('multiply', (price, quantity) => {
  return price * quantity;
});

hbs.registerHelper('eq', (a, b) => {
  return a === b;
});

hbs.registerHelper('gt', (a, b) => {
  return a > b;
});
hbs.registerHelper('eq', (a, b) => a === b);
hbs.registerHelper('or', (a, b) => a || b);

// Registering the formatDate helper
hbs.registerHelper('formatDate', (dateString) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
});

// Equals helper for selected option in dropdown
hbs.registerHelper('eq', (a, b) => a === b);

// Register views and set view engine
app.set('view engine', 'hbs');
app.set("views", path.join(__dirname, "views"));

// Admin routes - set views path dynamically
app.use("/admin", (req, res, next) => {
  app.set("views", path.join(__dirname, "views"));
  next();
}, adminroutes);

// User routes - set views path dynamically
app.use("/", (req, res, next) => {
  app.set("views", path.join(__dirname, "views/user"));
  next();
}, userroutes);

app.use(express.static('public'));


// Handlebars helper function to format date
hbs.registerHelper('formatDate', function(date) {
  const formattedDate = new Date(date).toLocaleDateString('en-GB'); // 'dd/mm/yyyy' format
  return formattedDate;
});

// Register a helper for checking equality
hbs.registerHelper("eq", (a, b) => a === b);

// Register a helper for status icons
hbs.registerHelper("statusIcon", (status) => {
  switch (status) {
    case "delivered": return "✓";
    case "shipped": return "⏳";
    case "pending": return "🔄";
    default: return "•";
  }
});

hbs.registerHelper('json', function (context) {
  return JSON.stringify(context); 
});

// Route handlers
// app.use("/admin", adminroutes);
// app.use("/", userroutes);

// app.set('view options', { layout: 'layout' });


// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
