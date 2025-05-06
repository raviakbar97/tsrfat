const EmailFetcher = require('../services/EmailFetcher');
const { parseTransaction } = require('../services/TransactionParser');
const { detectTransactionType } = require('../services/TransactionTypeDetector');
const { decideJournal } = require('../services/JournalDecider');
const Transaction = require('../models/Transaction');
const JournalEntry = require('../models/JournalEntry');

// Add new import for inferTypeFromContent
const TransactionParser = require('../services/TransactionParser');
const inferTypeFromContent = (subject, snippet) => {
  // Re-implement inferTypeFromContent to avoid circular dependency
  const text = (subject + ' ' + snippet).toLowerCase();
  
  // Pattern for incoming transfers
  if (text.includes('kamu menerima transfer') || 
      text.includes('kamu menerima') || 
      text.includes('transfer masuk')) {
    return 'transfer_masuk';
  }
  
  // Pattern for outgoing transfers
  if (text.includes('permintaan transfer kamu telah berhasil') || 
      text.includes('transfer kamu telah berhasil') || 
      text.includes('transfer berhasil diproses') ||
      text.includes('virtual account')) {
    return 'transfer_keluar';
  }
  
  // General patterns
  if (text.includes('masuk') || text.includes('menerima') || text.includes('terima')) {
    return 'transfer_masuk';
  }
  
  if (text.includes('keluar') || text.includes('kirim') || text.includes('transfer berhasil')) {
    return 'transfer_keluar';
  }
  
  // E-commerce specific patterns
  if (text.includes('shopee') || text.includes('tokopedia') || text.includes('lazada')) {
    return 'transfer_keluar';
  }
  
  return 'unknown';
};

// Mengimpor konstanta dari EmailFetcher
const SEABANK_LABEL_ID = 'Label_1640133888286938117';

class GmailWebhookController {
  // Webhook handler untuk notifikasi Gmail
  async handleWebhook(req, res) {
    try {
      // Validasi webhook jika perlu
      console.log('Received Gmail webhook');
      
      // Mulai proses pipeline: fetch-parse-save
      this.processPipeline();
      
      // Return 200 OK segera untuk webhook
      return res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error('Error handling webhook:', error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  // Pipeline utama: fetch → decode → parse → decide → save
  async processPipeline() {
    try {
      console.log('Starting email processing pipeline');
      
      // 1. Fetch email terbaru dengan label seabank
      const messageIds = await EmailFetcher.fetchMessageIds();
      console.log(`Found ${messageIds.length} emails with seabank label`);
      
      // Ambil semua messageId yang sudah ada di database
      const existing = await Transaction.find({}).select('raw.id');
      const existingIds = new Set(existing.map(t => t.raw && t.raw.id));
      console.log(`Found ${existingIds.size} existing emails in database`);
      
      // Filter hanya messageId yang belum pernah diproses
      const newMessageIds = messageIds.filter(id => !existingIds.has(id));
      console.log(`Processing ${newMessageIds.length} new emails`);
      
      if (!newMessageIds.length) {
        console.log('No new emails to process');
        return;
      }
      
      // Loop semua email dan proses
      let processedCount = 0;
      for (const messageId of newMessageIds) {
        // Proses satu email
        await this.processEmail(messageId);
        processedCount++;
        
        if (processedCount % 10 === 0) {
          console.log(`Progress: Processed ${processedCount}/${newMessageIds.length} emails`);
        }
      }
      
      console.log(`Pipeline completed successfully. Processed ${processedCount} emails total.`);
    } catch (error) {
      console.error('Error in pipeline:', error);
    }
  }
  
  // Standardize transaction type to ensure it's always one of our defined types
  standardizeTransactionType(transaction, subject, body, snippet) {
    // List of valid standard transaction types
    const validTypes = [
      'transfer_masuk', 
      'transfer_keluar', 
      'pembayaran_masuk', 
      'pembayaran_keluar', 
      'topup'
    ];
    
    // Check if current type is already valid
    if (transaction.jenis && validTypes.includes(transaction.jenis)) {
      return transaction.jenis;
    }
    
    // Force re-detection using our detector
    let detectedType = detectTransactionType(subject, body, snippet);
    
    // If still unknown, try to infer based on content
    if (detectedType === 'unknown') {
      detectedType = inferTypeFromContent(subject, snippet);
    }
    
    // If still unknown, use heuristics
    if (detectedType === 'unknown') {
      const fullText = (subject + ' ' + body + ' ' + snippet + ' ' + 
                        (transaction.partner || '')).toLowerCase();
      
      // E-commerce or virtual account = likely outgoing payment
      if (fullText.includes('shopee') || 
          fullText.includes('tokopedia') || 
          fullText.includes('lazada') ||
          fullText.includes('virtual account') ||
          fullText.includes('va ')) {
        detectedType = 'transfer_keluar';
      } else {
        // Default to transfer_masuk if absolutely nothing else fits
        detectedType = 'transfer_keluar'; // Default to keluar since most are payments
      }
    }
    
    console.log(`Standardized transaction type from "${transaction.jenis}" to "${detectedType}"`);
    return detectedType;
  }

  // Proses satu email dengan better error handling
  async processEmail(messageId) {
    try {
      console.log(`Processing email: ${messageId}`);
      
      // 1. Fetch detail email
      const message = await EmailFetcher.fetchMessageById(messageId);
      
      // 2. Decode body email ke HTML
      const { html, subject, plainText } = EmailFetcher.decodeBody(message);
      
      // Ambil snippet untuk analisis tambahan
      const snippet = message.snippet || '';
      console.log(`Email Subject: "${subject}"`);
      console.log(`Email Snippet: "${snippet}"`);
      
      // 3. Parse HTML ke object transaksi (sekarang dengan snippet)
      const transaction = parseTransaction(html, subject, plainText, snippet);
      console.log(`Parsed transaction: ${JSON.stringify(transaction, null, 2)}`);
      
      // Always standardize the transaction type, regardless of what the parser returned
      transaction.jenis = this.standardizeTransactionType(transaction, subject, plainText, snippet);
      console.log(`Final standardized transaction type: ${transaction.jenis}`);
      
      // Note the raw transaction type for reference if needed
      transaction.rawTransactionType = transaction.rawTransactionType || transaction.jenis;
      
      // Sanitize transaction object - ensure all numeric fields are numbers
      if (typeof transaction.nominal !== 'number') {
        transaction.nominal = 0;
        console.warn('Nominal was not a number, defaulting to 0');
      }
      
      if (typeof transaction.fee !== 'number') {
        transaction.fee = 0;
        console.warn('Fee was not a number, defaulting to 0');
      }
      
      // 4. Deteksi jurnal berdasarkan deskripsi/note/rekening
      const descriptionForMapping = [
        transaction.note,
        subject,
        snippet.substring(0, 100),
        transaction.rekening
      ].filter(Boolean).join(' ');
      console.log(`Using description for journal mapping: "${descriptionForMapping}"`);
      const journalResult = decideJournal(descriptionForMapping);
      console.log(`Journal decision: ${JSON.stringify(journalResult, null, 2)}`);
      
      // 5. Simpan transaksi ke database
      const savedTransaction = await Transaction.create({
        ...transaction,
        raw: message,
      });
      console.log(`Saved transaction: ${savedTransaction._id}`);
      
      // 6. Buat entry jurnal sesuai jenis transaksi
      const journalEntry = await this.createJournalEntry(transaction, savedTransaction._id, journalResult, subject);
      console.log(`Created journal entry: ${journalEntry._id}`);
      
      return savedTransaction;
    } catch (error) {
      console.error(`Error processing email ${messageId}:`, error);
      throw error;
    }
  }
  
  // Method untuk membuat journal entry berdasarkan jenis transaksi
  async createJournalEntry(transaction, transactionId, journalResult, subject) {
    try {
      // Setup akun sesuai jenis transaksi (masuk/keluar)
      const isIncoming = transaction.jenis.includes('_masuk');
      let akunDebet, akunKredit;
      
      if (isIncoming) {
        // Transaksi masuk: Debet Bank, Kredit Income/Revenue
        akunDebet = 'Bank';
        akunKredit = journalResult.journal && !journalResult.needsReview ? 
          journalResult.journal : 'Dana Masuk';
      } else {
        // Transaksi keluar: Debet Expense, Kredit Bank
        akunDebet = journalResult.journal && !journalResult.needsReview ? 
          journalResult.journal : 'Other Expense';
        akunKredit = 'Bank';
      }
      
      // Jika array (ambiguous), ambil yang pertama
      if (Array.isArray(akunDebet)) akunDebet = akunDebet[0];
      if (Array.isArray(akunKredit)) akunKredit = akunKredit[0];
      
      // Buat deskripsi yang lebih informatif dengan informasi dari transaksi
      let deskripsi = transaction.deskripsi || subject || `Transaction ${transaction.jenis}`;
      
      // Add reference number to description if available
      if (transaction.referenceNumber) {
        deskripsi = `${deskripsi} [Ref: ${transaction.referenceNumber}]`;
      }
      
      // Tambahkan partner info jika ada
      if (transaction.partner && !deskripsi.includes(transaction.partner)) {
        deskripsi = `${deskripsi} - ${transaction.partner}`;
      }
      
      // Untuk field note, prioritaskan catatan transaksi yang bermakna
      let noteForJournal;
      
      // Prioritaskan note aktual dari catatan transaksi
      if (transaction.note && transaction.note.trim() !== '' && 
          !transaction.note.startsWith('Notifikasi') && 
          transaction.note.length > 5) {
        // Gunakan note asli jika ada dan bukan sekedar "Notifikasi"
        noteForJournal = transaction.note;
      } else if (journalResult.journal && !journalResult.needsReview) {
        // Jika tidak ada note tapi ada journal mapping yang jelas, gunakan nama jurnal
        noteForJournal = isIncoming ? akunKredit : akunDebet;
      } else if (transaction.partner) {
        // Jika tidak ada keduanya, gunakan info partner
        noteForJournal = `Transaksi dengan ${transaction.partner}`;
      } else {
        // Fallback ke tipe transaksi
        noteForJournal = isIncoming ? 'Dana Masuk' : 'Other Expense';
      }
      
      // Tambahkan username jika ada
      if (transaction.username && !noteForJournal.includes(transaction.username)) {
        noteForJournal = `${noteForJournal} (${transaction.username})`;
      }
      
      // Buat journal entry
      const entry = await JournalEntry.create({
        tanggal: transaction.tanggal,
        deskripsi: deskripsi,
        akunDebet,
        akunKredit,
        nominal: transaction.nominal,
        transactionId,
        needsReview: journalResult.needsReview,
        note: noteForJournal
      });
      
      console.log(`Created journal entry: ${akunDebet} - ${akunKredit}`);
      return entry;
    } catch (error) {
      console.error('Error creating journal entry:', error);
      throw error;
    }
  }
  
  // Method untuk panggil manual/testing
  async processManual(limit = 10) {
    try {
      console.log(`Starting manual processing with limit: ${limit} emails`);
      
      // 1. Fetch email terbaru dengan label seabank
      const messageIds = await EmailFetcher.fetchMessageIds(SEABANK_LABEL_ID, limit);
      console.log(`Found ${messageIds.length} emails with seabank label`);
      
      // Ambil semua messageId yang sudah ada di database
      const existing = await Transaction.find({}).select('raw.id');
      const existingIds = new Set(existing.map(t => t.raw && t.raw.id));
      console.log(`Found ${existingIds.size} existing emails in database`);
      
      // Filter hanya messageId yang belum pernah diproses
      const newMessageIds = messageIds.filter(id => !existingIds.has(id));
      console.log(`Processing ${newMessageIds.length} new emails`);
      
      if (!newMessageIds.length) {
        console.log('No new emails to process');
        return { processed: 0, total: 0, skipped: 0, success: true };
      }
      
      // Loop semua email dan proses
      let processedCount = 0;
      let failedCount = 0;
      let errors = [];
      
      for (const messageId of newMessageIds) {
        try {
          // Proses satu email
          await this.processEmail(messageId);
          processedCount++;
          
          if (processedCount % 10 === 0) {
            console.log(`Progress: Processed ${processedCount}/${newMessageIds.length} emails`);
          }
        } catch (err) {
          failedCount++;
          console.error(`Error processing email ${messageId}:`, err);
          errors.push({
            messageId,
            error: err.message
          });
        }
      }
      
      console.log(`Manual processing completed. Processed ${processedCount} emails, failed ${failedCount}`);
      return { 
        processed: processedCount, 
        failed: failedCount,
        total: newMessageIds.length, 
        errors: errors.length > 0 ? errors : undefined,
        success: true 
      };
    } catch (error) {
      console.error('Error in manual processing:', error);
      throw error;
    }
  }
}

module.exports = new GmailWebhookController(); 