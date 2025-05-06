const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  tanggal: { type: Date, required: true },
  jenis: { type: String, required: true },
  rawTransactionType: { type: String },
  nominal: { type: Number, required: true },
  partner: { type: String },
  rekening: { type: String },
  note: { type: String },
  referenceNumber: { type: String },
  username: { type: String },
  fee: { type: Number, default: 0 },
  raw: { type: Object },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema); 