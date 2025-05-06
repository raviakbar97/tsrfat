require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const transactionsRoute = require('../routes/transactions');
const gmailWebhookRoute = require('../routes/gmail-webhook');
const journalEntriesRoute = require('../routes/journal-entries');
const cors = require('cors');


const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use('/transactions', transactionsRoute);
app.use('/gmail', gmailWebhookRoute);
app.use('/journal-entries', journalEntriesRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 