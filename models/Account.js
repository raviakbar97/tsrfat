const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
  name: { type: String, required: true },
  accountNumber: { type: String, required: true },
  bank: { type: String, required: true },
  saldo: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Account', AccountSchema); 