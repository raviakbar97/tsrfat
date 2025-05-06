const fs = require('fs');
const path = require('path');

// Load journalMap.json
const journalMap = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/journalMap.json'), 'utf8'));

function decideJournal(description) {
  const desc = description.toLowerCase();
  const matches = journalMap.filter(m => {
    if (Array.isArray(m.keyword)) {
      return m.keyword.some(k => desc.includes(k.toLowerCase()));
    } else {
      return desc.includes(m.keyword.toLowerCase());
    }
  });

  if (matches.length === 1) {
    return { journal: matches[0].journal, needsReview: false };
  } else if (matches.length > 1) {
    // Ambiguous, lebih dari satu match
    return { journal: matches.map(m => m.journal), needsReview: true };
  } else {
    // Tidak ada match
    return { journal: null, needsReview: true };
  }
}

module.exports = { decideJournal }; 