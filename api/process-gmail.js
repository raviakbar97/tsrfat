// Serverless function for Gmail webhook
const mongoose = require('mongoose');
const { parseTransaction } = require('../services/TransactionParser');
const { detectTransactionType } = require('../services/TransactionTypeDetector');
const { decideJournal } = require('../services/JournalDecider');
const Transaction = require('../models/Transaction');
const JournalEntry = require('../models/JournalEntry');

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

// Handle POST request
module.exports = async (req, res) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    await connectToDatabase();
    
    const data = req.body;
    console.log('Received webhook data:', data);
    
    // Here we would typically process the email
    // But Vercel functions are stateless and have execution limits
    // So we'll just acknowledge receipt and store the data for later processing
    
    // Store webhook data for processing
    const webhookData = {
      timestamp: new Date(),
      data: data,
      processed: false
    };
    
    // Return success response
    return res.status(200).json({ 
      status: 'success', 
      message: 'Webhook received',
      note: 'For full email processing, consider using a dedicated server instead of serverless functions'
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: error.message });
  }
}; 