const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const JournalEntry = require('../models/JournalEntry');

// GET /transactions - ambil semua transaksi
router.get('/', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ tanggal: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /transactions - create a new transaction
router.post('/', async (req, res) => {
  try {
    const { tanggal, jenis, nominal, partner, rekening, note, akunDebet, akunKredit } = req.body;
    
    // Create the transaction
    const transaction = new Transaction({
      tanggal,
      jenis,
      nominal,
      partner,
      rekening,
      note
    });
    
    await transaction.save();
    
    // Create a corresponding journal entry
    const journalEntry = new JournalEntry({
      tanggal,
      deskripsi: note || `${jenis} - ${partner || 'Unknown'}`,
      akunDebet,
      akunKredit,
      nominal,
      needsReview: false,
      isApproved: true,
      transactionId: transaction._id
    });
    
    await journalEntry.save();
    
    // Return both the transaction and journal entry
    res.status(201).json({
      success: true,
      transaction,
      journalEntry
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /transactions/:id - update an existing transaction
router.put('/:id', async (req, res) => {
  try {
    const { tanggal, jenis, nominal, partner, rekening, note, akunDebet, akunKredit } = req.body;
    
    // Update the transaction
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { tanggal, jenis, nominal, partner, rekening, note },
      { new: true }
    );
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Find and update the corresponding journal entry
    const journalEntry = await JournalEntry.findOne({ transactionId: transaction._id });
    
    if (journalEntry) {
      journalEntry.tanggal = tanggal;
      journalEntry.deskripsi = note || `${jenis} - ${partner || 'Unknown'}`;
      journalEntry.akunDebet = akunDebet;
      journalEntry.akunKredit = akunKredit;
      journalEntry.nominal = nominal;
      
      await journalEntry.save();
    } else {
      // If no journal entry exists, create a new one
      const newJournalEntry = new JournalEntry({
        tanggal,
        deskripsi: note || `${jenis} - ${partner || 'Unknown'}`,
        akunDebet,
        akunKredit,
        nominal,
        needsReview: false,
        isApproved: true,
        transactionId: transaction._id
      });
      
      await newJournalEntry.save();
    }
    
    res.json({
      success: true,
      transaction
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /transactions/review - update needsReview pada transaksi tertentu
router.post('/review', async (req, res) => {
  const { transactionId, needsReview } = req.body;
  try {
    const transaction = await Transaction.findByIdAndUpdate(
      transactionId,
      { needsReview },
      { new: true }
    );
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; 