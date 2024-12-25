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
const Wallet = require("../model/walletModel");
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
    if (!category || !brand || !bandcolor) {
      return res.render("admin/addcategory", {
        message: "All fields are required"
      });
    }
    const existingCategory = await Category.findOne({
      category: { $regex: `^${category}$`, $options: "i" }
    });

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
    console.log(`Something went wrong: ${error}`);
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

    const trimmedName = name.trim();
    const trimmedCategory = category.trim();

    if (!trimmedName || !trimmedCategory || !stock || !price) {
      return res.render("admin/products", {
        message: "All fields are required",
      });
    }

    const existingProduct = await Products.findOne({
      name: trimmedName,
      _id: { $ne: id },
    });

    if (existingProduct) {
      return res.render("admin/products", {
        message: "A product with this name already exists.",
      });
    }

    const stockNumber = parseInt(stock.trim(), 10);
    const priceNumber = parseFloat(price.trim());

    if (isNaN(stockNumber) || stockNumber < 0) {
      return res.render("admin/products", {
        message: "Stock must be a valid number and cannot be negative.",
      });
    }

    if (isNaN(priceNumber) || priceNumber < 0) {
      return res.render("admin/products", {
        message: "Price must be a valid number and cannot be negative.",
      });
    }

    const product = await Products.findById(id);
    if (!product) {
      return res.render("admin/products", {
        message: "Product not found.",
      });
    }

    Object.assign(product, {
      name: trimmedName,
      category: trimmedCategory,
      stock: stockNumber,
      price: priceNumber.toFixed(2),
    });

    await product.save();
    console.log("Product updated successfully:", product);

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).render("admin/products", {
      message: "An error occurred while updating the product.",
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
    const categories = await Category.find({});
    const { name, category, stock, price, description } = req.body;
    const { files } = req;

    console.log("Request body:", req.body);
    console.log("Uploaded files:", files);

    if (!name || !category || !stock || !price || !description) {
      return res.status(400).render("admin/addproduct", {
        categories,
        message: "All fields are required.",
      });
    }

    if (isNaN(stock) || stock <= 0) {
      return res.status(400).render("admin/addproduct", {
        categories,
        message: "Stock must be a positive number.",
      });
    }

    if (isNaN(price) || price <= 0) {
      return res.status(400).render("admin/addproduct", {
        categories,
        message: "Price must be a positive number.",
      });
    }

    if (!files || files.length < 3) {
      return res.status(400).render("admin/addproduct", {
        categories,
        message: "Please upload at least 3 images.",
      });
    }
    const validImageTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif"];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!validImageTypes.includes(file.mimetype)) {
        return res.status(400).render("admin/addproduct", {
          categories,
          message: `Invalid image format for file: ${file.originalname}. Please upload only image files.`,
        });
      }
    }

    const existingProduct = await Products.findOne({ name });
    if (existingProduct) {
      return res.render("admin/addproduct", {
        categories,
        modalError: "Product already exists",
        message: "Product already exists.",
      });
    }

    const categoryObj = await Category.findOne({ category });
    if (!categoryObj) {
      return res.status(400).render("admin/addproduct", {
        categories,
        message: "Category not found.",
      });
    }

    const newProduct = new Products({
      name,
      category: categoryObj._id,
      stock,
      price,
      description: description || "Default description",
      images: files.map((file) => file.path),
    });

    await newProduct.save();
    console.log("New product saved:", newProduct);

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error adding product:", error.message);
    res.status(500).render("admin/addproduct", {
      categories,
      message: "An error occurred while adding the product. Please try again.",
    });
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
    const product = await Products.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (stock < 0) {
      return res.redirect("/admin/inventory")
    }

    if (product.name === name && product.stock === parseInt(stock)) {
      return res.redirect("/admin/inventory")
    }

    const existingProduct = await Products.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      _id: { $ne: productId }
    });
    if (existingProduct) {
      return res.redirect("/admin/inventory")
    }

    product.name = name || product.name;
    product.stock = stock || product.stock;
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

    const order = await Orders.findById(orderId);
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    const item = order.items.id(itemId);
    if (!item) {
      console.log("Item not found for ID:", itemId);
      return res
        .status(404)
        .json({ success: false, message: "Item not found in order." });
    }

    item.status = "canceled";

    await order.save();

    console.log("Item canceled successfully for item ID:", itemId);

    res.redirect("/admin/orders"); 
  } catch (error) {
    console.error("Error canceling item:", error);
    res.status(500).json({ success: false, message: "Failed to cancel item." });
  }
};
const updateOrderStatus = async (req, res) => {
  const { orderId, itemId, status ,currentPage} = req.body; 
   console.log("Request Body:", req.body);

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

    const validStatuses = [
      "canceled",
      "scheduled",
      "pending",
      "delivered",
      "shipped",
      "payment-pending",
      "returned"
    ];
    if (!validStatuses.includes(status)) {
      console.log("Invalid status:", status);
      return res
        .status(400)
        .json({ success: false, message: "Invalid status." });
    }

    const order = await Orders.findById(orderId);
    if (!order) {
      console.log("Order not found for ID:", orderId);
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    const item = order.items.id(itemId);
    if (!item) {
      console.log("Item not found for ID:", itemId);
      return res
        .status(404)
        .json({ success: false, message: "Item not found in order." });
    }

    if (item.status === "delivered") {
      return res.status(400).json({
        success: false,
        message: "Item is already delivered and cannot be canceled."
      });
    }

    item.status = status;
    if (status === "canceled") {
      const product = await Products.findById(item.productId);
      if (product) {
        product.stock += item.quantity;
        await product.save();
      } else {
        console.warn("Product not found for stock update");
      }

      if (order.paymentMethod === "razorpay") {
        let refundAmount =
          (item.priceWithDiscount || item.price) * item.quantity;
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
                  description: `Refund for canceled product (${item.productId
                    .name}) in order ${orderId}`
                }
              ]
            });
          } else {
            wallet.balance += refundAmount;
            wallet.transactions.push({
              type: "refund",
              amount: refundAmount,
              description: `Refund for canceled product (${item.productId
                .name}) in order ${orderId}`
            });
          }

          await wallet.save();
        }
      }
    }
    await order.save();

    if (order.items.every(item => item.status === "canceled")) {
      order.status = "canceled";
      await order.save();
    }

    console.log("Item status updated successfully for item ID:", itemId);

    res.redirect(`/admin/orders?page=${currentPage}`);
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
      .sort({ createdAt: -1 }) 
      .exec();

    const totalPages = Math.ceil(totalOrders / limit);
    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

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
      couponCode,
      DiscountType,
      DiscountValue,
      minPurchase,
      Products,
      UsageLimit,
      expiryDate
    } = req.body;
    console.log("req.bosyy..,", req.body);
    if (
      !couponCode ||
      !DiscountType ||
      !DiscountValue ||
      !minPurchase ||
      !Products ||
      !UsageLimit ||
      !expiryDate
    ) {
      return res.status(400).send("All fields are required");
    }

    const existingCoupon = await Coupon.findOne({ couponCode });
    if (existingCoupon) {
      return res.status(400).send("Coupon Code already exists");
    }

    if (DiscountType === "percentage" && DiscountValue > 50) {
      return res.status(400).send("Discount values must be below 100");
    }

    const currentDate = new Date();
    const parsedExpiryDate = new Date(expiryDate);
    if (parsedExpiryDate <= currentDate) {
      return res.status(400).send("Expiry date must be in the future");
    }

    const newCoupon = new Coupon({
      couponCode,
      Products,
      DiscountType,
      DiscountValue,
      minPurchase,
      UsageLimit,
      expiryDate
    });

    await newCoupon.save();
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error adding coupon");
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
  const { couponId } = req.params;
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

    await Products.updateMany(
      { _id: { $in: productIds } },
      {
        $set: {
          priceWithDiscount:
            DiscountType === "fixed" ? DiscountValue : undefined, 
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

    await newoffer.save();
    console.log("New offer created: ", newoffer);
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
    return res.redirect("/admin/offer");
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

    const updatedOffer = await Offer.findByIdAndUpdate(
      offerId,
      {
        DiscountType,
        DiscountValue,
        Description,
        Products: productIds,
        Categories: categoryIds, 
        ExpiryDate: formattedExpiryDate,
        Status
      },
      { new: true }
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
    const salesData = JSON.parse(req.body.salesData); 
    const doc = new PDFDocument({ margin: 20 });
    const filename = `Sales_Report_${Date.now()}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");

    doc.pipe(res);

    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Sales Report", { align: "center" });
    doc.moveDown(1);

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
  const filter = req.query.filter;
  const itemStatus = req.query.itemStatus || "delivered";

  if (!filter) {
    return res.status(400).json({ error: "Filter is required" });
  }

  try {
    let groupStage = {};
    let sortStage = {};
    let labels = [];
    let totalPrices = [];

    let matchStage = {
      "items.status": itemStatus,
    };

    switch (filter) {
      case "yearly":
        groupStage = {
          _id: { year: { $year: "$createdAt" } },
          totalSales: { $sum: "$orderTotal" },
        };
        sortStage = { "_id.year": 1 };
        break;

      case "monthly":
        groupStage = {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalSales: { $sum: "$orderTotal" },
        };
        sortStage = { "_id.year": 1, "_id.month": 1 };
        break;

      case "weekly":
        groupStage = {
          _id: { year: { $year: "$createdAt" }, week: { $week: "$createdAt" } },
          totalSales: { $sum: "$orderTotal" },
        };
        sortStage = { "_id.year": 1, "_id.week": 1 };
        break;

      default:
        return res.status(400).json({ error: "Invalid filter value" });
    }

    const salesData = await Orders.aggregate([
      { $match: matchStage },
      { $group: groupStage },
      { $sort: sortStage },
    ]);

    if (filter === "yearly") {
      const fixedYears = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

      labels = [...fixedYears];
      totalPrices = new Array(fixedYears.length).fill(0);

      salesData.forEach(item => {
        const yearIndex = fixedYears.indexOf(item._id.year);
        if (yearIndex !== -1) {
          totalPrices[yearIndex] = item.totalSales;
        }
      });
    } else if (filter === "monthly") {
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      let monthData = new Array(12).fill(0);
      salesData.forEach(item => {
        const monthIndex = item._id.month - 1;
        monthData[monthIndex] = item.totalSales;
      });

      labels = months;
      totalPrices = monthData;
    } else if (filter === "weekly") {
      labels = [];
      totalPrices = [];

      salesData.forEach(item => {
        const week = item._id.week || "N/A";
        const year = item._id.year || "N/A";

        if (week !== "N/A" && year !== "N/A") {
          labels.push(`Week ${week} - ${year}`);
          totalPrices.push(item.totalSales);
        } else {
          console.warn("Invalid Weekly Data:", item);
        }
      });
    }

    console.log("Labels:", labels);
    console.log("Total Prices:", totalPrices);
    console.log("Aggregated Sales Data:", salesData);

    res.json({ labels, totalPrices });
  } catch (error) {
    console.error("Error fetching sales data:", error);
    res.status(500).json({ error: "Failed to fetch sales data" });
  }
};
const categorySales = async (req, res) => {
  const itemStatus = req.query.itemStatus || "delivered";

  try {
    const salesData = await Orders.aggregate([
      { $match: { "items.status": itemStatus } }, 
      { $unwind: "$items" },
      {
        $lookup: {
          from: "categories", 
          localField: "items.categoryId", 
          foreignField: "_id",
          as: "categoryDetails"
        }
      },
      { $unwind: "$categoryDetails" },
      {
        $group: {
          _id: "$categoryDetails.category",
          totalSales: { $sum: "$items.price" },
          totalQuantity: { $sum: "$items.quantity" }
        }
      },
      { $sort: { totalSales: -1 } } 
    ]);

    const labels = salesData.map(item => item._id);
    const totalPrices = salesData.map(item => item.totalSales);

    console.log("Category Labels:", labels);
    console.log("Category Total Sales:", totalPrices);

    res.json({ labels, totalPrices });
  } catch (error) {
    console.error("Error fetching category-wise sales data:", error);
    res.status(500).json({ error: "Failed to fetch category-wise sales data" });
  }
};

module.exports = {
  getSalesData,
  categorySales,
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
  loadaddcoupons,
  loadaddoffers,
  addoffers,
  unlistCoupon,
  listCoupon
};
