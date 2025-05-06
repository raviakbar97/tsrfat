const { google } = require('googleapis');
const OAuthService = require('./OAuthService');

const SEABANK_LABEL_ID = 'Label_1640133888286938117';

class EmailFetcher {
  constructor() {
    this.gmail = google.gmail({ version: 'v1', auth: OAuthService.getClient() });
  }

  async fetchMessageIds(label = SEABANK_LABEL_ID, maxResults = 1000) {
    let allMessages = [];
    let pageToken = null;
    
    do {
      const res = await this.gmail.users.messages.list({
        userId: 'me',
        labelIds: [label],
        maxResults: 100, // Fetch in batches of 100 (Gmail API limit)
        pageToken: pageToken
      });
      
      if (res.data.messages && res.data.messages.length > 0) {
        allMessages = allMessages.concat(res.data.messages);
      }
      
      pageToken = res.data.nextPageToken;
      
      // If we've reached the desired number of messages or there are no more pages, exit
      if (allMessages.length >= maxResults || !pageToken) {
        break;
      }
    } while (pageToken);
    
    // Limit to maxResults if specified
    if (allMessages.length > maxResults) {
      allMessages = allMessages.slice(0, maxResults);
    }
    
    return allMessages.length > 0 ? allMessages.map(msg => msg.id) : [];
  }

  async fetchMessageById(messageId) {
    const res = await this.gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    return res.data;
  }

  decodeBody(message) {
    if (!message.payload) return { html: '', subject: '', plainText: '' };
    
    // Extract subject from headers
    const headers = message.payload.headers || [];
    const subjectHeader = headers.find(h => h.name === 'Subject');
    const subject = subjectHeader ? subjectHeader.value : '';
    
    // First try to get plain text content
    let plainText = '';
    let html = '';
    
    // Process parts recursively to find HTML and plain text parts
    const findContentParts = (part) => {
      if (!part) return;
      
      if (part.body && part.body.data) {
        const mimeType = part.mimeType || '';
        if (mimeType === 'text/html') {
          html = Buffer.from(part.body.data, 'base64').toString('utf8');
        } else if (mimeType === 'text/plain') {
          plainText = Buffer.from(part.body.data, 'base64').toString('utf8');
        }
      }
      
      // Process child parts if available
      if (part.parts && part.parts.length) {
        part.parts.forEach(findContentParts);
      }
    };
    
    // Start with the main payload
    findContentParts(message.payload);
    
    // If no HTML content found in parts, try main body
    if (!html && message.payload.body && message.payload.body.data) {
      html = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
    }
    
    return { html, subject, plainText };
  }
}

module.exports = new EmailFetcher(); 