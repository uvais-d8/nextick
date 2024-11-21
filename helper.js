const Handlebars = require("handlebars");

// Helper to calculate subtotal
Handlebars.registerHelper('calculateSubtotal', (carts) => {
    return carts.reduce((acc, item) => acc + item.total, 0);
});

// Helper to calculate shipping
Handlebars.registerHelper('calculateShipping', (carts) => {
    return carts.reduce((acc, item) => acc + item.shippingrate, 0);
});

// Helper to calculate total (subtotal + shipping)
Handlebars.registerHelper('calculateTotal', (carts) => {
    const subtotal = carts.reduce((acc, item) => acc + item.total, 0);
    const shipping = carts.reduce((acc, item) => acc + item.shippingrate, 0);
    return subtotal + shipping;
});

// Register a Handlebars helper for date formatting
Handlebars.registerHelper('formatDate', function (dateString) {
    const date = new Date(dateString); // Convert to Date object
    // Format as dd/mm/yyyy
    const formattedDate = date.toLocaleDateString("en-GB");
    return formattedDate;
});

Handlebars.registerHelper('add', (a, b) => a + b);
Handlebars.registerHelper('subtract', (a, b) => a - b);
