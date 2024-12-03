const Products = require("../model/productsmodal");
const Cart = require("../model/cartModel");
const Address = require("../model/addressModel");
const Orders = require("../model/ordersmodal");
const Coupons = require("../model/couponModel");
const Wallet = require("../model/walletModel");

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

    // Get product names from the cart
    const cartProductNames = carts.map(item => item.productId.name);
    const cartCategories = carts.map(item =>
      item.productId.category.toString()
    );
    console.log(cartCategories);
    // Filter coupons
    const filteredCoupons = coupons.filter(coupon => {
      const isProductMatch = coupon.Products.some(productName =>
        cartProductNames.includes(productName)
      );

      const isCategoryMatch = coupon.Categories.some(category =>
        cartCategories.includes(category)
      );

      return isProductMatch || isCategoryMatch; // Match by either product or category
    });
    // Format filtered coupons
    const formattedCoupons = filteredCoupons.map(coupon => ({
      ...coupon.toObject(),
      ExpiryDate: coupon.ExpiryDate.toLocaleString("en-GB") // Include date and time
    }));

    // If no items in the cart, render the page with a message
    if (!carts || carts.length === 0) {
      return res.render("cart", {
        carts: [], // Pass an empty array to avoid errors
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

    // Check if the order is already canceled
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

    // Update the order status to "canceled"
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
// const removeItem = async (req, res) => {
//   const { orderId, itemId } = req.params;
//   try {
//     const order = await Orders.findOne({ _id: orderId, "items._id": itemId });

//     if (!order) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Order or item not found." });
//     }

//     const item = order.items.find(item => item._id.toString() === itemId);

//     if (!item) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Item not found in the order." });
//     }

//     // Check if the item's status is 'delivered'
//     if (item.status === "delivered") {
//       return res.status(400).json({
//         success: false,
//         message: "Item is already delivered and cannot be canceled."
//       });
//     }

//     // Update the item status to "canceled"
//     await Orders.findOneAndUpdate(
//       { _id: orderId, "items._id": itemId },
//       { $set: { "items.$.status": "canceled" } }
//     );

//     const product = await Products.findById(item.productId);
//     if (product) {
//       product.stock += item.quantity;
//       await product.save();
//     } else {
//       return res
//         .status(404)
//         .json({ success: false, message: "Associated product not found." });
//     }

//     res
//       .status(200)
//       .json({ success: true, message: "Item canceled successfully." });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: "Error canceling item." });
//   }
// };

const loadOrders = async (req, res) => {
  try {
    const orders = await Orders.find({ userId: req.session.userId })
      .populate({
        path: "items.productId",
        select: "name images description price",
      })
      .sort({ createdAt: -1 });

    // Add calculated totals to each order
    const ordersWithTotals = orders.map(order => {
      let total = 0;

      order.items.forEach(item => {
        const price = item.priceWithDiscount || item.productId.price;
        total += price * item.quantity;
      });

      return {
        ...order.toObject(),
        total, // Add total to the order object
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
    console.log(order);
    console.log(product);

    if (!order) {
      console.log("Order not found");
      return res.render("orders");
    }

    // Render the order details on the tracking page
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
      .populate("userId") // Populate the user
      .populate("items.productId"); // Populate the productId for each item in the items array
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

// const removeItem = async (req, res) => {
//   const { orderId, itemId } = req.params;
//   try {
//     const order = await Orders.findOne({ _id: orderId, "items._id": itemId });

//     if (!order) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Order or item not found." });
//     }

//     const item = order.items.find(item => item._id.toString() === itemId);

//     if (!item) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Item not found in the order." });
//     }

//     // Check if the item's status is 'delivered'
//     if (item.status === "delivered") {
//       return res.status(400).json({
//         success: false,
//         message: "Item is already delivered and cannot be canceled."
//       });
//     }

//     // Update the item status to "canceled"
//     await Orders.findOneAndUpdate(
//       { _id: orderId, "items._id": itemId },
//       { $set: { "items.$.status": "canceled" } }
//     );

//     const product = await Products.findById(item.productId);
//     if (product) {
//       product.stock += item.quantity;
//       await product.save();
//     } else {
//       return res
//         .status(404)
//         .json({ success: false, message: "Associated product not found." });
//     }

//     res
//       .status(200)
//       .json({ success: true, message: "Item canceled successfully." });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: "Error canceling item." });
//   }
// };

// const removeItem = async (req, res) => {
//   const { orderId, itemId } = req.params;

//   try {
//     const order = await Orders.findOne({ _id: orderId, "items._id": itemId });

//     if (!order) {
//       return res.status(404).send("Order not found");
//     }

//     const item = order.items.find(item => item._id.toString() === itemId);

//     if (!item) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Item not found in the order." });
//     }

//     if (item.status === "delivered") {
//       return res.status(400).json({
//         success: false,
//         message: "Item is already delivered and cannot be canceled."
//       });
//     }

//    // Update the item status to "canceled"
//     await Orders.findOneAndUpdate(
//       { _id: orderId, "items._id": itemId },
//       { $set: { "items.$.status": "canceled" } }
//     );

//     const product = await Products.findById(item.productId);
//     if (product) {
//       product.stock += item.quantity;
//       await product.save();
//     }

//     if (order.paymentMethod === "Razorpay") {
//       const refundAmount = product.discountedPrice
//         ? product.discountedPrice * item.quantity
//         : product.price * item.quantity;

//       let wallet = await Wallet.findOne({ userId: order.userId });

//       if (!wallet) {
//         wallet = new Wallet({
//           userId: order.userId,
//           balance: refundAmount,
//           transactions: [
//             {
//               type: "refund",
//               amount: refundAmount,
//               description: `Refund for canceled product (${product.name}) in order ${orderId}`
//             }
//           ]
//         });
//       } else {
//         wallet.balance += refundAmount;
//         wallet.transactions.push({
//           type: "refund",
//           amount: refundAmount,
//           description: `Refund for canceled product (${product.name}) in order ${orderId}`
//         });
//       }
//       await wallet.save();
//     }

//     if (!order.items) {
//       return res.status(500).send("Order items not found");
//     }

//     const allProductCancelled = order.items.every(
//       item => item.status === "canceled"
//     );

//     if (allProductCancelled) {
//       order.status = "canceled";
//     }

//     await order.save();
//     res.redirect("/orderss");
//   } catch (error) {
//     console.error("Error canceling order:", error);
//     res.status(500).send("Error updating order status");
//   }
// };

// const removeItem = async (req, res) => {
//   const user=req.session.userId;
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

//     // Update item status to "canceled"
//     await Orders.findOneAndUpdate(
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

//     if (order.paymentMethod === "razorpay") {
//       // const refundAmount = (product.price) * item.quantity;

// console.log("refundAmount",refundAmount)
//       const refundAmount = (product?.discountedPrice || product?.price) * item.quantity;
      
//       // Retrieve or create wallet
//       let wallet = await Wallet.findOne({ userId: order.userId });
//       console.log("Order userId:", order.userId);
//       console.log("Wallet before save:", wallet);
      
//       if (!wallet) {
//         wallet = new Wallet({
//           userId: order.userId,
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
//         // Update wallet balance and transactions
//         wallet.balance += refundAmount;
//         wallet.transactions.push({
//           type: "refund",
//           amount: refundAmount,
//           description: `Refund for canceled product (${product?.name}) in order ${orderId}`
//         });
//       }
//       await wallet.save();
//     }
    
//     console.log("Refund amount:", refundAmount);

//     // Check if all items are canceled
//     const updatedOrder = await Orders.findById(orderId);
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

    // Update item status to "canceled"
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
        // Update wallet balance and transactions
        wallet.balance += refundAmount;
        wallet.transactions.push({
          type: "refund",
          amount: refundAmount,
          description: `Refund for canceled product (${product?.name}) in order ${orderId}`
        });
      }
      await wallet.save();
    }

    // Check if all items are canceled
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


module.exports = {
  ordertracking,
  removeorder,
  removeItem,
  checkout,
  loadOrders,
  loadViewDetails
};
