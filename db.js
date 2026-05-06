const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  label: String,
  limit: Number,
  used: { type: Number, default: 0 },
  expiry: Number
});

module.exports = mongoose.model("User", userSchema);
