const Products = require("../model/ProductsModel");
const Cart = require("../model/cartModel");
const Address = require("../model/addressModel");
const Orders = require("../model/ordersModel");



const checkout = async (req, res) => {
    try {
      const userId = req.session.userId; // Get the user ID from the session
      // console.log(req.session.userId);
      // console.log(userId);
  
      const alladdresses = await Address.find({});
      const addresses = await Address.findOne({});
  
      const carts = await Cart.find({ user: userId })
        .populate("user")
        .populate("productId");
      // Calculate totals (if needed)
      const subtotal = carts.reduce(
        (acc, cart) => acc + cart.productId.price * cart.quantity,
        0
      );
  
      const shippingRate = 50; // Static shipping rate for now
      const total = subtotal + shippingRate;
  
      res.render("checkout", {
        addresses,
        carts,
        subtotal,
        shippingRate,
        total,
        alladdresses
      });
    } catch (error) {
      console.error(error); // Log any errors for debugging
      res.status(500).send("Internal Server Error"); // Send a response in case of error
    }
  };

  
const removeorder = async (req, res) => {
    const { orderId } = req.params;
  
    try {
      // Find the order to get its items
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
  
      // Iterate through order items and update product stock
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
  
      res
        .status(200)
        .json({
          success: true,
          message: "Order canceled successfully and stock updated."
        });
    } catch (error) {
      console.error("Error canceling order:", error);
      res.status(500).json({ success: false, message: "Error canceling order." });
    }
  };
  const removeItem = async (req, res) => {
    const { orderId, itemId } = req.params;
    try {
      // Find the order and retrieve the item
      const order = await Orders.findOne({ _id: orderId, "items._id": itemId });
  
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order or item not found." });
      }
  
      // Find the specific item within the order
      const item = order.items.find(item => item._id.toString() === itemId);
  
      if (!item) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found in the order." });
      }
  
      // Check if the item's status is 'delivered'
      if (item.status === "delivered") {
        return res.status(400).json({
          success: false,
          message: "Item is already delivered and cannot be canceled."
        });
      }
  
      // Update the item status to "canceled"
      await Orders.findOneAndUpdate(
        { _id: orderId, "items._id": itemId },
        { $set: { "items.$.status": "canceled" } }
      );
  
      // Update the stock of the product
      const product = await Products.findById(item.productId); // Assuming `productId` is stored in the item
      if (product) {
        product.stock += item.quantity;
        await product.save();
      } else {
        return res
          .status(404)
          .json({ success: false, message: "Associated product not found." });
      }
  
      res
        .status(200)
        .json({ success: true, message: "Item canceled successfully." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Error canceling item." });
    }
  };

  const loadorderss = async (req, res) => {
    try {
      const orders = await Orders.find({ userId: req.session.userId })
        .populate({
          path: "items.productId",
          select: "name images description price"
        })
        .sort({ createdAt: -1 }); // Sort orders by creation date, descending
  
      res.render("orders", { orders });
    } catch (error) {
      console.error("Error during load orders", error);
      res.status(500).send("Failed to load orders.");
    }
  };

  const ordertracking = async (req, res) => {
    const { id } = req.params;
    try {
      // Fetch the order by ID and populate items' product details
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
  

  module.exports = {
    ordertracking,
    removeorder,
    removeItem,
    checkout,
    loadorderss,
    loadViewDetails,
  };
  