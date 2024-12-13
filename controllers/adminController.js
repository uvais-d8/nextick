const bcrypt = require("bcrypt");
const fs = require("fs");
const User = require("../model/usermodal");
const admin = require("../model/adminModel");
const Products = require("../model/productsmodal");
const Category = require("../model/categoryModel");
const Orders = require("../model/ordersmodal");
const path = require("path");
const { default: mongoose } = require("mongoose");
const Coupon = require("../model/couponModel");
const Wallet = require("../model/walletModel")
const multer = require("multer");
const Offer = require("../model/offermodel");
const Coupons = require("../model/couponModel");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage }).any("images", 10);

// -------------------------------------------------addmin Pages---------------------------------------------------------

const loadlogin = async (req, res) => {
  res.render("admin/login");
};
const login = async (req, res) => {
  try {
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    console.log("Email from req.body:", email);

    const adminData = await admin.findOne({ email });
    console.log(`Admin data found: ${adminData}`);

    if (!adminData) {
      console.log("Admin not found in DB");
      return res.render("admin/login", { message: "invalid credentials" });
    } else {
      console.log("Admin found:", adminData);

      const isMatch = await bcrypt.compare(password, adminData.password);
      if (!isMatch) {
        return res.render("admin/login", { message: "invalid credentials" });
      }
      req.session.admin = true;
      res.redirect("/admin/dashboard");
    }
  } catch (error) {
    console.error("Error during login:", error);
    res.send(error);
  }
};
const loaddashboard = async (req, res) => {
  try {
    const { startDate, endDate, filter, page = 1, limit = 5 } = req.query;

    const filterConditions = { "items.status": "delivered" };
    const topSellingProducts = await Products.find()
      .sort({ salesCount: -1 })
      .limit(10);
    const topSellingCategories = await Products.aggregate([
      {
        $group: {
          _id: "$category",
          totalSales: { $sum: "$salesCount" }
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryDetails"
        }
      },
      { $unwind: "$categoryDetails" }
        ]);
    if (startDate && endDate) {
      filterConditions.time = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await Orders.find(filterConditions).populate(
      "items.productId"
    );

    const groupByKey =
      filter === "daily"
        ? order => order.time.toISOString().split("T")[0]
        : filter === "monthly"
          ? order => `${order.time.getMonth() + 1}-${order.time.getFullYear()}`
          : filter === "yearly"
            ? order =>
                `Week-${Math.ceil(
                  order.time.getDate() / 7
                )} ${order.time.getFullYear()}`
            : order => `${order.time.getFullYear()}`; 
    const salesData = orders.reduce((acc, order) => {
      
    const key = groupByKey(order);

      if (!acc[key]) {
        acc[key] = {
          key,
          totalSales: 0,
          totalDiscount: 0,
          orderCount: 0,
          netSale: 0
        };
      }

      const totalDiscount = order.items.reduce(
        (sum, item) =>
          sum +
          (item.price - (item.priceWithDiscount || item.price)) * item.quantity,
        0
      );

      const netSale = order.orderTotal - totalDiscount;
      acc[key].orderCount += 1;
      acc[key].totalSales += order.orderTotal;
      acc[key].totalDiscount += totalDiscount;
      acc[key].netSale += netSale;
      return acc;
    }, {});

    const salesReport = Object.values(salesData);
    const overallNetSale = salesReport.reduce(
      (total, period) => total + period.netSale,
      0
    );
    const skip = (page - 1) * limit;
    const paginatedReports = salesReport.slice(skip, skip + limit);
    const totalPages = Math.ceil(salesReport.length / limit);

    res.render("admin/dashboard", {
      topSellingProducts,
      topSellingCategories,
      salesReport: paginatedReports,
      totalPages,
      currentPage: page,
      filter,
      startDate,
      endDate,
      salesData,
      overallNetSale
    });

    const admin = req.session.admin;
    if (!admin) return res.redirect("/admin/login");
  } catch (error) {
    console.error(error);
    res.render("admin/login", { message: "Failed to load dashboard" });
  }
};
const logout = (req, res) => {
  delete req.session.admin;
  res.render("admin/login");
};
// -------------------------------------------------User Management-------------------------------------------------------

const blockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`User id = ${userId}`);
    req.session.userId = null;
    await User.findByIdAndUpdate(userId, { blocked: true });
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Failed to block user:", error);
    res.redirect("/admin/dashboard");
  }
};
const unblockUser = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`user id ${userId}`);
    await User.findByIdAndUpdate(userId, { blocked: false });
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error(error);
    res.redirect("/admin/dashboard");
  }
};
const loadUserMangment = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;
    const totalUsers = await User.countDocuments();
    const users = await User.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();
    const totalPages = Math.ceil(totalUsers / limit);

    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    res.render("admin/usermanagement", {
      users,
      currentPage: page,
      totalPages: totalPages,
      totalUsers: totalUsers,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.log(`Error fetching users: ${error}`);
    res.status(500).send("Failed to load users.");
  }
};

// -------------------------------------------------Category Management---------------------------------------------------

const addcategory = async (req, res) => {
  try {
    const { category, brand, bandcolor } = req.body;

    const existingCategory = await Category.findOne({ category });
    if (existingCategory) {
      console.log("Category already exists");
      return res.render("admin/addcategory", {
        message: "Category already exists"
      });
    }
    const newCategory = new Category({
      category,
      bandcolor,
      brand
    });

    await newCategory.save();

    return res.redirect("/admin/category");
  } catch (error) {
    console.error(`Something went wrong: ${error}`);
    return res.redirect("/admin/addcategory");
  }
};
const loadaddcategory = async (req, res) => {
  res.render("admin/addcategory");
};
const loadeditcategory = async (req, res) => {
  try {
    console.log(req.params);
    const { id } = req.params;
    const category = await Category.findById(id);
    res.render("admin/editcategory", { category });
  } catch (error) {
    console.error(`Something went wrong: ${error}`);
    res.redirect("/admin/category");
  }
};
const unlistcategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    console.log(`category id : ${categoryId}`);
    await Category.findByIdAndUpdate(categoryId, { islisted: false });
    res.redirect("/admin/category");
  } catch (error) {
    console.error("failed to unlist category", error);
    res.redirect("/admin/dashboard");
  }
};
const listcategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    await Category.findByIdAndUpdate(categoryId, { islisted: true });
    res.redirect("/admin/category");
  } catch (error) {
    console.log(error);
    console.error("failed to list category", error);
    res.redirect("/admin/dashboard");
  }
};
const editcategory = async (req, res) => {
  const categoryId = req.params.id;
  const { category, brand, bandcolor } = req.body;
  const updatedCategory = { category, brand, bandcolor };

  try {
    const existingCategory = await Category.findOne({
      category: category.trim(),
      _id: { $ne: categoryId }
    });

    if (existingCategory) {
      console.log("Category already exists");
      const category = await Category.find({});
      return res.render("admin/category", {
        category,
        message: "Category with this name already exists."
      });
    }

    await Category.findByIdAndUpdate(categoryId, updatedCategory, {
      new: true
    });
    res.redirect("/admin/category");
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).send("Error updating category");
  }
};
const loadcategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 3;
    const skip = (page - 1) * limit;

    const totalCategories = await Category.countDocuments();
    const categories = await Category.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();
    console.log("categories", categories);
    const totalPages = Math.ceil(totalCategories / limit);
    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    res.render("admin/category", {
      categories,
      currentPage: page,
      totalPages,
      totalCategories,
      previousPage,
      nextPage
    });
  } catch (error) {
    console.log(`No data found: ${error}`);
    res.status(500).send("Failed to load categories.");
  }
};

// -------------------------------------------------Products Management---------------------------------------------------

const unlistproducts = async (req, res) => {
  try {
    const productId = req.params.id;
    await Products.findByIdAndUpdate(productId, { islisted: false });
    console.log(`Product ${productId} successfully unlisted`);
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Failed to unlist the product:", error);
    res.status(500).redirect("/admin/dashboard");
  }
};
const listproducts = async (req, res) => {
  try {
    const productId = req.params.id;
    await Products.findByIdAndUpdate(productId, { islisted: true });
    console.log(`Product ${productId} successfully listed`);
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Failed to list the product:", error);
    res.status(500).redirect("/admin/dashboard");
  }
};
const editproducts = async (req, res) => {
  try {
    const { id, name, category, stock, price, deletedImages } = req.body;
    console.log("Received Data:");
    console.log("ID:", id);
    console.log("Name:", name);
    console.log("Category:", category);
    console.log("Stock:", stock);
    console.log("Price:", price);
    console.log("Deleted Images:", deletedImages);

    const existingProduct = await Products.findOne({
      name: name.trim(),
      _id: { $ne: id }
    });

    if (existingProduct) {
      console.error("Product with this name already exists:", name);
      return res.render("admin/products", {
        message: "A product with this name already exists."
      });
    }

    const product = await Products.findById(id);
    if (!product) {
      console.error("Product not found for ID:", id);
      return res.render("admin/products", { message: "Product not found" });
    }

    const categoryObj = await Category.findById(category);
    if (!categoryObj) {
      return res
        .status(400)
        .render("admin/products", { message: "Category not found" });
    }

    const stockNumber = parseInt(stock, 10);
    if (isNaN(stockNumber)) {
      return res.render("admin/products", {
        message: "Stock must be a valid number"
      });
    }

    if (stockNumber < 0) {
      return res.render("admin/products", {
        message: "Stock cannot be negative"
      });
    }

    if (deletedImages) {
      const deletedImagesArray = deletedImages.split(",");
      for (const imagePath of deletedImagesArray) {
        const index = product.images.indexOf(imagePath);
        if (index > -1) {
          product.images.splice(index, 1);
          const fullImagePath = path.join(__dirname, "..", "public", imagePath);
          if (fs.existsSync(fullImagePath)) {
            fs.unlinkSync(fullImagePath);
            console.log("Deleted image from server:", fullImagePath);
          }
        }
      }
    }

    if (req.files && req.files.images) {
      const newImages = req.files.images.map(
        file => "uploads/" + file.filename
      );
      product.images.push(...newImages);
      console.log("Added new images:", newImages);
    }

    if (req.body.croppedImageData) {
      const croppedImages = Array.isArray(req.body.croppedImageData)
        ? req.body.croppedImageData
        : [req.body.croppedImageData];

      for (const croppedImageData of croppedImages) {
        const buffer = Buffer.from(croppedImageData.split(",")[1], "base64");
        const croppedFileName = `cropped-${Date.now()}.png`;
        const filePath = path.join(__dirname, "..", "uploads", croppedFileName);
        fs.writeFileSync(filePath, buffer);
        product.images.push("uploads/" + croppedFileName);
        console.log("Added cropped image:", croppedFileName);
      }
    }

    if (product.images.length === 0) {
      console.error("No images provided for the product.");
      return res.render("admin/products", {
        message: "At least one image is required"
      });
    }

    Object.assign(product, {
      name: name.trim(),
      category: categoryObj._id,
      stock: stockNumber,
      price: parseFloat(price).toFixed(2)
    });

    await product.save();
    console.log("Product updated successfully:", product);

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error updating product:", error);
    const products = await Products.find({});
    res.status(500).render("admin/products", {
      products,
      message: "An error occurred while updating the product. Please try again."
    });
  }
};
const loadaddproduct = async (req, res) => {
  try {
    const categories = await Category.find({});
    res.render("admin/addproduct", { categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).send("Error fetching categories");
  }
};
const addproduct = async (req, res) => {
  try {
    const { name, category, stock, price, description } = req.body;
    const { files } = req;
    console.log("Request body:", req.body);
    console.log("Uploaded files:", files);

    if (!name || !category || !stock || !price || !description) {
      return res.status(400).render("admin/addproduct", {
        message: "All fields are required."
      });
    }

    if (!files || files.length < 3) {
      return res.status(400).render("admin/addproduct", {
        message: "Please upload at least 3 images."
      });
    }

    const validImageTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "image/gif"
    ];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!validImageTypes.includes(file.mimetype)) {
        return res.status(400).render("admin/addproduct", {
          message: `Invalid image format for file: ${file.originalname}. Please upload only image files.`
        });
      }
    }

    const existingProduct = await Products.findOne({ name });
    if (existingProduct) {
      const products = await Products.find({});
      return res.render("admin/addproduct", {
        products,
        modalError: "Product already exists",
        message: "Product already exists"
      });
    }

    const categoryObj = await Category.findOne({ category: category });
    if (!categoryObj) {
      return res.status(400).render("admin/addproduct", {
        message: "Category not found"
      });
    }

    const newProduct = new Products({
      name,
      category: categoryObj._id,  
      stock,
      price,
      description: description || "Default description",
      images: files.map(file => file.path) 
    });
 
    await newProduct.save();
    console.log("New product saved:", newProduct);

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error adding product:", error.message);
    res.redirect("/admin/dashboard");
  }
};
const loadproducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;

    const totalProducts = await Products.countDocuments();
    const categories = await Category.find({});
    const products = await Products.find({})
      .populate("category", "category")
      .skip(skip)
      .limit(limit)
      .exec();

    const totalPages = Math.ceil(totalProducts / limit);
    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    res.render("admin/products", {
      products,
      categories,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.log(`Error fetching products: ${error}`);
    res.status(500).send("Failed to load products.");
  }
};
const loadeditproducts = async (req, res) => {
  const { id } = req.params;
  console.log("hello");
  console.log(req.params);
  const product = await Products.findById(id);
  res.render(`admin/products`, { product });
  console.log(product);
};

// -------------------------------------------------Inventory Management--------------------------------------------------

const loadinventory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    const totalUsers = await User.countDocuments();
    const products = await Products.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();
    const totalPages = Math.ceil(totalUsers / limit);

    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    res.render("admin/inventory", {
      products,
      currentPage: page,
      totalPages: totalPages,
      totalUsers: totalUsers,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.log("failed to load inventory");
  }
};
const editinventory = async (req, res) => {
  const productId = req.params.id;
  const { name, stock } = req.body;

  try {
    // Find the product by ID
    const product = await Products.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    if (stock.length < 0) {
      console.log("not minus allowed");
    }
    const existingProduct = await Products.findOne({
      name: name,
      _id: { $ne: productId }
    });
    if (existingProduct) {
      return res.render("admin/inventory", {
        products: await Products.find({}),
        message: "Product with this name already exists"
      });
    }

    if (product.name === name && product.stock === stock) {
      return res.render("admin/inventory", {
        products: await Products.find({}),
        message: "No changes made to the product"
      });
    }
    // Update the product details
    product.name = name;
    product.stock = stock;

    await product.save();

    res.redirect("/admin/inventory");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).send("Error updating product");
  }
};

// -------------------------------------------------Orders Management------------------------------------------------------

const cancelOrderItem = async (req, res) => {
  const { orderId, itemId } = req.body;
  console.log("Request Body for Cancel:", req.body);

  try {
    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      console.log("Invalid order or item ID:", { orderId, itemId });
      return res
        .status(400)
        .json({ success: false, message: "Invalid order or item ID." });
    }

    console.log(
      "Attempting to cancel item with ID:",
      itemId,
      "in order ID:",
      orderId
    );

    // Find the order by ID
    const order = await Orders.findById(orderId);
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    // Find the specific item within the order items array
    const item = order.items.id(itemId);
    if (!item) {
      console.log("Item not found for ID:", itemId);
      return res
        .status(404)
        .json({ success: false, message: "Item not found in order." });
    }

    // Update the item's status to "canceled"
    item.status = "canceled";

    // Save the updated order
    await order.save();

    console.log("Item canceled successfully for item ID:", itemId);

    // Redirect or send response
    res.redirect("/admin/orders"); // Adjust this as needed
  } catch (error) {
    console.error("Error canceling item:", error);
    res.status(500).json({ success: false, message: "Failed to cancel item." });
  }
};

const updateOrderStatus = async (req, res) => {
  const { orderId, itemId, status } = req.body;

  console.log("Request Body:", req.body);

  try {
    // Validate IDs
    if (
      !mongoose.Types.ObjectId.isValid(orderId) ||
      !mongoose.Types.ObjectId.isValid(itemId)
    ) {
      console.log("Invalid order or item ID:", { orderId, itemId });
      return res
        .status(400)
        .json({ success: false, message: "Invalid order or item ID." });
    }

    // Validate status
    const validStatuses = ["canceled","scheduled", "pending", "delivered", "shipped","payment-pending",
        "returned"];
    if (!validStatuses.includes(status)) {
      console.log("Invalid status:", status);
      return res
        .status(400)
        .json({ success: false, message: "Invalid status." });
    }

    // Find the order
    const order = await Orders.findById(orderId);
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    // Find the item in the order
    const item = order.items.id(itemId);
    if (!item) {
      console.log("Item not found for ID:", itemId);
      return res
        .status(404)
        .json({ success: false, message: "Item not found in order." });
    }

    // Check if the item is already delivered
    if (item.status === "delivered") {
      return res.status(400).json({
        success: false,
        message: "Item is already delivered and cannot be canceled.",
      });
    }

    // Update item status
    item.status = status;
    if (status === "canceled") {
      // Increment product stock
      const product = await Products.findById(item.productId);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      } else {
        console.warn("Product not found for stock update");
      }

      // Handle refund for prepaid orders
      if (order.paymentMethod === "razorpay") {
        let refundAmount = (item.priceWithDiscount || item.price) * item.quantity;
        if (refundAmount > 0) {
          console.log("Refund amount:", refundAmount);

          let wallet = await Wallet.findOne({ user: order.userId });

          if (!wallet) {
            // Create a new wallet if it doesn't exist
            wallet = new Wallet({
              user: order.userId,
              balance: refundAmount,
              transactions: [
                {
                  type: "refund",
                  amount: refundAmount,
                  description: `Refund for canceled product (${item.productId.name}) in order ${orderId}`,
                },
              ],
            });
          } else {
            // Update existing wallet balance and transactions
            wallet.balance += refundAmount;
            wallet.transactions.push({
              type: "refund",
              amount: refundAmount,
              description: `Refund for canceled product (${item.productId.name}) in order ${orderId}`,
            });
          }

          await wallet.save();
        }
      }
    }

    // Save the order
    await order.save();

    // Check if all items are canceled, then update the order status
    if (order.items.every((item) => item.status === "canceled")) {
      order.status = "canceled";
      await order.save();
    }

    console.log("Item status updated successfully for item ID:", itemId);
    res.redirect("/admin/orders");
  } catch (error) {
    console.error("Error updating item status:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update item status." });
  }
};

 
const loadOrder = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;
    const totalOrders = await Orders.countDocuments();
    const orders = await Orders.find({})
      .populate("items.productId", "name")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }) // Sort by creation date (or change if needed)
      .exec();

    // Calculate total pages
    const totalPages = Math.ceil(totalOrders / limit);

    // Get previous and next page numbers
    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    // Render the orders page with pagination data
    res.render("admin/orders", {
      orders,
      currentPage: page,
      totalPages: totalPages,
      totalOrders: totalOrders,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.log(`Error fetching orders: ${error}`);
    res.status(500).send("Failed to load orders.");
  }
};

// -------------------------------------------------Coupon Management------------------------------------------------------

const loadaddcoupon = async (req, res) => {
  try {
    const products = await Products.find({});
    const Categories = await Category.find({});
    console.log(Categories);

    res.render("admin/addcoupon", { products, Categories });
  } catch (error) {
    console.log("errorr");
    res.render("admin/addcoupon", { message: "errorr" });
  }
};
const loadaddcoupons = async (req, res) => {
  try {
    const Categories = await Category.find({});
    console.log(Categories);

    res.render("admin/addcoupons", { Categories });
  } catch (error) {
    console.log("errorr");
    res.render("admin/addcoupons", { message: "errorr" });
  }
};
const addcoupon = async (req, res) => {
  try {
    const {
      CouponCode,
      DiscountType,
      DiscountValue,
      Products,
      MinimumCartValue,
      UsageLimit,
      ExpiryDate,
      Description
    } = req.body;

    console.log("Request body:", req.body);

    if (
      !CouponCode ||
      !DiscountType ||
      !DiscountValue ||
      !Products.length ||
      !ExpiryDate
    ) {
      console.log("Missing required fields");
      return res.render("admin/addcoupon", {
        message: "All fields are required"
      });
    }

    // Check for existing coupon code
    const existingcoupon = await Coupon.findOne({ CouponCode });
    if (existingcoupon) {
      console.log("coupon already exists");
      return res.render("admin/addcoupon", {
        message: "Coupon already exists"
      });
    }

    if (isNaN(DiscountValue) || DiscountValue <= 0) {
      console.log("Invalid DiscountValue");
      return res.render("admin/addcoupon", {
        message: "Discount value must be a positive number"
      });
    }

    if (MinimumCartValue && (isNaN(MinimumCartValue) || MinimumCartValue < 0)) {
      console.log("Invalid MinimumCartValue");
      return res.render("admin/addcoupon", {
        message: "Minimum cart value must be a positive number"
      });
    }

    if (
      UsageLimit &&
      (isNaN(UsageLimit) ||
        UsageLimit <= 0 ||
        !Number.isInteger(Number(UsageLimit)))
    ) {
      console.log("Invalid UsageLimit");
      return res.render("admin/addcoupon", {
        message: "Usage limit must be a positive integer"
      });
    }

    const formattedExpiryDate = new Date(ExpiryDate);
    if (isNaN(formattedExpiryDate)) {
      console.log("Invalid ExpiryDate");
      return res.render("admin/addcoupon", {
        message: "Expiry date is invalid"
      });
    }

    if (formattedExpiryDate < new Date()) {
      console.log("Expiry date is in the past");
      return res.render("admin/addcoupon", {
        message: "Expiry date cannot be in the past"
      });
    }

    if (Description && typeof Description !== "string") {
      console.log("Invalid Description");
      return res.render("admin/addcoupon", {
        message: "Description must be a valid string"
      });
    }

    // Create a new coupon object
    const newCoupon = new Coupon({
      CouponCode,
      DiscountType,
      DiscountValue,
      Products,
      MinimumCartValue,
      UsageLimit,
      ExpiryDate: formattedExpiryDate,
      Description
    });

    await newCoupon.save();
    console.log("New coupon saved:", newCoupon);

    return res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Error adding coupon:", error.message);
    res.redirect("/admin/coupon");
  }
};
const addcoupons = async (req, res) => {
  try {
    const {
      CouponCode,
      DiscountType,
      DiscountValue,
      Categories,
      MinimumCartValue,
      UsageLimit,
      ExpiryDate,
      Description
    } = req.body;

    console.log("Request body:", req.body);

    if (
      !CouponCode ||
      !DiscountType ||
      !DiscountValue ||
      !Categories.length ||
      !ExpiryDate
    ) {
      console.log("Missing required fields");
      return res.render("admin/addcoupons", {
        message: "All fields are required"
      });
    }

    // Check for existing coupon code
    const existingcoupon = await Coupon.findOne({ CouponCode });
    if (existingcoupon) {
      console.log("coupon already exists");
      return res.render("admin/addcoupons", {
        message: "Coupon already exists"
      });
    }

    if (isNaN(DiscountValue) || DiscountValue <= 0) {
      console.log("Invalid DiscountValue");
      return res.render("admin/addcoupons", {
        message: "Discount value must be a positive number"
      });
    }

    if (MinimumCartValue && (isNaN(MinimumCartValue) || MinimumCartValue < 0)) {
      console.log("Invalid MinimumCartValue");
      return res.render("admin/addcoupons", {
        message: "Minimum cart value must be a positive number"
      });
    }

    if (
      UsageLimit &&
      (isNaN(UsageLimit) ||
        UsageLimit <= 0 ||
        !Number.isInteger(Number(UsageLimit)))
    ) {
      console.log("Invalid UsageLimit");
      return res.render("admin/addcoupons", {
        message: "Usage limit must be a positive integer"
      });
    }

    const formattedExpiryDate = new Date(ExpiryDate);
    if (isNaN(formattedExpiryDate)) {
      console.log("Invalid ExpiryDate");
      return res.render("admin/addcoupons", {
        message: "Expiry date is invalid"
      });
    }

    if (formattedExpiryDate < new Date()) {
      console.log("Expiry date is in the past");
      return res.render("admin/addcoupons", {
        message: "Expiry date cannot be in the past"
      });
    }

    if (Description && typeof Description !== "string") {
      console.log("Invalid Description");
      return res.render("admin/addcoupons", {
        message: "Description must be a valid string"
      });
    }

    // Create a new coupon object
    const newCoupon = new Coupon({
      CouponCode,
      DiscountType,
      DiscountValue,
      Categories,
      MinimumCartValue,
      UsageLimit,
      ExpiryDate: formattedExpiryDate,
      Description
    });

    await newCoupon.save();
    console.log("New coupon saved:", newCoupon);

    return res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Error adding coupon:", error.message);
    res.redirect("/admin/coupon");
  }
};
const loadcoupon = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;

    const skip = (page - 1) * limit;

    const totalcoupons = await Coupon.countDocuments();

    const coupons = await Coupon.find({})
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    const totalPages = Math.ceil(totalcoupons / limit);

    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    res.render("admin/coupon", {
      coupons,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalcoupons,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.log(`Error fetching coupons: ${error}`);
    res.status(500).send("Failed to load coupons.");
  }
};
const deleteCoupon = async (req, res) => {
  const { couponId } = req.params; // Destructure couponId from req.params
  console.log("Coupon ID received:", couponId);

  try {
    const deletedCoupon = await Coupon.findByIdAndDelete(couponId);

    if (!deletedCoupon) {
      console.log("Coupon not found");
      return res.redirect("/admin/coupon");
    }

    console.log("Deleted coupon:", deletedCoupon);

    return res.redirect("/admin/coupon");
  } catch (error) {
    console.log("Error occurred while deleting coupon:", error);
    return res.status(500).render("admin/coupon", {
      message: "An error occurred while deleting the coupon"
    });
  }
};
const unlistCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await Coupon.findByIdAndUpdate(couponId, { Status: false });
    console.log(`Product ${couponId} successfully unlisted`);
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Failed to unlist the product:", error);
    res.status(500).redirect("/admin/coupon");
  }
};
const listCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await Coupon.findByIdAndUpdate(couponId, { Status: true });
    console.log(`Product ${couponId} successfully listed`);
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Failed to list the product:", error);
    res.status(500).redirect("/admin/coupon");
  }
};

// -------------------------------------------------Offers Management------------------------------------------------------

const addoffer = async (req, res) => {
  const products = await Products.find({});

  try {
    const {
      DiscountType,
      DiscountValue,
      Description,
      Products: productIds,
      ExpiryDate,
      Status
    } = req.body;

    if (
      !DiscountType ||
      !DiscountValue ||
      !Description ||
      !Array.isArray(productIds) ||
      productIds.length === 0 ||
      !ExpiryDate ||
      !Status
    ) {
      console.log("All fields are required");
      return res.render("admin/addoffer", {
        message: "All fields are required",
        products
      });
    }

    const formattedExpiryDate = new Date(ExpiryDate);
    if (isNaN(formattedExpiryDate.getTime())) {
      return res.render("admin/addoffer", {
        message: "Invalid Expiry Date",
        products
      });
    }

    const newoffer = new Offer({
      DiscountType,
      DiscountValue,
      Description,
      Products: productIds,
      ExpiryDate: formattedExpiryDate,
      Status
    });

    await newoffer.save();

    // Update products with the offer
    await Products.updateMany(
      { _id: { $in: productIds } },
      {
        $set: {
          priceWithDiscount:
            DiscountType === "fixed" ? DiscountValue : undefined, // Add logic for percentage if needed
          offer: newoffer._id
        }
      }
    );

    console.log("New offer created: ", newoffer);
    res.redirect("/admin/offer");
  } catch (error) {
    console.error("Error while saving the offer:", error);
    res.status(500).render("admin/addoffer", {
      message: "Make sure you entered everything correctly.",
      products
    });
  }
};
const addoffers = async (req, res) => {
  const category = await Category.find({});
  try {
    const {
      DiscountType,
      DiscountValue,
      Description,
      Categories,
      ExpiryDate,
      Status
    } = req.body;

    if (
      !DiscountType ||
      !DiscountValue ||
      !Description ||
      !Categories ||
      !Categories.length ||
      !ExpiryDate ||
      !Status
    ) {
      console.log("All fields are required");
      return res.render("admin/addoffer", {
        message: "All fields are required",
        category
      });
    }

    const formattedExpiryDate = new Date(ExpiryDate);
    const newoffer = new Offer({
      DiscountType,
      DiscountValue,
      Description,
      Categories,
      ExpiryDate: formattedExpiryDate,
      Status
    });

    // Save the offer
    await newoffer.save();
    console.log("New offer created: ", newoffer);
    // await Products.findByIdAndUpdate(
    //   { _id: products._id },
    //   { priceWithDiscount: DiscountValue }
    // );

    // const newprice = new Products.findByIdAndUpdate({
    //   priceWithDiscount
    // });

    // Save the offer
    // await newprice.save();
    // console.log("New offer created: ", newprice);
    // Now associate the offer with the products
    await Category.updateMany(
      { _id: { $in: category } },
      { $set: { offer: newoffer._id } }
    );

    res.redirect("/admin/offer");
  } catch (error) {
    console.log("Error while saving the offer:", error);
    res.status(500).render("admin/addoffer", {
      message: "Make sure you entered everything correctly.",
      products,
      category
    });
  }
};
const loadeditOffer = async (req, res) => {
  const { id: offerId } = req.params;
  const products = await Products.find({});
  const category = await Category.find({});
  const offer = await Offer.findById(offerId);
  if (!offer) {
    console.log("Offer not found");
    return res.redirect("/admin/offer"); // Redirect if the offer is not found
  }

  try {
    res.render("admin/editoffer", { offer, products, category });
    console.log(offer);
  } catch (error) {
    console.log("error while loading edit offer page", error);
  }
};
const editOffer = async (req, res) => {
  const { id: offerId } = req.params;
  const products = await Products.find({});
  const categories = await Category.find({});

  try {
    const {
      DiscountType,
      DiscountValue,
      Description,
      Products: reqProducts,
      Categories: reqCategories,
      ExpiryDate,
      Status
    } = req.body;

    // Normalize and validate input
    const productIds = Array.isArray(reqProducts) ? reqProducts : [reqProducts];
    const categoryIds = Array.isArray(reqCategories)
      ? reqCategories
      : [reqCategories];

    if (
      !DiscountType ||
      !DiscountValue ||
      !Description ||
      !productIds.length ||
      !categoryIds.length ||
      !ExpiryDate ||
      Status == null
    ) {
      console.log("All fields are required");
      return res.render("admin/editoffer", {
        message: "All fields are required",
        products,
        categories
      });
    }

    const formattedExpiryDate = new Date(ExpiryDate);

    // Update the offer using reference IDs
    const updatedOffer = await Offer.findByIdAndUpdate(
      offerId,
      {
        DiscountType,
        DiscountValue,
        Description,
        Products: productIds, // Store product IDs as references
        Categories: categoryIds, // Store category IDs as references
        ExpiryDate: formattedExpiryDate,
        Status
      },
      { new: true } // Return the updated document
    );

    if (!updatedOffer) {
      console.log("Offer not found");
      return res.status(404).render("admin/editoffer", {
        message: "Offer not found",
        products,
        categories
      });
    }

    console.log("Updated offer:", updatedOffer);
    res.redirect("/admin/offer");
  } catch (error) {
    console.log("Error while updating the offer:", error);
    return res.status(500).render("admin/editoffer", {
      message: "An error occurred while updating the offer",
      products,
      categories
    });
  }
};
const loadaddoffers = async (req, res) => {
  const category = await Category.find({});

  try {
    res.render("admin/addoffers", { category });
  } catch (error) {
    console.log("error while loading", error);
  }
};
const loadaddoffer = async (req, res) => {
  const products = await Products.find({});

  try {
    res.render("admin/addoffer", { products });
  } catch (error) {
    console.log("error while loading", error);
  }
};
const loadoffers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;

    const limit = parseInt(req.query.limit) || 4;

    const skip = (page - 1) * limit;

    const totalcoupons = await Offer.countDocuments();

    const offer = await Offer.find({})
      .populate("Products")
      .populate("Categories")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .exec();

    const totalPages = Math.ceil(totalcoupons / limit);

    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

    res.render("admin/offer", {
      offer,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalcoupons,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.log(`Error fetching offers: ${error}`);
    res.redirect("/admin/dashboard");
  }
};
const deleteOffer = async (req, res) => {
  const { id: offerId } = req.params;
  console.log("oferId : ", offerId);
  try {
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      console.log("Invalid Offer ID");
      return res.redirect("/admin/offer");
    }
    const deleteoffer = await Offer.findByIdAndDelete(offerId);

    if (!deleteoffer) {
      console.log("Offer not found");
      return res.redirect("/admin/offer");
    }
    console.log("deleted offer : ", deleteoffer);
  } catch (error) {
    console.log("error", error);
  }
};
const unlistOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    await Offer.findByIdAndUpdate(offerId, { Status: false });
    console.log(`Product ${offerId} successfully unlisted`);
    res.redirect("/admin/offer");
  } catch (error) {
    console.error("Failed to unlist the product:", error);
    res.status(500).redirect("/admin/offer");
  }
};
const listOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    await Offer.findByIdAndUpdate(offerId, { Status: true });
    console.log(`Product ${offerId} successfully listed`);
    res.redirect("/admin/offer");
  } catch (error) {
    console.error("Failed to list the product:", error);
    res.status(500).redirect("/admin/offer");
  }
};
//-------------sales report-------------------------------------------------

const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, filter, page = 1, limit = 5 } = req.query;

    const filterConditions = { "items.status": "delivered" };

    if (startDate && endDate) {
      filterConditions.time = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const orders = await Orders.find(filterConditions).populate(
      "items.productId"
    );

     const getWeekNumber = date => {
      const startDate = new Date(date.getFullYear(), 0, 1);
      const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
      return Math.ceil((days + 1) / 7);
    };

     const groupByKey =
      filter === "daily"
        ? order => order.time.toISOString().split("T")[0]
        : filter === "monthly"
          ? order => `${order.time.getMonth() + 1}-${order.time.getFullYear()}`
          : filter === "yearly"
            ? order => `${order.time.getFullYear()}`
            : filter === "weekly"  
              ? order =>
                  `Week-${getWeekNumber(
                    order.time
                  )} ${order.time.getFullYear()}`
              : order => `${order.time.getFullYear()}`;  
    const salesData = orders.reduce((acc, order) => {
      const key = groupByKey(order);

      if (!acc[key]) {
        acc[key] = {
          key,
          totalSales: 0,
          totalDiscount: 0,
          orderCount: 0,
          netSale: 0,
          orders: []
        };
      }

      const totalDiscount = order.items.reduce(
        (sum, item) =>
          sum +
          (item.price - (item.priceWithDiscount || item.price)) * item.quantity,
        0
      );

      const netSale = order.orderTotal - totalDiscount;
      acc[key].orderCount += 1;
      acc[key].totalSales += order.orderTotal;
      acc[key].totalDiscount += totalDiscount;
      acc[key].netSale += netSale;
      acc[key].orders.push({
        orderId: order._id,
        date: order.time,
        customer: `${order.shippingAddress.firstname} ${order.shippingAddress
          .lastname}`,
        paymentMethod: order.paymentMethod,
        totalAmount: order.orderTotal,
        discount: totalDiscount,
        netSale
      });

      return acc;
    }, {});

    const salesReport = Object.values(salesData);
    console.log("salesReport", salesReport);
    console.log("salesData", salesData);

    const overallNetSale = salesReport.reduce(
      (total, period) => total + period.netSale,
      0
    );

    console.log("Overall Net Sale:", overallNetSale);

    const skip = (page - 1) * limit;
    const paginatedReports = salesReport.slice(skip, skip + limit);
    const totalPages = Math.ceil(salesReport.length / limit);

    res.render("admin/salesreport", {
      salesReport: paginatedReports,
      totalPages,
      currentPage: page,
      filter,
      startDate,
      endDate,
      salesData: JSON.stringify(paginatedReports),
      overallNetSale
    });
  } catch (error) {
    console.error("Error fetching sales report:", error);
    res.status(500).send("Failed to load sales report.");
  }
};
const exportPDF = async (req, res) => {
  try {
    const salesData = JSON.parse(req.body.salesData); // Parse the stringified salesData

    const doc = new PDFDocument({ margin: 20 });
    const filename = `Sales_Report_${Date.now()}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    // Title
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Sales Report", { align: "center" });
    doc.moveDown(1);

    // Table header style
    const tableHeaders = [
      "Order Date",
      "Order ID",
      "User Name",
      "paying Type",
      "Amount",
      "Discount",
      "Net Sale"
    ];

     const drawLine = y => {
      doc.moveTo(30, y + 10).lineTo(560, y + 10).stroke();  
    };

    let currentY = doc.y + 100; 

    salesData.forEach((report, index) => {
       doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(`Group: ${report.key}`, 40, currentY);
      currentY = doc.y + 20; 
      drawLine(currentY);
       currentY += 25; 
      doc.fontSize(12).font("Helvetica-Bold");
      tableHeaders.forEach((header, i) => {
        const x = 40 + i * 75;
        doc.text(header, x, currentY, { width: 70, align: "left" });
      });
      currentY += 25;  
       report.orders.forEach(order => {
        doc.fontSize(10).font("Helvetica");
        const rowData = [
          new Date(order.date).toLocaleDateString(),
          order.orderId,
          order.customer,
          order.paymentMethod,
          `₹${order.totalAmount.toLocaleString()}`,
          `₹${order.discount.toLocaleString()}`,
          `₹${order.netSale.toLocaleString()}`
        ];

        rowData.forEach((data, i) => {
          const x = 40 + i * 75;
          doc.text(data, x, currentY, { width: 70, align: "left" });
        });

        currentY += 30; 
        
        if (currentY > 750) {
          doc.addPage();
          currentY = 70;  
          drawLine(currentY);
        }
      });

      currentY += 30;  
        });
    drawLine(currentY);

    // Footer
    const footerY = doc.page.height - 30;
    doc
      .fontSize(10)
      .font("Helvetica")
      .text("Sales Report Generated Automatically", 40, footerY, {
        align: "left"
      })
      .text(`Date: ${new Date().toLocaleDateString()}`, 500, footerY, {
        align: "right"
      });

    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    res.status(500).send("Failed to generate PDF.");
  }
};
const exportExcel = async (req, res) => {
  try {
    const salesData = JSON.parse(req.body.salesData); 
        const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    worksheet.columns = [
      { header: "Order Date", key: "date" },
      { header: "Order ID", key: "orderId" },
      { header: "Customer Name", key: "customer" },
      { header: "Payment Method", key: "paymentMethod" },
      { header: "Total Amount", key: "totalAmount" },
      { header: "Discount", key: "discount" },
      { header: "Net Sale", key: "netSale" }
    ];

     salesData.forEach(report => {
      report.orders.forEach(order => worksheet.addRow(order));
    });

    const filename = `Sales_Report_${Date.now()}.xlsx`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting Excel:", error.message);
    res.redirect("/admin/salesreport");
  }
};
const getSalesData = async (req, res) => {
  const filter = req.query.filter; // Get filter from query params
  const itemStatus = req.query.itemStatus || "delivered"; // Get item status from query params, default to 'delivered'

  if (!filter) {
    return res.status(400).json({ error: "Filter is required" });
  }

  try {
    let groupStage = {};
    let sortStage = {};
    let labels = [];
    let totalPrices = [];

    // Match stage to filter by order status and item status
    let matchStage = {
      "items.status": itemStatus // Filter items where their status matches the itemStatus (delivered in this case)
    };

    // Adjust aggregation stages based on the filter
    switch (filter) {
      case "yearly":
        groupStage = {
          _id: { year: { $year: "$createdAt" } },
          totalSales: { $sum: "$orderTotal" }
        };
        sortStage = { "_id.year": 1 };
        break;

      case "monthly":
        groupStage = {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          totalSales: { $sum: "$orderTotal" }
        };
        sortStage = { "_id.year": 1, "_id.month": 1 };
        break;

      case "weekly":
        groupStage = {
          _id: { year: { $year: "$createdAt" }, week: { $week: "$createdAt" } },
          totalSales: { $sum: "$orderTotal" }
        };
        sortStage = { "_id.year": 1, "_id.week": 1 };
        break;

      default:
        return res.status(400).json({ error: "Invalid filter value" });
    }

    // Aggregate data from MongoDB
    const salesData = await Orders.aggregate([
      { $match: matchStage }, // Match orders with status 'delivered' and item status 'delivered'
      { $group: groupStage },
      { $sort: sortStage }
    ]);

    // Prepare labels and totalPrices for the graph
    if (filter === "yearly") {
      labels = salesData.map(item => `${item._id.year}`);
      totalPrices = salesData.map(item => item.totalSales);
    
      // If no sales data exists for certain years, handle that here
      const years = [...new Set(salesData.map(item => item._id.year))];
      console.log("Years Found:", years);
    }
     else if (filter === "monthly") {
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
      ];

      // Ensure we have data for all 12 months, even if no sales data exists for some months
      let monthData = new Array(12).fill(0); // Array to hold data for all 12 months (initially set to 0)

      salesData.forEach(item => {
        const monthIndex = item._id.month - 1; // MongoDB returns months as 1-12, so adjust to 0-11 index
        monthData[monthIndex] = item.totalSales; // Populate the month data with actual sales
      });

      labels = months; // The labels are the month names
      totalPrices = monthData; // The totalPrices array holds the sales data for each month
    } else if (filter === "weekly") {
      // Initialize the labels and sales data
      labels = [];
      totalPrices = [];
    
      salesData.forEach(item => {
        const week = item._id.week || "N/A"; // Handle missing week data
        const year = item._id.year || "N/A"; // Handle missing year data
    
        if (week !== "N/A" && year !== "N/A") {
          labels.push(`Week ${week} - ${year}`);
          totalPrices.push(item.totalSales);
        } else {
          console.warn("Invalid Weekly Data:", item);
        }
      });
    
      console.log("Weekly Labels:", labels);
      console.log("Weekly Total Sales:", totalPrices);
    }
    

    // Log the labels and totalPrices for debugging
    console.log("Labels:", labels);
    console.log("Total Prices:", totalPrices);
    console.log("Aggregated Sales Data:", salesData);

    res.json({ labels, totalPrices });

  } catch (error) {
    console.error("Error fetching sales data:", error);
    res.status(500).json({ error: "Failed to fetch sales data" });
  }
};

 

module.exports = {
  getSalesData,
  exportPDF,
  listOffer,
  unlistOffer,
  getSalesReport,
  editOffer,
  loadeditOffer,
  deleteOffer,
  deleteCoupon,
  addcoupon,
  loadaddcoupon,
  loadcoupon,
  editinventory,
  updateOrderStatus,
  cancelOrderItem,
  upload,
  loadinventory,
  loadOrder,
  listproducts,
  unlistproducts,
  listcategory,
  unlistcategory,
  loadeditcategory,
  addcategory,
  editproducts,
  loadlogin,
  loadproducts,
  login,
  loadcategory,
  loadaddcategory,
  loaddashboard,
  logout,
  blockUser,
  unblockUser,
  loadUserMangment,
  addproduct,
  loadaddproduct,
  loadeditproducts,
  editcategory,
  loadoffers,
  addoffer,
  loadaddoffer,
  exportExcel,
  addcoupons,
  loadaddcoupons,
  loadaddoffers,
  addoffers,
  unlistCoupon,
  listCoupon
};
