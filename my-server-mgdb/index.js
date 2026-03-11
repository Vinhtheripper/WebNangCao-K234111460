const express = require('express');
const app = express();
const port = process.env.PORT || 3002;
const morgan = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "FashionData";
const corsOptions = {
  origin: ["http://localhost:4200", "http://127.0.0.1:4200"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(morgan("combined"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || "ex63-cart-secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 1000 * 60 * 60
  }
}));

app.get("/", (req, res) => {
  res.send("This Web server is processed for MongoDB");
});

app.get("/create-cookie", (req, res) => {
  res.cookie("username", "tranduythanh");
  res.cookie("password", "123456");
  res.cookie("account", { username: "tranduythanh", password: "123456" });
  res.cookie("infor_limit1", "I am limited Cookie - way 1", { expires: new Date(Date.now() + 360000) });
  res.cookie("infor_limit2", "I am limited Cookie - way 2", { maxAge: 360000 });
  res.send("cookies are created");
});

app.get("/read-cookie", (req, res) => {
  const username = req.cookies.username;
  const password = req.cookies.password;
  const account = req.cookies.account;

  let info = `username = ${username}<br/>`;
  info += `password = ${password}<br/>`;

  if (account != null) {
    info += `account.username = ${account.username}<br/>`;
    info += `account.password = ${account.password}<br/>`;
  }

  res.send(info);
});

app.get("/clear-cookie", (req, res) => {
  res.clearCookie("account");
  res.send("[account] Cookie is removed");
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required" });
    }

    const userCollection = app.locals.database.collection("User");
    const user = await userCollection.findOne({
      $or: [{ username }, { name: username }, { email: username }]
    });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "invalid username or password" });
    }

    const displayName = user.username || user.name || user.email;
    res.cookie("login_user", displayName, { maxAge: 24 * 60 * 60 * 1000, sameSite: "lax" });
    res.cookie("login_user_id", String(user._id), { maxAge: 24 * 60 * 60 * 1000, sameSite: "lax", httpOnly: true });

    return res.json({
      message: "login successful",
      user: {
        _id: String(user._id),
        username: displayName
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", detail: error.message });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");

    const userId = req.cookies.login_user_id;
    const username = req.cookies.login_user;

    if (!userId || !username) {
      return res.json({ loggedIn: false, message: "No login cookie found" });
    }

    return res.json({
      loggedIn: true,
      user: {
        _id: userId,
        username
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "internal server error", detail: error.message });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("login_user");
  res.clearCookie("login_user_id");
  return res.json({ message: "logged out" });
});

app.get("/contact", (req, res) => {
  if (req.session.visited != null) {
    req.session.visited += 1;
    res.send("You visited this page " + req.session.visited + " times");
  } else {
    req.session.visited = 1;
    res.send("Welcome to this page for the first time!");
  }
});

function normalizeFashionInput(data = {}) {
  return {
    title: String(data.title || "").trim(),
    details: String(data.details || "").trim(),
    thumbnail: String(data.thumbnail || "").trim(),
    style: String(data.style || "").trim(),
    createdAt: data.createdAt ? new Date(data.createdAt) : new Date()
  };
}

function validateFashionInput(data) {
  if (!data.title) return "title is required";
  if (!data.details) return "details is required";
  if (!data.thumbnail) return "thumbnail is required";
  if (!data.style) return "style is required";
  if (!(data.createdAt instanceof Date) || Number.isNaN(data.createdAt.getTime())) {
    return "createdAt is invalid";
  }
  return "";
}

function toFashionResponse(doc) {
  return {
    _id: String(doc._id),
    title: doc.title,
    details: doc.details,
    thumbnail: doc.thumbnail,
    style: doc.style,
    createdAt: doc.createdAt
  };
}

app.get("/api/fashions", async (req, res) => {
  try {
    const style = String(req.query.style || "").trim();
    const filter = style ? { style: { $regex: style, $options: "i" } } : {};

    const docs = await app.locals.fashionCollection.find(filter).sort({ createdAt: -1 }).toArray();
    return res.json(docs.map(toFashionResponse));
  } catch (error) {
    return res.status(500).json({ message: "Cannot load fashions", detail: error.message });
  }
});

app.get("/api/fashions/styles", async (req, res) => {
  try {
    const styles = await app.locals.fashionCollection.distinct("style");
    return res.json(styles.sort((a, b) => String(a).localeCompare(String(b))));
  } catch (error) {
    return res.status(500).json({ message: "Cannot load styles", detail: error.message });
  }
});

app.get("/api/fashions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const doc = await app.locals.fashionCollection.findOne({ _id: new ObjectId(id) });
    if (!doc) {
      return res.status(404).json({ message: "Fashion not found" });
    }
    return res.json(toFashionResponse(doc));
  } catch (error) {
    return res.status(500).json({ message: "Cannot load fashion detail", detail: error.message });
  }
});

app.post("/api/fashions", async (req, res) => {
  try {
    const payload = normalizeFashionInput(req.body);
    const errorMessage = validateFashionInput(payload);
    if (errorMessage) {
      return res.status(400).json({ message: errorMessage });
    }

    const result = await app.locals.fashionCollection.insertOne(payload);
    const created = await app.locals.fashionCollection.findOne({ _id: result.insertedId });
    return res.status(201).json(toFashionResponse(created));
  } catch (error) {
    return res.status(500).json({ message: "Cannot create fashion", detail: error.message });
  }
});

app.put("/api/fashions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const payload = normalizeFashionInput(req.body);
    const errorMessage = validateFashionInput(payload);
    if (errorMessage) {
      return res.status(400).json({ message: errorMessage });
    }

    const result = await app.locals.fashionCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: payload }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Fashion not found" });
    }
    const updated = await app.locals.fashionCollection.findOne({ _id: new ObjectId(id) });
    return res.json(toFashionResponse(updated));
  } catch (error) {
    return res.status(500).json({ message: "Cannot update fashion", detail: error.message });
  }
});

app.delete("/api/fashions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const result = await app.locals.fashionCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Fashion not found" });
    }
    return res.json({ message: "Fashion deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Cannot delete fashion", detail: error.message });
  }
});

function getCartFromSession(req) {
  if (!Array.isArray(req.session.cart)) {
    req.session.cart = [];
  }
  return req.session.cart;
}

app.get("/products", async (req, res) => {
  try {
    const products = await app.locals.productCollection.find({}).toArray();
    return res.json(products);
  } catch (error) {
    return res.status(500).json({ message: "Cannot load products", detail: error.message });
  }
});

app.get("/cart", (req, res) => {
  return res.json(getCartFromSession(req));
});

app.get("/add-to-cart/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await app.locals.productCollection.findOne({ _id: productId });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const cart = getCartFromSession(req);
    const existed = cart.find((item) => item._id === productId);
    if (existed) {
      existed.qty += 1;
    } else {
      cart.push({
        _id: product._id,
        sku: product.sku,
        name: product.name,
        image: product.image,
        price: Number(product.price) || 0,
        qty: 1
      });
    }

    req.session.cart = cart;
    return res.json({ message: "Added to cart", cartCount: cart.length, cart });
  } catch (error) {
    return res.status(500).json({ message: "Cannot add to cart", detail: error.message });
  }
});

app.post("/update-cart", (req, res) => {
  try {
    const removeIds = Array.isArray(req.body.removeIds) ? req.body.removeIds : [];
    const quantities = req.body.quantities || {};
    const removeSet = new Set(removeIds.map(String));

    let cart = getCartFromSession(req).filter((item) => !removeSet.has(String(item._id)));
    cart = cart.map((item) => {
      const rawQty = Number(quantities[item._id]);
      const qty = Number.isFinite(rawQty) && rawQty > 0 ? Math.floor(rawQty) : item.qty;
      return { ...item, qty };
    });

    req.session.cart = cart;
    return res.json({ message: "Cart updated", cart });
  } catch (error) {
    return res.status(500).json({ message: "Cannot update cart", detail: error.message });
  }
});

async function seedProducts(productCollection) {
  const count = await productCollection.countDocuments();
  if (count > 0) {
    return;
  }

  const sampleProducts = [
    {
      _id: "p001",
      sku: "SKU-001",
      name: "Diamond Promise Ring 1/6 ct tw Round-cut 10K White Gold",
      image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqBDOqu8Wqozk_yECX_gAcp5c3svxQ4hdjow&s",
      price: 399.99
    },
    {
      _id: "p002",
      sku: "SKU-002",
      name: "Diamond Promise Ring 1/4 ct tw Round/Baguette 10K White Gold",
      image: "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=900&q=60",
      price: 529.0
    },
    {
      _id: "p003",
      sku: "SKU-003",
      name: "Diamond Promise Ring 1/6 ct tw Black/White Sterling Silver",
      image: "https://images.unsplash.com/photo-1627293509201-9a5f8f3f5f2f?auto=format&fit=crop&w=900&q=60",
      price: 159.0
    },
    {
      _id: "p004",
      sku: "SKU-004",
      name: "Diamond Promise Ring 1/5 ct tw Round-cut Sterling Silver",
      image: "https://images.unsplash.com/photo-1588444650733-d53f4b9eaec9?auto=format&fit=crop&w=900&q=60",
      price: 289.0
    },
    {
      _id: "p005",
      sku: "SKU-005",
      name: "Diamond Promise Ring 1/5 ct tw Heart-cut Sterling Silver",
      image: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=60",
      price: 289.0
    },
    {
      _id: "p006",
      sku: "SKU-006",
      name: "Diamond Promise Ring 1/8 ct tw Round-cut Sterling Silver Ring",
      image: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=60",
      price: 229.0
    }
  ];

  await productCollection.insertMany(sampleProducts);
}

async function seedFashions(fashionCollection) {
  const count = await fashionCollection.countDocuments();
  if (count > 0) {
    return;
  }

  const sampleFashions = [
    {
      title: "Phil Oh's Best Street Style Photos from Paris",
      details: "<p>Street style in Paris goes bold with bright colors and mixed textures.</p><p>This look combines layered outfits and expressive accessories.</p>",
      thumbnail: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=60",
      style: "Street Style",
      createdAt: new Date("2025-03-04T09:00:00.000Z")
    },
    {
      title: "Vivienne Westwood Inspired London Walk",
      details: "<p>London street outfits focus on attitude and statement outerwear.</p><p>Monochrome pieces are often balanced with one loud accent.</p>",
      thumbnail: "https://images.unsplash.com/photo-1554412933-514a83d2f3c8?auto=format&fit=crop&w=1200&q=60",
      style: "Street Style",
      createdAt: new Date("2025-02-24T13:20:00.000Z")
    },
    {
      title: "Milan Street Layering Ideas",
      details: "<p>Layering in Milan uses clean tailoring with soft knitwear.</p><p>Neutral tones keep the silhouette premium and easy to style.</p>",
      thumbnail: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=60",
      style: "Street Style",
      createdAt: new Date("2025-01-10T10:30:00.000Z")
    },
    {
      title: "Why the Short Suit Returns This Spring",
      details: "<p>The short suit trend brings structured cuts with relaxed mood.</p><p>Pair with loafers for a polished but modern finish.</p>",
      thumbnail: "https://images.unsplash.com/photo-1617127365659-c47fa864d8bc?auto=format&fit=crop&w=1200&q=60",
      style: "Trends",
      createdAt: new Date("2025-03-07T06:50:00.000Z")
    },
    {
      title: "Menswear Runway Forecast 2025",
      details: "<p>Runway direction points to oversized coats and soft tailoring.</p><p>Comfort-led luxury continues to dominate daily outfits.</p>",
      thumbnail: "https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=1200&q=60",
      style: "Trends",
      createdAt: new Date("2025-02-19T08:40:00.000Z")
    },
    {
      title: "Skirts for Men: Styling Without Limits",
      details: "<p>Skirts in menswear are now styled with boots and long coats.</p><p>Designers use utilitarian fabrics for daily wearability.</p>",
      thumbnail: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=60",
      style: "Trends",
      createdAt: new Date("2025-01-25T15:00:00.000Z")
    },
    {
      title: "Resort Minimalism for Summer Escape",
      details: "<p>Resort style leans on light linen and effortless cuts.</p><p>Keep accessories simple to maintain a clean silhouette.</p>",
      thumbnail: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=60",
      style: "Resort",
      createdAt: new Date("2025-03-01T11:10:00.000Z")
    },
    {
      title: "White-on-White Riviera Looks",
      details: "<p>Monochrome white creates a calm but luxurious vacation outfit.</p><p>Use breathable fabrics and minimal jewelry for balance.</p>",
      thumbnail: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=60",
      style: "Resort",
      createdAt: new Date("2025-02-11T07:25:00.000Z")
    },
    {
      title: "Easy Vacation Capsule Wardrobe",
      details: "<p>A capsule wardrobe reduces packing and keeps styling flexible.</p><p>Choose 6-8 pieces that can mix into 15+ outfits.</p>",
      thumbnail: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=60",
      style: "Resort",
      createdAt: new Date("2025-01-16T09:45:00.000Z")
    }
  ];

  await fashionCollection.insertMany(sampleFashions);
}

async function startServer() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();

    const database = client.db(DB_NAME);
    const fashionCollection = database.collection("Fashion");
    const productCollection = database.collection("Product");
    await seedFashions(fashionCollection);
    await seedProducts(productCollection);
    app.locals.database = database;
    app.locals.fashionCollection = fashionCollection;
    app.locals.productCollection = productCollection;

    app.listen(port, () => {
      console.log(`My Server listening on port ${port}`);
      console.log(`MongoDB connected: ${MONGODB_URI} / db=${DB_NAME}`);
    });
  } catch (error) {
    console.error("Cannot connect to MongoDB.");
    console.error("Set MONGODB_URI for Atlas, or start local MongoDB on 127.0.0.1:27017.");
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
