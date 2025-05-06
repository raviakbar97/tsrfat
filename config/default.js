module.exports = {
  db: {
    mongoURI: process.env.MONGO_URI || 'mongodb+srv://<username>:<password>@cluster.mongodb.net/your-db?retryWrites=true&w=majority',
  },
  gmail: {
    clientID: process.env.GMAIL_CLIENT_ID || '<your-gmail-client-id>',
    clientSecret: process.env.GMAIL_CLIENT_SECRET || '<your-gmail-client-secret>',
    redirectURI: process.env.GMAIL_REDIRECT_URI || '<your-gmail-redirect-uri>',
    refreshToken: process.env.GMAIL_REFRESH_TOKEN || '<your-gmail-refresh-token>',
  },
  journalMap: {
    // Example: 'transfer': 'Kas – Bank'
  },
}; 