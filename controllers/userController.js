const bcrypt = require("bcrypt");
const User = require("../model/usermodal");
const Products = require("../model/productsmodal");
const saltround = 10;
const path = require("path");
const userotpverification = require("../model/otpverification");
const nodemailer = require("nodemailer");
const googlemodal = require("../model/googleModel");
const Address = require("../model/addressModel");
const Orders = require("../model/ordersmodal");
const { OAuth2Client } = require("google-auth-library");
const { Console, profile, log, error } = require("console");
const Category = require("../model/categoryModel");
const Offer = require("../model/offermodel");
const Wishlist = require("../model/wishlistModel");
const client = new OAuth2Client(
  "458432719748-rs94fgenq571a8jfulbls7dk9i10mv2o.apps.googleusercontent.com"
);

require("dotenv").config();

const loadhome = async (req, res) => {
  try {
    const categories = await Category.find({});
    if (req.session.passport && req.session.passport.user) {
      req.session.userId = req.session.passport.user;
    }

    const products = await Products.find({ islisted: true })
      .populate("offer")
      .populate({
        path: "category",
        match: { islisted: true },
        select: "category islisted"
      });

    const activeOffers = await Offer.find({ Status: true });

     const filteredProducts = products.filter(product => product.category);

    const productsWithOfferPrice = filteredProducts.map((product) => {
      let discountValue = null;
      let discountType = null;
      let offerPrice = product.price;  
      const matchedOffer = activeOffers.find(offer =>
        offer.Products && offer.Products.some(productId => productId.equals(product._id))
      );

      if (matchedOffer) {
        discountType = matchedOffer.DiscountType;

        if (discountType === "percentage") {
          offerPrice = product.price - (product.price * matchedOffer.DiscountValue) / 100;
          discountValue = `${matchedOffer.DiscountValue}%`;
        } else if (discountType === "fixed") {
          offerPrice = product.price - matchedOffer.DiscountValue;
          discountValue = `₹${matchedOffer.DiscountValue}`;
        }
      }

      return {
        _id: product._id,
        name: product.name,
        images: product.images,
        category: product.category,
        price: product.price, 
        offerPrice: offerPrice,  
        discountValue: discountValue, 
        discountType: discountType,
        stock: product.stock,
      };
    });

    res.render("home", { products: productsWithOfferPrice });
  } catch (err) {
    console.error("Error loading home page:", err);
    res.status(500).send("Failed to load home page");
  }
};
const loadproducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;

    const totalProducts = await Products.countDocuments();
    const categories = await Category.find({});
    const products = await Products.find({islisted:true})
      .populate("category")
      .populate("category")
      .skip(skip)
      .limit(limit)
      .exec();

    const totalPages = Math.ceil(totalProducts / limit);
    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

     const activeOffers = await Offer.find({ Status: true });

     const productsWithOfferPrice = products.map((product) => {
      let discountValue = null;
      let discountType = null;
      let offerPrice = product.price;  
      let discountDisplay = null;

        const matchedOffer = activeOffers.find(offer =>
        offer.Products.some(productId => productId.equals(product._id))
      );

      if (matchedOffer) {
        discountType = matchedOffer.DiscountType;

        if (discountType === "percentage") {
          offerPrice = product.price - (product.price * matchedOffer.DiscountValue) / 100;
          discountValue = `${matchedOffer.DiscountValue}%`;
        } else if (discountType === "fixed") {
          offerPrice = product.price - matchedOffer.DiscountValue;
          discountValue = `₹${matchedOffer.DiscountValue}`;
        }
      }

       return {
        _id: product._id,
        name: product.name,
        images: product.images,
        category: product.category,
        price: product.price,  
        offerPrice: offerPrice, 
        discountValue: discountValue, 
        discountType: discountType,
        stock: product.stock,
      };
    });

     res.render("products", { 
      products: productsWithOfferPrice, 
      categories,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts,
      previousPage: previousPage,
      nextPage: nextPage
      });
  } catch (error) {
    console.error("Error fetching and updating products:", error);
    res.status(500).send("Failed to fetch or update products.");
  }
};
const singleproduct = async (req, res) => {
  const productId = req.params.id;

  try {
     const product = await Products.findById(productId).populate("offer").populate("category");
    const activeOffers = await Offer.find({ Status: true });
    const products = await Products.find({ islisted: true });

    if (!product) {
      return res.status(404).send("Product not found");
    }

     let discountValue = null;
    let discountType = null;
    let priceWithDiscount = product.price;  

    const matchedOffer = activeOffers.find((offer) =>
      offer.Products.some((productId) => productId.equals(product._id))
    );

     if (matchedOffer) {
      discountType = matchedOffer.DiscountType;

      if (discountType === "percentage") {
        priceWithDiscount = product.price - (product.price * matchedOffer.DiscountValue) / 100;
        discountValue = `${matchedOffer.DiscountValue}%`;
      } else if (discountType === "fixed") {
        priceWithDiscount = product.price - matchedOffer.DiscountValue;
        discountValue = `₹${matchedOffer.DiscountValue}`;
      }
    }
    const productWithOffer = {
      ...product.toObject(),  
      priceWithDiscount,
      discountValue,
      discountType,
    };

      res.render("singleproduct", { product: productWithOffer, products });
  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).send("Failed to fetch product details.");
  }
};
const loadWishlist = async (req, res) => {
  const userId = req.session.userId;  
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;

    const totalProducts = await Products.countDocuments();
    

    const totalPages = Math.ceil(totalProducts / limit);
    const previousPage = page > 1 ? page - 1 : null;
    const nextPage = page < totalPages ? page + 1 : null;

     const userWishlist = await Wishlist.find({ user: userId })  
      .populate({
        path: "products",
        populate: [{ path: "category" }, { path: "offer" }],
      });

     const categories = await Category.find({});
    const activeOffers = await Offer.find({ Status: true });

     const productsWithOfferPrice = userWishlist.map((item) => {
      const product = item.products;
      let discountValue = null;
      let discountType = null;
      let offerPrice = product.price;

       const matchedOffer = activeOffers.find((offer) =>
        offer.Products?.some((productId) => productId.equals(product._id))
      );

      if (matchedOffer) {
        discountType = matchedOffer.DiscountType;

        if (discountType === "percentage") {
          offerPrice = product.price - (product.price * matchedOffer.DiscountValue) / 100;
          discountValue = `${matchedOffer.DiscountValue}%`;
        } else if (discountType === "fixed") {
          offerPrice = product.price - matchedOffer.DiscountValue;
          discountValue = `₹${matchedOffer.DiscountValue}`;
        }
      }

       return {
        _id: product._id,
        name: product.name,
        images: product.images,
        category: product.category?.name || "Unknown",  
        price: product.price,
        offerPrice: matchedOffer ? offerPrice : null,
        discountValue: matchedOffer ? discountValue : null,
        discountType: matchedOffer ? discountType : null,
        stock: product.stock,
      };
    });
     res.render("wishlist", {
      products: productsWithOfferPrice,
      categories,
      currentPage: page,
      totalPages: totalPages,
      totalProducts: totalProducts,
      previousPage: previousPage,
      nextPage: nextPage
    });
  } catch (error) {
    console.error("Error loading wishlist:", error);
    res.status(500).send("Failed to load wishlist.");
  }
};
const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session.userId;

    console.log()

    console.log('user',userId);

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not logged in" });
    }

     const existingWishlistItem = await Wishlist.findOne({ user: userId, products: productId });

    if (existingWishlistItem) {
       await Wishlist.deleteOne({ _id: existingWishlistItem._id });
      return res.json({ success: true, wishlist: false });
    } else {
       const product = await Products.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }

       const newWishlistItem = new Wishlist({
        user: userId,
        products: productId,
        category: product.category,
        offer: product.offer,
      });
      await newWishlistItem.save();
      console.log(newWishlistItem)
      return res.json({ success: true, wishlist: true });
    }
  } catch (error) {
    console.log(error)
    console.error("Error toggling wishlist:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
const loadshop = (req, res) => {
  try {
    res.render("shop");
  } catch (error) {
    console.error(error);
  }
};
const loadaboutpage = (req, res) => {
  res.render("about");
};
const loadcontactpage = (req, res) => {
  res.render("contact");
};
const advancedSearch = async (req, res) => {
  try {
    const {
      query = "",
      sort,
      showOutOfStock,
      minPrice,
      maxPrice,
      category,
      rating,
      page = 1,
      limit = 10,
    } = req.query;

    let filter = { islisted: true };

    if (query) {
      filter.name = { $regex: query.trim(), $options: "i" };
    }

    if (showOutOfStock === "exclude") {
      filter.stock = { $gt: 0 };
    }

    if (!isNaN(parseFloat(minPrice)) || !isNaN(parseFloat(maxPrice))) {
      filter.price = {};
      if (!isNaN(parseFloat(minPrice))) filter.price.$gte = parseFloat(minPrice);
      if (!isNaN(parseFloat(maxPrice))) filter.price.$lte = parseFloat(maxPrice);
    }

    if (category && category !== "all") {
      const categoryDoc = await Category.findOne({ category: category.trim() });
      if (categoryDoc) {
        filter.category = categoryDoc._id;
      } else {
        console.warn(`Category not found: ${category}`);
      }
    }

    const sortOptions = {
      popularity: { popularity: -1 },
      priceLowToHigh: { price: 1 },
      priceHighToLow: { price: -1 },
      averageRatings: { averageRating: -1 },
      featured: { featured: -1 },
      newArrivals: { createdAt: -1 },
      aToZ: { name: 1 },
      zToA: { name: -1 },
    };
    const sortOption = sortOptions[sort] || {};

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const products = await Products.find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("category", "category brand")
      .populate("offer"); // Ensure offers are populated

    const activeOffers = await Offer.find({ Status: true });

    const productsWithOfferPrice = products.map((product) => {
      let discountValue = null;
      let discountType = null;
      let offerPrice = product.price;
      let discountDisplay = null;

      const matchedOffer = activeOffers.find((offer) =>
        offer.Products.some((productId) => productId.equals(product._id))
      );

      if (matchedOffer) {
        discountType = matchedOffer.DiscountType;

        if (discountType === "percentage") {
          offerPrice =
            product.price - (product.price * matchedOffer.DiscountValue) / 100;
          discountValue = `${matchedOffer.DiscountValue}%`;
        } else if (discountType === "fixed") {
          offerPrice = product.price - matchedOffer.DiscountValue;
          discountValue = `₹${matchedOffer.DiscountValue}`;
        }
      }

      return {
        ...product.toObject(),
        offerPrice: offerPrice,
        discountValue: discountValue,
        discountType: discountType,
      };
    });

    const totalProducts = await Products.countDocuments(filter);

    if (req.xhr) {
      return res.json({
        products: productsWithOfferPrice,
        totalProducts,
        currentPage: parseInt(page),
      });
    } else {
      res.render("products", {
        products: productsWithOfferPrice,
        query,
        sort,
        showOutOfStock,
        minPrice,
        maxPrice,
        category,
        rating,
        totalProducts,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalProducts / limit),
      });
    }
  } catch (error) {
    console.log("Error during advanced search:", error);
    res.status(500).json({ message: "Error fetching products." });
  }
};

module.exports = {
  advancedSearch,
  loadcontactpage,
  loadshop,
  loadaboutpage,
  loadhome,
  loadproducts,
  singleproduct,
  loadWishlist,
  toggleWishlist,
};
