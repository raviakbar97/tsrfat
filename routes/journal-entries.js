const express = require('express');
const router = express.Router();
const JournalEntry = require('../models/JournalEntry');

// GET: Mendapatkan semua journal entries
router.get('/', async (req, res) => {
  try {
    const entries = await JournalEntry.find({}).populate('transactionId');
    res.json(entries);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Membuat journal entry baru
router.post('/', async (req, res) => {
  try {
    const { tanggal, deskripsi, akunDebet, akunKredit, nominal, transactionId, needsReview } = req.body;
    
    const journalEntry = new JournalEntry({
      tanggal,
      deskripsi,
      akunDebet,
      akunKredit,
      nominal,
      transactionId,
      needsReview: needsReview !== undefined ? needsReview : false
    });
    
    await journalEntry.save();
    
    res.status(201).json({
      success: true,
      journalEntry
    });
  } catch (error) {
    console.error('Error creating journal entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT: Edit journal entry
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tanggal, deskripsi, akunDebet, akunKredit, nominal, needsReview } = req.body;
    
    const journal = await JournalEntry.findById(id);
    if (!journal) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    
    // Update journal fields
    if (tanggal !== undefined) journal.tanggal = tanggal;
    if (deskripsi !== undefined) journal.deskripsi = deskripsi;
    if (akunDebet !== undefined) journal.akunDebet = akunDebet;
    if (akunKredit !== undefined) journal.akunKredit = akunKredit;
    if (nominal !== undefined) journal.nominal = nominal;
    if (needsReview !== undefined) journal.needsReview = needsReview;
    
    await journal.save();
    
    res.json({
      success: true,
      journalEntry: journal
    });
  } catch (error) {
    console.error('Error updating journal entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE: Hapus journal entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await JournalEntry.deleteOne({ _id: id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    
    res.json({
      success: true,
      message: 'Journal entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting journal entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Update status review jurnal
router.post('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;
    
    const journal = await JournalEntry.findById(id);
    if (!journal) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    
    // Update journal's review status
    journal.needsReview = false;
    await journal.save();
    
    res.json({ success: true, journalId: id, status: approved ? 'approved' : 'rejected' });
  } catch (error) {
    console.error('Error updating journal review status:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Update akun debet dan kredit
router.post('/:id/accounts', async (req, res) => {
  try {
    const { id } = req.params;
    const { akunDebet, akunKredit } = req.body;
    
    if (!akunDebet || !akunKredit) {
      return res.status(400).json({ 
        error: 'Both debit and credit accounts are required' 
      });
    }
    
    const journal = await JournalEntry.findById(id);
    if (!journal) {
      return res.status(404).json({ error: 'Journal entry not found' });
    }
    
    // Update accounts
    journal.akunDebet = akunDebet;
    journal.akunKredit = akunKredit;
    await journal.save();
    
    res.json({ 
      success: true, 
      journalId: id, 
      akunDebet, 
      akunKredit,
      message: 'Journal accounts updated successfully'
    });
  } catch (error) {
    console.error('Error updating journal accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tambahkan endpoint untuk accounts yang tersedia
router.get('/available-accounts', async (req, res) => {
  try {
    // Kumpulkan semua akun unik dari database
    const debitAccounts = await JournalEntry.distinct('akunDebet');
    const creditAccounts = await JournalEntry.distinct('akunKredit');
    
    // Gabungkan dan hilangkan duplikat
    const allAccounts = [...new Set([...debitAccounts, ...creditAccounts])];
    
    // Filter out 'Beban Lain' dan 'Pendapatan Lain'
    const filteredAccounts = allAccounts.filter(name => 
      name !== 'Beban Lain' && name !== 'Pendapatan Lain'
    );
    
    // Tambahkan predefined accounts jika belum ada
    const predefinedAccounts = [
      'Bank', 'Kas', 
      'Advertising Expense', 'Distribution Expense', 'Labour Expense', 
      'Materials Expense', 'Overhead Expense', 'Owner Withdrawal', 'Other Expense',
      'Supplies Expense', 'Utilities Expense', 'Rent Expense', 'Insurance Expense',
      'Repair & Maintenance Expense',
      'Dana Masuk', 'Other Income', 'Sales Income', 'Service Income', 'Commission Income',
      'Accounts Payable', 'Short-term Loans',
      'Owner Equity', 'Retained Earnings'
    ];
    
    predefinedAccounts.forEach(account => {
      if (!filteredAccounts.includes(account)) {
        filteredAccounts.push(account);
      }
    });
    
    // Kategorikan accounts
    const categorizedAccounts = filteredAccounts.map(name => {
      let category = 'Lainnya';
      
      if (name === 'Bank' || name === 'Kas') {
        category = 'Aset';
      } else if (name.includes('Expense') || name.includes('Beban') || name === 'Owner Withdrawal') {
        category = 'Beban';
      } else if (name.includes('Income') || name.includes('Dana Masuk') || name.includes('Pendapatan')) {
        category = 'Pendapatan';
      } else if (name.includes('Payable') || name.includes('Loans') || name.includes('Hutang')) {
        category = 'Kewajiban';
      } else if (name.includes('Equity') || name.includes('Earnings') || name.includes('Modal')) {
        category = 'Modal';
      }
      
      return {
        id: name.toLowerCase().replace(/\s+/g, ''),
        name,
        category
      };
    });
    
    // Urutkan berdasarkan kategori dan nama
    categorizedAccounts.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });
    
    res.json(categorizedAccounts);
  } catch (error) {
    console.error('Error fetching available accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Upgrade akun lama - mengganti 'Beban Lain' dengan 'Other Expense' dan 'Pendapatan Lain' dengan 'Dana Masuk'
router.post('/upgrade-accounts', async (req, res) => {
  try {
    // 1. Update semua jurnal dengan akun debet 'Beban Lain'
    const updateDebetResult = await JournalEntry.updateMany(
      { akunDebet: 'Beban Lain' }, 
      { $set: { akunDebet: 'Other Expense' } }
    );
    
    // 2. Update semua jurnal dengan akun kredit 'Pendapatan Lain'
    const updateCreditResult = await JournalEntry.updateMany(
      { akunKredit: 'Pendapatan Lain' }, 
      { $set: { akunKredit: 'Dana Masuk' } }
    );
    
    res.json({
      success: true,
      message: 'Account upgrade completed successfully',
      results: {
        debet: `Updated ${updateDebetResult.modifiedCount} entries from 'Beban Lain' to 'Other Expense'`,
        kredit: `Updated ${updateCreditResult.modifiedCount} entries from 'Pendapatan Lain' to 'Dana Masuk'`
      }
    });
  } catch (error) {
    console.error('Error upgrading accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 