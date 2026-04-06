const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const app = express();

// =======================
// Middleware
// =======================
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const SECRET = "secret123";

// =======================
// MongoDB Connect
// =======================
mongoose.connect("mongodb+srv://jayprakash17092003_db_user:LkLPKBFwgAy4LHBY@cluster0.9pxuknj.mongodb.net/?appName=Cluster0")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("MongoDB Connection Error:", err));

// =======================
// Models
// =======================
const User = mongoose.model("User", new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: String
}));

const Donor = mongoose.model("DonorRequest", new mongoose.Schema({
  userId: String,
  name: String,
  email: String,
  mobile: String,
  address: String,
  bloodGroup: String,
  units: Number,
  photo: String,
  status: { type: String, default: "pending" }
}));

const Request = mongoose.model("BloodRequest", new mongoose.Schema({
  userId: String,
  name: String,
  email: String,
  contact: String,
  address: String,
  bloodGroup: String,
  unitsNeeded: Number,
  photo: String,
  status: { type: String, default: "pending" }
}));

const Inventory = mongoose.model("Inventory", new mongoose.Schema({
  bloodGroup: String,
  availableUnits: Number
}));

// =======================
// JWT Middleware
// =======================
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "No token provided" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// =======================
// Multer (file upload)
// =======================
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// =======================
// ROUTES
// =======================

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!email.includes("@")) return res.status(400).json({ success: false, message: "Invalid email" });
    if (password.length < 5) return res.status(400).json({ success: false, message: "Password too short" });

    const hash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hash, role });
    await user.save();
    res.json({ success: true, message: "Registered Successfully", user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: "Wrong password" });

    const token = jwt.sign({ id: user._id, role: user.role, name: user.name, email: user.email }, SECRET);
    res.json({ success: true, token, role: user.role, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DONOR SUBMIT
app.post("/api/donor", auth, upload.single("photo"), async (req, res) => {
  try {
    const data = req.body;
    if (data.units <= 0) return res.status(400).json({ success: false, message: "Invalid units" });

    const donor = new Donor({
      ...data,
      userId: req.user.id,
      photo: req.file?.filename || ""
    });
    await donor.save();
    res.json({ success: true, message: "Donor Request Submitted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// BLOOD REQUEST SUBMIT
app.post("/api/request", auth, upload.single("photo"), async (req, res) => {
  try {
    const reqData = new Request({
      ...req.body,
      userId: req.user.id,
      photo: req.file?.filename || ""
    });
    await reqData.save();
    res.json({ success: true, message: "Blood Request Submitted", requestId: reqData._id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =======================
// ADMIN ROUTES
// =======================
app.get("/api/admin/all", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ success: false, message: "Access denied" });
    const donors = await Donor.find();
    const requests = await Request.find();
    const inventory = await Inventory.find();
    res.json({ donors, requests, inventory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/admin/approve-donor/:id", auth, async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ success: false, message: "Donor not found" });

    donor.status = "approved";

    let inv = await Inventory.findOne({ bloodGroup: donor.bloodGroup });
    if (!inv) inv = new Inventory({ bloodGroup: donor.bloodGroup, availableUnits: 0 });
    inv.availableUnits += donor.units;

    await inv.save();
    await donor.save();

    res.json({ success: true, message: "Donor approved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/admin/approve-request/:id", auth, async (req, res) => {
  try {
    const reqBlood = await Request.findById(req.params.id);
    if (!reqBlood) return res.status(404).json({ success: false, message: "Request not found" });

    let inv = await Inventory.findOne({ bloodGroup: reqBlood.bloodGroup });
    if (!inv || inv.availableUnits < reqBlood.unitsNeeded)
      return res.status(400).json({ success: false, message: "Not enough units" });

    inv.availableUnits -= reqBlood.unitsNeeded;
    reqBlood.status = "approved";

    await inv.save();
    await reqBlood.save();

    res.json({ success: true, message: "Request approved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ❌ Reject Donor
app.put("/api/admin/reject-donor/:id", auth, async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ message: "Donor not found" });

    donor.status = "rejected";
    await donor.save();

    res.json({ message: "Donor rejected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// ❌ Reject Blood Request
app.put("/api/admin/reject-request/:id", auth, async (req, res) => {
  try {
    const reqBlood = await Request.findById(req.params.id);
    if (!reqBlood) return res.status(404).json({ message: "Request not found" });

    reqBlood.status = "rejected";
    await reqBlood.save();

    res.json({ message: "Request rejected" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =======================
// HOSPITAL ROUTES
// =======================
const hospitalAuth = (req, res, next) => {
  if (req.user.role !== "hospital") return res.status(403).json({ success: false, message: "Access denied" });
  next();
};

app.get("/api/hospital/inventory", auth, hospitalAuth, async (req, res) => {
  try {
    const inventory = await Inventory.find();
    res.json(inventory);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get("/api/hospital/donors", auth, hospitalAuth, async (req, res) => {
  try {
    const donors = await Donor.find();
    res.json(donors);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get("/api/hospital/requests", auth, hospitalAuth, async (req, res) => {
  try {
    const requests = await Request.find();
    res.json(requests);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// =======================
// START SERVER
// =======================
app.listen(5000, () => console.log("Server running on port 5000"));