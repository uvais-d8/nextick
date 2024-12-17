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

      return isProductMatch ;  
    });
     const formattedCoupons = filteredCoupons.map(coupon => ({
      ...coupon.toObject(),
      ExpiryDate: coupon.expiryDate.toLocaleString("en-GB") 
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
    const order = await Orders.findById(id).populate("items.productId", "name");
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

    // Calculate the price to subtract (based on priceWithDiscount if available)
    const priceToSubtract = item.priceWithDiscount ? item.priceWithDiscount : item.price;
    let updatedOrderTotal = order.orderTotal - (priceToSubtract * item.quantity);

    // Update the order total
    order.orderTotal = updatedOrderTotal;

    await order.save();

    // Update item status to 'canceled'
    await Orders.findOneAndUpdate(
      { _id: orderId, "items._id": itemId },
      { $set: { "items.$.status": "canceled" } }
    );

    const product = await Products.findById(item.productId);
    if (product) {
      // Now, update the stock based on the quantity
      product.stock += item.quantity;
      await product.save();

      // Refund handling (for Razorpay)
      if (order.paymentMethod === "razorpay") {
        let refundAmount = priceToSubtract * item.quantity;

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
      const itemId = req.params.id; // Order Item ID
      const userId = req.session.userId; // User ID from session
    
      console.log("Item ID:", itemId);
    
      try {
        // Step 1: Find the order and update the item status to "returned"
        const order = await Orders.findOneAndUpdate(
          { 'items._id': itemId, userId, 'items.status': 'delivered' }, // Ensure status is 'delivered'
          { $set: { 'items.$.status': 'returned' } }, // Update status to 'returned'
          { new: true }
        );
    
        if (!order) {
          return res.status(404).json({ success: false, message: "Order or item not found." });
        }
    
        // Step 2: Find the specific item in the order
        const item = order.items.find((item) => item._id.toString() === itemId);
        if (!item) {
          return res.status(404).json({ success: false, message: "Item not found in the order." });
        }
    
        // Step 3: Fetch product details and update stock
        const product = await Products.findById(item.productId);
        if (product) {
          product.stock += item.quantity; // Increase stock based on returned quantity
          await product.save();
          console.log(`Updated product stock: ${product.name}, New stock: ${product.stock}`);
        } else {
          console.warn(`Product not found for item: ${item.productId}`);
        }
    
        // Step 4: Calculate refund amount
        const refundAmount = (product?.discountedPrice || product?.price) * item.quantity;
    
        // Step 5: Update user's wallet
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
          // If no wallet exists, create a new one
          wallet = new Wallet({
            user: userId,
            balance: refundAmount,
            transactions: [
              {
                type: "refund",
                amount: refundAmount,
                description: `Refund for returned item (${product?.name || "Product"})`,
              },
            ],
          });
        } else {
          // Update existing wallet
          wallet.balance += refundAmount;
          wallet.transactions.push({
            type: "refund",
            amount: refundAmount,
            description: `Refund for returned item (${product?.name || "Product"})`,
          });
        }
    
        // Save the updated wallet
        await wallet.save();
    
        console.log(`Refund processed: Amount ${refundAmount} added to wallet.`);
    
        // Step 6: Return success response
        res.json({
          success: true,
          message: "Item successfully returned, refund processed, and product stock updated.",
          refundAmount,
          newWalletBalance: wallet.balance,
        });
      } catch (error) {
        console.error("Error processing return:", error.message);
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

    // Filter items to exclude canceled and delivered items
    const filteredItems = order.items.filter(item => item.status !== 'canceled');
    
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
      .text("NEXTICK", { align: "center" })
      .fontSize(10)
      .text("The Premium watch Store", { align: "center" })
      .text("Contact: support@NEXTICK.com | +91 7594 06 0696", { align: "center" })
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

    // ** Invoice Table Headers **
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("black")
      .text("     No     Product                                                            Price                          quantity     total Price  ", 55, doc.y, { width: 4000})


    doc
      .moveTo(50, doc.y)
      .lineTo(510, doc.y)
      .stroke();

    let totalPrice = 0;
    let rowStartY = doc.y;

    filteredItems.forEach((item, index) => {
      const product = item.productId;
      const rowY = rowStartY + index * 30; // Row height (30)

      doc
        .moveTo(50, rowY + 30)
        .lineTo(560, rowY + 30)
        .moveTo(50, rowY + 30)
        .stroke();

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("black")
        .text(index + 1, 55, rowY + 5, { width: 40, align: "center" }) // No column
        .text(product.name, 100, rowY + 5, { width: 200, align: "left" }); // Product name

      const unitPrice = item.priceWithDiscount || product.price;
      const totalItemPrice = item.quantity * unitPrice;

      // Display price and quantity
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("black")
        .text(`Rs ${unitPrice.toFixed(2)}`, 300, rowY + 5, { width: 80, align: "right" })
        .text(item.quantity, 380, rowY + 5, { width: 80, align: "right" })
        .text(`Rs ${totalItemPrice.toFixed(2)}`, 455, rowY + 5, { width: 90, align: "right" });

      // Update total price
      totalPrice += totalItemPrice;
    });

    const totalTableHeight = filteredItems.length * 30;
    doc
      .rect(50, rowStartY, 510, totalTableHeight)
      .stroke();

    // ** Total Section **
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .moveDown(3)
      .text(`Subtotal    : Rs ${totalPrice.toFixed(2)}`, 370, doc.y, { align: "right" })
      .moveDown(0.2)
      .text(`Grand Total : Rs ${order.orderTotal.toFixed(2)}`, 370, doc.y, { align: "right", underline: true })
      .moveDown(3);

    // ** Footer Section **
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#555")
      .text("Thank you for shopping with NEXTICK!", { align: "center" })
      .text("For support, contact us at support@NEXTICK.com ", { align: "center" })
      .text("Call on ph: +91 7594 0606 96", { align: "center" })
      .moveDown()
      .fillColor("#999")
      .fontSize(8)
      .text("NEXTICK - The Premium watches Store | All Rights Reserved.", { align: "center" });

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
