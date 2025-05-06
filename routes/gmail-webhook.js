const express = require('express');
const router = express.Router();
const GmailWebhookController = require('../controllers/GmailWebhookController');

// Endpoint untuk Gmail webhook (pubsub push notification)
router.post('/webhook', GmailWebhookController.handleWebhook.bind(GmailWebhookController));

// Endpoint untuk testing manual pipeline (tanpa webhook)
router.get('/process-manual', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 10; // Default to 10 emails for safety
    console.log(`Starting manual processing with limit: ${limit} emails`);
    
    const result = await GmailWebhookController.processManual(limit);
    
    res.json({ 
      status: 'success', 
      message: 'Email processing completed',
      result
    });
  } catch (error) {
    console.error('Error in manual processing route:', error);
    // Return more detailed error information for debugging
    res.status(500).json({
      status: 'error',
      message: 'Processing failed',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router; 