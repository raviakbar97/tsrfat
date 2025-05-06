const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../config/default');

// Read credentials.json
const credentialsPath = path.join(__dirname, '../credentials.json');
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8')).web;

class OAuthService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uris[0]
    );
    if (config.gmail.refreshToken && config.gmail.refreshToken !== '<your-gmail-refresh-token>') {
      this.oauth2Client.setCredentials({ refresh_token: config.gmail.refreshToken });
    }
  }

  generateAuthUrl() {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.labels',
      ],
      prompt: 'consent',
    });
  }

  async getToken(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    // Simpan refresh_token ke config atau database sesuai kebutuhan
    return tokens;
  }

  setCredentials(tokens) {
    this.oauth2Client.setCredentials(tokens);
  }

  getClient() {
    return this.oauth2Client;
  }
}

module.exports = new OAuthService(); 