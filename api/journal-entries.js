// Serverless function for journal entries API
const mongoose = require('mongoose');
const JournalEntry = require('../models/JournalEntry');
const Transaction = require('../models/Transaction');

// Connect to MongoDB
let isConnected = false;
const connectToDatabase = async () => {
  if (isConnected) return;
  
  try {
    const db = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = !!db.connections[0].readyState;
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Error connecting to database:', error);
    throw error;
  }
};

module.exports = async (req, res) => {
  try {
    await connectToDatabase();
    
    // GET request to fetch journal entries
    if (req.method === 'GET') {
      const entries = await JournalEntry.find({}).populate('transactionId');
      return res.status(200).json(entries);
    }
    
    // POST request to create a new journal entry
    if (req.method === 'POST') {
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
      
      return res.status(201).json({
        success: true,
        journalEntry
      });
    }
    
    // PUT request to update a journal entry
    if (req.method === 'PUT') {
      const { id } = req.query;
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
      
      return res.status(200).json({
        success: true,
        journalEntry: journal
      });
    }
    
    // DELETE request to delete a journal entry
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      const result = await JournalEntry.deleteOne({ _id: id });
      
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Journal entry not found' });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Journal entry deleted successfully'
      });
    }
    
    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error handling journal entries:', error);
    return res.status(500).json({ error: error.message });
  }
}; 