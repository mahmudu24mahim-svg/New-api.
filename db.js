const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  label: String,
  limit: Number,
  used: { type: Number, default: 0 },
  expiry: Number,
  createdAt: { type: Number, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
