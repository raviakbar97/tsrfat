const { google } = require('googleapis');
const OAuthService = require('./OAuthService');

class GmailWatchService {
  constructor() {
    this.gmail = google.gmail({ version: 'v1', auth: OAuthService.getClient() });
  }

  async watch(labelId, topicName) {
    if (!topicName || !topicName.startsWith('projects/')) {
      throw new Error('Topic name must be fully qualified, e.g., projects/your-project/topics/your-topic');
    }

    console.log(`Setting up watch for Gmail label: ${labelId}`);
    console.log(`Using topic: ${topicName}`);
    
    const res = await this.gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: [labelId],
        topicName,
      },
    });
    return res.data;
  }

  async stop() {
    console.log('Stopping Gmail watch');
    const res = await this.gmail.users.stop({
      userId: 'me',
    });
    return res.data;
  }
}

module.exports = new GmailWatchService(); 