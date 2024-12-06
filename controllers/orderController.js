const Products = require("../model/productsmodal");
const Cart = require("../model/cartModel");
const Address = require("../model/addressModel");
const Orders = require("../model/ordersmodal");
const Coupons = require("../model/couponModel");
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
    console.log(orderId, itemId);
    const order = await Orders.findById(orderId)
      .populate("userId") 
      .populate("items.productId");  
    console.log(order.items);
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

     await Orders.findOneAndUpdate(
      { _id: orderId, "items._id": itemId },
      { $set: { "items.$.status": "canceled" } }
    );

    const product = await Products.findById(item.productId);
    if (product) {
      product.stock += item.quantity;
      await product.save();
    } else {
      console.warn("Product not found for stock update");
    }
if(order.paymentMethod==="razorpay"){


    let refundAmount = 0;
    if (product) {
      refundAmount = (product?.discountedPrice || product?.price) * item.quantity;
    }

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
  }
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
  const { orderId, itemId } = req.params; // Accept both orderId and itemId for flexibility
  const userId = req.session.userId; // Assuming userId is stored in the session

  try {
    const order = await Orders.findOne({ _id: orderId });

    if (!order || !order.items) {
      return res.status(404).json({ success: false, message: "Order or items not found." });
    }

    // Handle item return if itemId is provided
    if (itemId) {
      const item = order.items.find((item) => item._id.toString() === itemId);

      if (!item) {
        return res.status(404).json({ success: false, message: "Item not found in the order." });
      }

      if (item.status !== "delivered") {
        return res.status(400).json({
          success: false,
          message: "Only delivered items are eligible for return.",
        });
      }

      // Update product stock
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      }

      // Calculate refund amount
      const refundAmount =
        (product?.discountedPrice || product?.price) * item.quantity;

      // Update wallet
      let wallet = await Wallet.findOne({ user: userId });
      if (!wallet) {
        wallet = new Wallet({
          user: userId,
          balance: refundAmount,
          transactions: [
            {
              type: "refund",
              amount: refundAmount,
              description: `Refund for returned item (${product?.name}) in order ${orderId}`,
            },
          ],
        });
      } else {
        wallet.balance += refundAmount;
        wallet.transactions.push({
          type: "refund",
          amount: refundAmount,
          description: `Refund for returned item (${product?.name}) in order ${orderId}`,
        });
      }
      await wallet.save();

      // Update item status to "returned"
      item.status = "returned";
      await order.save();

      res.json({
        success: true,
        message: "Item successfully returned and refund processed.",
      });
    } else {
      // Handle full order return if no itemId is provided
      if (order.status !== "delivered") {
        return res.status(400).json({
          success: false,
          message: "Only delivered orders are eligible for return.",
        });
      }

      // Update stock for all items in the order
      for (const item of order.items) {
        const product = await Products.findById(item.product);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }

      // Calculate refund amount
      const refundAmount = order.totalAmount;

      // Update wallet
      let wallet = await Wallet.findOne({ user: userId });
      if (!wallet) {
        wallet = new Wallet({
          user: userId,
          balance: refundAmount,
          transactions: [
            {
              type: "refund",
              amount: refundAmount,
              description: `Refund for returned order ${orderId}`,
            },
          ],
        });
      } else {
        wallet.balance += refundAmount;
        wallet.transactions.push({
          type: "refund",
          amount: refundAmount,
          description: `Refund for returned order ${orderId}`,
        });
      }
      await wallet.save();

      // Update order status to "returned"
      order.status = "returned";
      order.items.forEach((item) => {
        item.status = "returned";
      });
      await order.save();

      res.json({
        success: true,
        message: "Order successfully returned and refund processed.",
      });
    }
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

    const doc = new PDFDocument({ margin: 40 });

    // Set response headers for PDF download
    res.setHeader("Content-Disposition", `attachment; filename=invoice_${orderId}.pdf`);
    res.setHeader("Content-Type", "application/pdf");

    // Pipe the PDF stream to the response
    doc.pipe(res);

    /** HEADER SECTION **/
    // Branding Header
    doc
      .text("watch premium", 50, 30, { width: 50 }) // Add your logo here
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("Watch Premium", 110, 40, { align: "center" })
      .fontSize(10)
      .text("The Premium Smartwatch Store", 110, 60, { align: "center" })
      .text("Contact: support@watchpremium.com | +91 9876543210", 110, 75, { align: "center" })
      .moveDown();

    // Invoice Title
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("INVOICE", { align: "center", underline: true })
      .moveDown();

    /** ORDER DETAILS **/
    const address = order.shippingAddress;
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Order Details:", { underline: true })
      .moveDown(0.5)
      .font("Helvetica")
      .text(`Order ID: ${orderId}`, { align: "left" })
      .text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: "left" })
      .text(`Order Status: ${order.status}`, { align: "left" })
      .moveDown(1)
      .font("Helvetica-Bold")
      .text("Billing & Shipping Address:", { underline: true })
      .moveDown(0.5)
      .font("Helvetica")
      .text(`${address.firstname} ${address.lastname}`)
      .text(`${address.address}`)
      .text(`${address.place}, ${address.city}, ${address.district}, ${address.pincode}`)
      .text(`Phone: ${address.phone}`)
      .text(`Email: ${address.email}`)
      .moveDown();

    /** TABLE HEADER **/
    doc
      // .fillColor("#ffffff")
      .rect(50, doc.y, 500, 20)
      // .fill("#2c3e50")
      // .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("No", 60, doc.y + 5, { width: 40, align: "center" })
      .text("Product", 100, doc.y + 5, { width: 200, align: "left" })
      .text("Price", 300, doc.y + 5, { width: 80, align: "right" })
      .text("Quantity", 380, doc.y + 5, { width: 80, align: "right" })
      .text("Total", 460, doc.y + 5, { width: 90, align: "right" })
      .moveDown(1);

    /** TABLE ROWS **/
    let totalPrice = 0;
    order.items.forEach((item, index) => {
      const product = item.productId;
      const totalItemPrice = item.quantity * product.price;

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#000")
        .text(index + 1, 60, doc.y, { width: 40, align: "center" })
        .text(product.name, 100, doc.y, { width: 200, align: "left" })
        .text(`₹${product.price.toFixed(2)}`, 300, doc.y, { width: 80, align: "right" })
        .text(item.quantity, 380, doc.y, { width: 80, align: "right" })
        .text(`₹${totalItemPrice.toFixed(2)}`, 460, doc.y, { width: 90, align: "right" })
        .moveDown(0.5);

      totalPrice += totalItemPrice;
    });

    /** TOTALS SECTION **/
    const discount = order.discount || 0;
    const finalTotal = totalPrice - discount;

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .moveDown(1)
      .text(`Subtotal: ₹${totalPrice.toFixed(2)}`, 400, doc.y, { align: "right" })
      .text(`Discount: ₹${discount.toFixed(2)}`, 400, doc.y, { align: "right" })
      .text(`Grand Total: ₹${finalTotal.toFixed(2)}`, 400, doc.y, { align: "right", underline: true })
      .moveDown();

    /** FOOTER **/
    doc
      .moveDown(2)
      .fontSize(10)
      .fillColor("#555")
      .text("Thank you for shopping with Watch Premium!", { align: "left" })
      .text("We appreciate your business.", { align: "left" })
      .moveDown()
      .text("For support, contact us at support@watchpremium.com or call +91 9876543210.", {
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
