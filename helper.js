// const Handlebars = require("handlebars");

// // Helper to calculate subtotal
// Handlebars.registerHelper("calculateSubtotal", carts => {
//   return carts.reduce((acc, item) => acc + item.total, 0);
// });

// // Helper to calculate shipping
// Handlebars.registerHelper("calculateShipping", carts => {
//   return carts.reduce((acc, item) => acc + item.shippingrate, 0);
// });

// // Helper to calculate total (subtotal + shipping)
// Handlebars.registerHelper("calculateTotal", carts => {
//   const subtotal = carts.reduce((acc, item) => acc + item.total, 0);
//   const shipping = carts.reduce((acc, item) => acc + item.shippingrate, 0);
//   return subtotal + shipping;
// });

// // Register a Handlebars helper for date formatting
// Handlebars.registerHelper("formatDate", function(dateString) {
//   const date = new Date(dateString); // Convert to Date object
//   // Format as dd/mm/yyyy
//   const formattedDate = date.toLocaleDateString("en-GB");
//   return formattedDate;
// });

// // Registering the formatDate helper
// Handlebars.registerHelper('formatDate', (dateString) => {
//     const date = new Date(dateString);
//     const day = String(date.getDate()).padStart(2, '0');
//     const month = String(date.getMonth() + 1).padStart(2, '0');
//     const year = date.getFullYear();
//     return `${day}/${month}/${year}`;
//   });

  
// Handlebars.registerHelper("buildQuery", function(
//   query,
//   sort,
//   showOutOfStock,
//   minPrice,
//   maxPrice,
//   category,
//   rating,
//   page
// ) {
//   return `query=${query || ""}&sort=${sort ||
//     ""}&showOutOfStock=${showOutOfStock || "all"}&minPrice=${minPrice ||
//     ""}&maxPrice=${maxPrice || ""}&category=${category ||
//     "all"}&rating=${rating || "all"}&page=${page || 1}`;
// });


// // Register Handlebars helpers
// Handlebars.registerHelper("multiply", (price, quantity) => {
//   return price * quantity;
// });
// Handlebars.registerHelper("add", (a, b) => a + b);
// Handlebars.registerHelper("subtract", (a, b) => a - b);

// Handlebars.registerHelper("eq", (a, b) => {
//   return a === b;
// });

// Handlebars.registerHelper("gt", (a, b) => {
//   return a > b;
// });
// Handlebars.registerHelper("eq", (a, b) => a === b);
// Handlebars.registerHelper("or", (a, b) => a || b);


// // Handlebars helper function to format date
// Handlebars.registerHelper('formatDate', function(date) {
//     const formattedDate = new Date(date).toLocaleDateString('en-GB'); // 'dd/mm/yyyy' format
//     return formattedDate;
//   });
  
//   // Register a helper for checking equality
//   Handlebars.registerHelper("eq", (a, b) => a === b);
  
//   // Register a helper for status icons
//   Handlebars.registerHelper("statusIcon", (status) => {
//     switch (status) {
//       case "delivered": return "✓";
//       case "shipped": return "⏳";
//       case "pending": return "🔄";
//       default: return "•";
//     }
//   });
  
//   Handlebars.registerHelper('add', (a, b) => a + b);
//   Handlebars.registerHelper('subtract', (a, b) => a - b);
  
//   Handlebars.registerHelper('json', function (context) {
//     return JSON.stringify(context); 
//   });
//   // Date formatting helper
//   Handlebars.registerHelper("formatDate", dateString => {
//     const date = new Date(dateString);
  
//     // Get day, month, and year
//     const day = String(date.getDate()).padStart(2, "0"); // Pad day
//     const month = String(date.getMonth() + 1).padStart(2, "0"); // Pad month
//     const year = date.getFullYear();
  
//     return `${day}/${month}/${year}`; // Return in DD/MM/YYYY format
//   });


//   module.exports = Handlebars;