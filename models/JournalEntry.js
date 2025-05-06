const mongoose = require('mongoose');

const JournalEntrySchema = new mongoose.Schema({
  tanggal: { type: Date, required: true },
  deskripsi: { type: String },
  akunDebet: { type: String, required: true },
  akunKredit: { type: String, required: true },
  nominal: { type: Number, required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  needsReview: { type: Boolean, default: false },
  note: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('JournalEntry', JournalEntrySchema); 