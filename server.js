const express = require("express");
const app = express();
const path = require("path");
const adminroutes = require("./routes/adminroutes");
const userroutes = require("./routes/userroutes");
const session = require("express-session");
const nocache = require("nocache");
const connectdb = require("./db/connectdb");
const MongoStore = require("connect-mongo");
const hbs = require("hbs");
const Handlebars = require("./helper");
const exphbs = require("express-handlebars");
const passport = require("passport");
const methodOverride = require('method-override');
app.use(methodOverride('_method'));  // Enable the use of DELETE in forms
const Razorpay = require("razorpay");

const razorpay = new Razorpay({
    key_id: "rzp_test_27cbwJ6wd0CuiQ", // Replace with your Razorpay Key ID
    key_secret: "SfFbZ3vFL1AMEEY0ZvS4d1yF", // Replace with your Razorpay Key Secret
});
const PORT = process.env.PORT;

require("dotenv").config();
require("./config/passport");


// Session management
app.use(
  session({
    secret: "yourSecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  })
);

app.use(passport.initialize());
app.use(passport.session());
// Middleware
app.use(nocache());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static("uploads"));


// Register views and set view engine
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));

// Admin routes - set views path dynamically
app.use("/admin",(req, res, next) => {
    app.set("views", path.join(__dirname, "views"));
    next();
  },
  adminroutes
);

// User routes - set views path dynamically
app.use("/",(req, res, next) => {
    app.set("views", path.join(__dirname, "views/user"));
    next();
  },
  userroutes
);

//using helpers
app.engine(
  "hbs",
  exphbs.engine({
    extname: "hbs",
    defaultLayout: false, // Disable layout usage

    // layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: [
      path.join(__dirname, "views", "partials", "admin"),
      path.join(__dirname, "views", "partials", "user")
    ],
    runtimeOptions: {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true
    },
    
    helpers: {
       // JSON stringify helper
       JSONstringify: function (context) {
        return JSON.stringify(context);
      },

      // Helper to calculate subtotal
      calculateSubtotal: carts => {
        return carts.reduce((acc, item) => acc + item.total, 0);
      },

      // Helper to calculate shipping
      calculateShipping: carts => {
        return carts.reduce((acc, item) => acc + item.shippingrate, 0);
      },

      // Helper to calculate total (subtotal + shipping)
      calculateTotal: carts => {
        const subtotal = carts.reduce((acc, item) => acc + item.total, 0);
        const shipping = carts.reduce(
          (acc, item) => acc + item.shippingrate,
          0
        );
        return subtotal + shipping;
      },

      // Helper for date formatting
      formatDate: dateString => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      },
      contains: (array, value) => {
        if (!Array.isArray(array)) return false; // Ensure the first argument is an array
        return array.includes(value); // Check if the array contains the value
      },
      // Helper to build query string
      buildQuery: (
        query,
        sort,
        showOutOfStock,
        minPrice,
        maxPrice,
        category,
        rating,
        page
      ) => {
        return `query=${query || ""}&sort=${sort ||
          ""}&showOutOfStock=${showOutOfStock || "all"}&minPrice=${minPrice ||
          ""}&maxPrice=${maxPrice || ""}&category=${category ||
          "all"}&rating=${rating || "all"}&page=${page || 1}`;
      },
      range: (start, end) => {
        let result = [];
        for (let i = start; i <= end; i++) {
          result.push(i);
        }
        return result;
      },

      // Helper to check if two values are equal
      isEqual: (a, b) => {
        return a === b;
      },
      // Helper to multiply two values
      multiply: (price, quantity) => {
        return price * quantity;
      },
        // Helper to check if a number is in a given range
        isBetween: function (value, min, max) {
          return value >= min && value <= max
      },
      gte: (a,b)=>a>=b,
      // Helper to add two values
      add: (a, b) => a + b,

      // Helper to subtract two values
      subtract: (a, b) => a - b,

      // Helper for equality check
      eq: (a, b) => a === b,

      // Helper for greater than check
      gt: (a, b) => a > b,

      // Helper for less than check
      lt: (a, b) => a < b,

      // Helper for logical OR
      or: (a, b) => a || b,
      
      not: (a,b)=>a != b,

      neq: (a, b) =>a !== b,
      // Helper to return status icon based on status
      statusIcon: status => {
        switch (status) {
          case "delivered":
            return "✓";
          case "shipped":
            return "⏳";
          case "pending":
            return "🔄";
          default:
            return "•";
        }
      },

      // Helper to return the JSON representation of the context
      json: context => JSON.stringify(context)
    }
  })
);


// Start the server
app.listen(PORT, '0.0.0.0' ,() => {
  console.log(`Server is running on port ${PORT}`);
});
