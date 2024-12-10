const Products = require("../model/productsmodal");
const Cart = require("../model/cartModel");
const Address = require("../model/addressModel");
const Orders = require("../model/ordersmodal");
const Coupons = require("../model/couponModel");
const Offer = require("../model/offermodel")
const Wallet = require("../model/walletModel");
const PDFDocument = require("pdfkit");
const fs = require("fs");

const failedpayment = async (req, res) => {
  const userId=req.session.user;
  const { paymentStatus } = req.body;

  try {
      const order = await Orders.findOneAndUpdate(
          { user:userId },
          { paymentStatus },
          { new: true }
      );

      if (!order) {
          return res.status(404).json({ message: 'Order not found' });
      }

      res.status(200).json({ message: 'Payment status updated successfully' });
  } catch (error) {
      console.error('Error updating payment status:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
};
const checkout = async (req, res) => {
  try {
    const userId = req.session.userId;

    const carts = await Cart.find({ user: userId })
      .populate("user")
      .populate("productId");
    const coupons = await Coupons.find({Status:true});

    if (!userId) {
      return res.redirect("/login");
    }

    const addresses = await Address.find({ user: userId });
    console.log("User ID:", userId);
 
    const cartProductNames = carts.map(item => item.productId.name);
    const cartCategories = carts.map(item =>
      item.productId.category.toString()
    );
    console.log(cartCategories);
     const filteredCoupons = coupons.filter(coupon => {
      const isProductMatch = coupon.Products.some(productName =>
        cartProductNames.includes(productName)
      );

      const isCategoryMatch = coupon.Categories.some(category =>
        cartCategories.includes(category)
      );

      return isProductMatch || isCategoryMatch;  
    });
     const formattedCoupons = filteredCoupons.map(coupon => ({
      ...coupon.toObject(),
      ExpiryDate: coupon.ExpiryDate.toLocaleString("en-GB") 
    }));

     if (!carts || carts.length === 0) {
      return res.render("cart", {
        carts: [], 
        message: "There are no items in your cart at the moment"
      });
    }
    const filteredCarts = carts.filter(cart => cart.productId.islisted);

    let subtotal = 0;
carts.forEach((item) => {
  if (item.priceWithDiscount) {
    subtotal += item.priceWithDiscount * item.quantity;
  } else {
    subtotal += item.productId.price * item.quantity;
  }
});

    const shippingRate = 50;
    const total = subtotal + shippingRate;

    carts.forEach(cart => {
      if (cart.productId.images && cart.productId.images.length > 0) {
        cart.firstImage = cart.productId.images[0];
      }
    });
    if (filteredCarts.length === 0) {
      res.render("cart", {
        carts,
        subtotal,
        shippingRate,
        total,
        message: "Your Cart items are not available"
      });
    } else {
      res.render("checkout", {
        addresses,
        coupons: formattedCoupons,
        carts: filteredCarts,
        subtotal,
        shippingRate,
        total
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};
const removeorder = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await Orders.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }
 
    if (order.status === "canceled") {
      return res
        .status(400)
        .json({ success: false, message: "Order is already canceled." });
    }

    await Promise.all(
      order.items.map(async item => {
        const product = await Products.findById(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      })
    );

     order.status = "canceled";
    await order.save();

    res.status(200).json({
      success: true,
      message: "Order canceled successfully and stock updated."
    });
  } catch (error) {
    console.error("Error canceling order:", error);
    res.status(500).json({ success: false, message: "Error canceling order." });
  }
};
const loadOrders = async (req, res) => {
  try {
    const orders = await Orders.find({ userId: req.session.userId })
      .populate({
        path: "items.productId",
        select: "name images description price",
      })
      .sort({ createdAt: -1 });

     const ordersWithTotals = orders.map(order => {
      let total = 0;

      order.items.forEach(item => {
        const price = item.priceWithDiscount || item.productId.price;
        total += price * item.quantity;
      });

      return {
        ...order.toObject(),
        total, 
      };
    });

    res.render("orders", { orders: ordersWithTotals });
  } catch (error) {
    console.error("Error during load orders", error);
    res.status(500).send("Failed to load orders.");
  }
};
const ordertracking = async (req, res) => {
  const { id } = req.params;
  try {
    const order = await Orders.findById(id);
    const product = await Products.findById(id);
    console.log("order",order);
    console.log("product",product);

    if (!order) {
      console.log("Order not found");
      return res.render("orders");
    }

     res.render("ordertracking", { order, product });
  } catch (error) {
    console.log("Error fetching order:", error);
    res.status(500).send("Server error");
  }
};
const loadViewDetails = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;
     const order = await Orders.findById(orderId)
      .populate("userId") 
      .populate("items.productId");  
     if (!order) {
      return res.status(404).send("Order not found");
    }
    const product = order.items.find(item => item._id.toString() === itemId);
    console.log(product);
    if (!product) {
      return res.status(404).send("Product not found in this order");
    }
    res.render("orderDetails", { order, product });
  } catch (error) {
    res.status(500).send(error);
    console.log("error: ", error);
  }
};
// const removeItem = async (req, res) => {
//   const user = req.session.userId;
//   const { orderId, itemId } = req.params;

//   try {
//     const order = await Orders.findOne({ _id: orderId });

//     if (!order || !order.items) {
//       return res.status(404).send("Order or items not found");
//     }

//     const item = order.items.find((item) => item._id.toString() === itemId);

//     if (!item) {
//       return res.status(404).json({ success: false, message: "Item not found in the order." });
//     }

//     if (item.status === "delivered") {
//       return res.status(400).json({
//         success: false,
//         message: "Item is already delivered and cannot be canceled."
//       });
//     }

//      await Orders.findOneAndUpdate(
//       { _id: orderId, "items._id": itemId },
//       { $set: { "items.$.status": "canceled" } }
//     );

//     const product = await Products.findById(item.productId);
//     if (product) {
//       product.stock += item.quantity;
//       await product.save();
//     } else {
//       console.warn("Product not found for stock update");
//     }
// if(order.paymentMethod==="razorpay"){


//     let refundAmount = 0;
//     if (product) {
//       refundAmount = (product?.discountedPrice || product?.price) * item.quantity;
//     }

//     if (refundAmount > 0) {
//       console.log("Refund amount:", refundAmount);

//       let wallet = await Wallet.findOne({ user: order.userId });

//       if (!wallet) {
//         wallet = new Wallet({
//           user: order.userId,
//           balance: refundAmount,
//           transactions: [
//             {
//               type: "refund",
//               amount: refundAmount,
//               description: `Refund for canceled product (${product?.name}) in order ${orderId}`
//             }
//           ]
//         });
//       } else {
//          wallet.balance += refundAmount;
//         wallet.transactions.push({
//           type: "refund",
//           amount: refundAmount,
//           description: `Refund for canceled product (${product?.name}) in order ${orderId}`
//         });
//       }
//       await wallet.save();
//     }
//   }
//      const updatedOrder = await Orders.findById(orderId);
//     if (updatedOrder.items.every((item) => item.status === "canceled")) {
//       updatedOrder.status = "canceled";
//       await updatedOrder.save();
//     }

//     res.json({ success: true, message: "Item successfully canceled" });
//   } catch (error) {
//     console.error("Error canceling order:", error);
//     res.status(500).send("Error updating order status");
//   }
// };

const removeItem = async (req, res) => {
  const user = req.session.userId;
  const { orderId, itemId } = req.params;

  try {
    const order = await Orders.findOne({ _id: orderId });

    if (!order || !order.items) {
      return res.status(404).send("Order or items not found");
    }

    const item = order.items.find((item) => item._id.toString() === itemId);

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in the order." });
    }

    if (item.status === "delivered") {
      return res.status(400).json({
        success: false,
        message: "Item is already delivered and cannot be canceled."
      });
    }

    await Orders.findOneAndUpdate(
      { _id: orderId, "items._id": itemId },
      { $set: { "items.$.status": "canceled" } }
    );

    const product = await Products.findById(item.productId);
    if (product) {
      // Calculate the discounted price if an offer exists
      let finalPrice = product.price; // Default price

      if (product.offer && product.offer.Status) {
        // Find the discount type and apply it
        const offer = await Offer.findById(product.offer);
        
        if (offer) {
          if (offer.DiscountType === "percentage") {
            finalPrice = product.price - (product.price * (offer.DiscountValue / 100));
          } else if (offer.DiscountType === "fixed") {
            finalPrice = product.price - offer.DiscountValue;
          }
        }
      }

      // Now, update the stock based on the quantity
      product.stock += item.quantity;
      await product.save();

      // Calculate refund amount based on the discounted price
      let refundAmount = finalPrice * item.quantity;

      if (refundAmount > 0) {
        console.log("Refund amount:", refundAmount);

        let wallet = await Wallet.findOne({ user: order.userId });

        if (!wallet) {
          wallet = new Wallet({
            user: order.userId,
            balance: refundAmount,
            transactions: [
              {
                type: "refund",
                amount: refundAmount,
                description: `Refund for canceled product (${product?.name}) in order ${orderId}`
              }
            ]
          });
        } else {
          wallet.balance += refundAmount;
          wallet.transactions.push({
            type: "refund",
            amount: refundAmount,
            description: `Refund for canceled product (${product?.name}) in order ${orderId}`
          });
        }
        await wallet.save();
      }
    } else {
      console.warn("Product not found for stock update");
    }

    // If all items are canceled, update the order status
    const updatedOrder = await Orders.findById(orderId);
    if (updatedOrder.items.every((item) => item.status === "canceled")) {
      updatedOrder.status = "canceled";
      await updatedOrder.save();
    }

    res.json({ success: true, message: "Item successfully canceled" });
  } catch (error) {
    console.error("Error canceling order:", error);
    res.status(500).send("Error updating order status");
  }
};




const returnOrder = async (req, res) => {
  const  itemId  = req.params.id; // Get the itemId directly from req.params
  console.log("itemId", itemId);

  const userId = req.session.userId; // Assuming userId is stored in the session

  try {
    // Find and update the item status to "returned" within the order
    const order = await Orders.findOneAndUpdate(
      { 'items._id': itemId, userId },  // Find order containing the itemId for the specific user
      { $set: { 'items.$.status': 'returned' } },  // Update the item status to "returned"
      { new: true }  // Return the updated order document
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "Order or item not found." });
    }

    // Find the item that was updated to confirm
    const item = order.items.find((item) => item._id.toString() === itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in the order." });
    }

    // Ensure the item was delivered before returning
    if (item.status !== "delivered") {
      return res.status(400).json({
        success: false,
        message: "Only delivered items are eligible for return.",
      });
    }

    // Update the stock for the product associated with the returned item
    const product = await Products.findById(item.productId);
    if (product) {
      product.stock += item.quantity;  // Increase stock based on returned quantity
      await product.save();
    }

    // Calculate the refund amount
    const refundAmount = (product?.discountedPrice || product?.price) * item.quantity;

    // Update wallet for the user
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = new Wallet({
        user: userId,
        balance: refundAmount,
        transactions: [
          {
            type: "refund",
            amount: refundAmount,
            description: `Refund for returned item (${product?.name})`,
          },
        ],
      });
    } else {
      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: "refund",
        amount: refundAmount,
        description: `Refund for returned item (${product?.name})`,
      });
    }
    await wallet.save();

    res.json({
      success: true,
      message: "Item successfully returned and refund processed.",
    });
  } catch (error) {
    console.error("Error processing return:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
};




const generateInvoicePDF = async (req, res) => {
  const { orderId } = req.params;

  try {
    // Fetch order details from the database
    const order = await Orders.findById(orderId).populate("items.productId");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const doc = new PDFDocument({ margin: 20 });

    // Set response headers for PDF download
    const filename = `Invoice_${orderId}.pdf`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    // Pipe the PDF stream to the response
    doc.pipe(res);

    // ** Header Section **
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .text("Watch Premium", { align: "center" })
      .fontSize(10)
      .text("The Premium Smartwatch Store", { align: "center" })
      .text("Contact: support@watchpremium.com | +91 7594 06 0696", { align: "center" })
      .moveDown(2);

    // ** Invoice Title **
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("INVOICE", { align: "center", underline: true })
      .moveDown();

    // ** Order and Customer Details **
    const address = order.shippingAddress;
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Order Details")
      .moveDown(0.5)
      .fontSize(11)
      .font("Helvetica")
      .text(`Order ID       : ${orderId}`)
      .text(`Order Date    : ${new Date(order.createdAt).toLocaleDateString()}`)
      // .text(`Order Status : scheduled`)
      .text(`Order Status : ${order.status}`)
      .moveDown(1);

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Billing & Shipping Address")
      .moveDown(0.5)
      .fillColor("black")

      .fontSize(11)
      .font("Helvetica")
      .text(`Name     :${address.firstname} ${address.lastname}`)
      .text(`Address :${address.address}`)
      .text(`Phone   : ${address.phone}`)
      .text(`Email    : ${address.email}`)
      .text(`Location:${address.place} , ${address.city} , ${address.pincode}`)
      .text(`district: ${address.district}`)
      .moveDown();


      
  // ** Table Header with Underline **
doc
.font("Helvetica-Bold")
.fontSize(11)
.fillColor("black")
.text("     No     Product                                                            Price                          quantity     total Price  ", 55, doc.y, { width: 4000})
// .text("Product", 100, doc.y, { width: 200, align: "left" })
// .text("Price", 300, doc.y, { width: 80, align: "right" })
// .text("Quantity", 380, doc.y, { width: 80, align: "right" })
// .text("Total", 450, doc.y, { width: 90, align: "right" })
.moveDown(0.2);

// Add underline for the header
doc
.moveTo(50, doc.y)
.lineTo(510, doc.y)
.stroke();

// ** Table Rows with Grid Lines **
let totalPrice = 0;
let rowStartY = doc.y; // Starting Y position for rows

order.items.forEach((item, index) => {
const product = item.productId;
// const totalItemPrice = item.quantity * product.price;

const rowY = rowStartY + index * 30; // Row height (30)

// Draw row separators (grid lines)
doc
  .moveTo(50, rowY + 30)
  .lineTo(560, rowY + 30)
  .moveTo(50, rowY + 30)
  .stroke();

// Draw row content with conditional pricing
doc
  .font("Helvetica")
  .fontSize(10)
  .fillColor("black")

  .text(index + 1, 55, rowY + 5, { width: 40, align: "center" }) // No column
  .text(product.name, 100, rowY + 5, { width: 200, align: "left" }); // Product name
// Calculate total price for the item
const unitPrice = item.priceWithDiscount || product.price; // Use discounted price if it exists, otherwise the regular price
const totalItemPrice = item.quantity * unitPrice;

// Draw row content
doc
  .font("Helvetica")
  .fontSize(10)
  .fillColor("black")
  .text(index + 1, 55, rowY + 5, { width: 40, align: "center" }) // No column
  .text(product.name, 100, rowY + 5, { width: 200, align: "left" });

// Conditional pricing display
if (item.priceWithDiscount && item.priceWithDiscount !== product.price) {
  // Strike-through for original price
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("red")
    .text(`Rs ${product.price.toFixed(2)}`, 300, rowY + 5, { width: 80, align: "right" });

  // Line over the original price
  const priceWidth = doc.widthOfString(`Rs ${product.price.toFixed(2)}`);
  const priceX = 300 + (80 - priceWidth);
  doc
    .moveTo(priceX, rowY + 10)
    .lineTo(priceX + priceWidth, rowY + 10)
    .strokeColor("black")
    .stroke();

  // Display discounted price
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("black")
    .text(`Rs ${item.priceWithDiscount.toFixed(2)}`, 300, rowY + 20, { width: 80, align: "right" });
} else {
  // Show regular price if no discount exists or prices are the same
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("black")
    .text(`Rs ${product.price.toFixed(2)}`, 300, rowY + 5, { width: 80, align: "right" });
}


// Quantity
doc
  .font("Helvetica")
  .fontSize(10)
  .fillColor("black")
  .text(item.quantity, 380, rowY + 5, { width: 80, align: "right" });

// Total item price
doc
  .font("Helvetica")
  .fontSize(10)
  .fillColor("black")
  .text(`Rs ${totalItemPrice.toFixed(2)}`, 455, rowY + 5, { width: 90, align: "right" });

// Update total price
totalPrice += totalItemPrice;
});

// Draw border for the entire table
const totalTableHeight = order.items.length * 30;
doc
.rect(50, rowStartY, 510, totalTableHeight)
.stroke();


// Initialize totals and discount calculation
let actualTotal = 0;
let discountedTotal = 0;

// Calculate totals and discount dynamically
order.items.forEach((item) => {
  const product = item.productId;
  const unitPrice = item.priceWithDiscount || product.price; // Get discounted price or actual price

  
  // Actual total is based on original prices (before discount)
  actualTotal += product.price * item.quantity;

  // Discounted total is based on discounted price
  discountedTotal += unitPrice * item.quantity;
});

// Calculate total discount
const totalDiscount = actualTotal - discountedTotal;

// Final Grand Total
const finalTotal = discountedTotal;

const orderTotal = order.orderTotal;
console.log("orderTotal",orderTotal)
// Draw Totals in the PDF
doc
  .font("Helvetica-Bold")
  .fontSize(12)
  .moveDown(3)
  .text(`Subtotal    : Rs ${finalTotal.toFixed(2)}`, 370, doc.y, { align: "right" })
  .moveDown(0.2)
  .text(`Discount    :   Rs ${totalDiscount.toFixed(2)}`, 370, doc.y, { align: "right" })
  .moveDown(0.2)
  .text(`Grand Total : Rs ${orderTotal.toFixed(2)}`, 370, doc.y, { align: "right", underline: true })
  .moveDown(3)

    // ** Footer Section **
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#555")
      .text("Thank you for shopping with Watch Premium!", { align: "center" })
      .text("For support, contact us at support@watchpremium.com ", {
        align: "center",
      })
      .text("call on ph: +91 7594 0606 96", {
        align: "center",
      })
      .moveDown()
      .fillColor("#999")
      .fontSize(8)
      .text("Watch Premium - The Premium Smartwatch Store | All Rights Reserved.", {
        align: "center",
      });

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    res.status(500).json({ success: false, message: "Failed to generate PDF" });
  }
};



module.exports = {
  generateInvoicePDF,
   ordertracking,
  removeorder,
  removeItem,
  checkout,
  loadOrders,
  loadViewDetails,
  failedpayment,
  returnOrder
};
