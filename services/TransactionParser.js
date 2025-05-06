const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { detectTransactionType } = require('./TransactionTypeDetector');

const LABEL_MAP = {
  'nama penerima': 'partner',
  'rekening tujuan': 'rekening',
  'jumlah': 'nominal',
  'catatan': 'note',
  'pengirim': 'partner',
  'rekening pengirim': 'rekening',
  'info pengirim': 'partner',
  'nomor rekening': 'rekening',
  'dari': 'partner',
  'dari bank': 'partner',
  'sumber': 'partner',
  'ke bank': 'partner',
  'ke rekening': 'rekening',
  'nominal': 'nominal',
  'notes': 'note',
  'keterangan': 'note',
  'deskripsi': 'note',
  'dikirim ke': 'partner',
  'total': 'nominal',
  'no. referensi': 'referenceNumber',
  'nomor referensi': 'referenceNumber',
  'reference number': 'referenceNumber',
  'id transaksi': 'referenceNumber',
  'id transaksi\\tid': 'referenceNumber',
  'transaksi id': 'referenceNumber',
  'transfer dari': 'partner',
  'nama merchant': 'partner',
  'username': 'username',
  'no. virtual account': 'rekening',
  'biaya': 'fee',
  'waktu transaksi': 'tanggal',
  'jenis transaksi': 'jenis',
  // Tambahkan mapping lain jika perlu
};

function normalizeLabel(label) {
  return label.toLowerCase().trim();
}

function mapLabel(label) {
  return LABEL_MAP[normalizeLabel(label)] || normalizeLabel(label);
}

function extractTextContent(element, dom) {
  if (!element) return '';
  // Normalize whitespace and remove multiple spaces
  return element.textContent.replace(/\s+/g, ' ').trim();
}

// Helper function to sanitize currency values
function sanitizeCurrencyValue(value) {
  if (!value) return 0;
  
  // Handle if already a number
  if (typeof value === 'number') return value;
  
  // Convert to string and handle cases like "Rp0" or "Rp 1.000.000"
  const stringValue = String(value);
  
  // Remove currency symbols, dots, commas, and any non-digit characters
  const numericValue = stringValue.replace(/[^\d]/g, '');
  
  // Convert to number (returns 0 if empty string)
  return numericValue ? Number(numericValue) : 0;
}

// Helper function to parse Indonesian date formats
function parseIndonesianDate(dateStr) {
  if (!dateStr) return null;
  
  // Handle formats like "05 Mei 2025 12:48"
  const indonesianMonths = {
    'januari': 0, 'jan': 0,
    'februari': 1, 'feb': 1,
    'maret': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'mei': 4, 'may': 4,
    'juni': 5, 'jun': 5,
    'juli': 6, 'jul': 6,
    'agustus': 7, 'ags': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'oktober': 9, 'okt': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'desember': 11, 'des': 11, 'dec': 11
  };
  
  try {
    // Format: DD Bulan YYYY HH:MM
    const match = dateStr.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/i);
    if (match) {
      const day = parseInt(match[1], 10);
      const monthName = match[2].toLowerCase();
      const year = parseInt(match[3], 10);
      const hour = match[4] ? parseInt(match[4], 10) : 0;
      const minute = match[5] ? parseInt(match[5], 10) : 0;
      
      const monthIndex = indonesianMonths[monthName];
      
      if (!isNaN(day) && monthIndex !== undefined && !isNaN(year)) {
        const date = new Date(year, monthIndex, day, hour, minute);
        return date.toISOString();
      }
    }
    
    // Try a more general approach for other formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (e) {
    console.error('Error parsing date:', e);
  }
  
  return null;
}

function parseTransaction(html, subject = '', body = '', snippet = '') {
  if (!html || html.trim() === '') {
    return createDefaultTransaction(subject, body, snippet);
  }

  try {
    const dom = new JSDOM(html);
    const result = {};

    // Coba parsing dengan cara #1 - table rows dengan label-value
    const trs = dom.window.document.querySelectorAll('tr');
    let foundData = false;

    trs.forEach(tr => {
      const tds = tr.querySelectorAll('td');
      if (tds.length >= 2) {
        const label = extractTextContent(tds[0], dom);
        const value = extractTextContent(tds[1], dom);
        
        if (label && value) {
          const mappedKey = mapLabel(label);
          result[mappedKey] = value.trim();
          foundData = true;
        }
      }
    });

    // Cara #2 - coba cari data dengan format lain jika belum ketemu
    if (!foundData || !result.partner) {
      // Coba cari elemen dengan format "label: value"
      const allElements = dom.window.document.querySelectorAll('*');
      allElements.forEach(el => {
        const content = extractTextContent(el, dom);
        if (content.includes(':')) {
          const parts = content.split(':');
          if (parts.length >= 2) {
            const label = parts[0].trim();
            const value = parts.slice(1).join(':').trim();
            
            if (label && value) {
              const mappedKey = mapLabel(label);
              if (LABEL_MAP[normalizeLabel(label)]) {
                result[mappedKey] = value;
                foundData = true;
              }
            }
          }
        }
      });
    }

    // Jika masih tidak ada partner, coba ekstrak dari snippet dan body
    if (!result.partner) {
      // Coba cari pola "dari [NAMA]" atau "ke [NAMA]" di snippet
      const nameMatch = (snippet + ' ' + body).match(/(?:dari|ke|oleh|kepada)\s+([A-Z\s']+)/i);
      if (nameMatch && nameMatch[1]) {
        result.partner = nameMatch[1].trim();
      }
    }

    // Fallback: jika partner kosong, gunakan rekening atau set dari subject
    if (!result.partner && result.rekening) {
      result.partner = result.rekening;
    } else if (!result.partner) {
      result.partner = extractBankInfo(subject + ' ' + snippet);
    }

    // Normalize all numeric values
    if (result.nominal) {
      result.nominal = sanitizeCurrencyValue(result.nominal);
    }
    
    if (result.fee) {
      result.fee = sanitizeCurrencyValue(result.fee);
    }
    
    // Extract reference number if not found in structured data
    if (!result.referenceNumber) {
      result.referenceNumber = extractReferenceNumber(html, body, snippet);
    }

    // First detect transaction type
    const transactionType = detectTransactionType(subject, body, snippet);
    
    // Always standardize the transaction type to one of our standard formats
    // NEVER allow raw transaction types from email to be used directly
    if (transactionType !== 'unknown') {
      // Use the detected type, which is standardized
      result.jenis = transactionType;
    } else if (result.jenis) {
      // If we have a raw type from parsing, map it to standard format
      const rawType = result.jenis.toLowerCase();
      if (rawType.includes('virtual account') || 
          rawType.includes('pembayaran') || 
          rawType.includes('payout') ||
          rawType.includes('debit') ||
          rawType.includes('keluar')) {
        result.jenis = 'transfer_keluar';
      } else if (rawType.includes('masuk') || 
                rawType.includes('incoming') || 
                rawType.includes('credit') || 
                rawType.includes('deposit')) {
        result.jenis = 'transfer_masuk';
      } else {
        // If we can't determine from raw type, use content inference
        result.jenis = inferTypeFromContent(subject, snippet);
      }
    } else {
      // If no jenis at all, infer from content
      result.jenis = inferTypeFromContent(subject, snippet);
    }

    // Ensure jenis is a standard type
    if (!result.jenis ||
        (result.jenis !== 'transfer_masuk' && 
         result.jenis !== 'transfer_keluar' &&
         result.jenis !== 'pembayaran_masuk' &&
         result.jenis !== 'pembayaran_keluar' &&
         result.jenis !== 'topup')) {
      console.warn(`Non-standard transaction type detected: ${result.jenis}. Mapping to standard type.`);
      // Force mapping to standard type
      result.jenis = inferTypeFromContent(subject, snippet);
      
      // If still not standard, set a default based on context
      if (result.jenis === 'unknown') {
        // Look for clues in all available text
        const combinedText = (html + ' ' + subject + ' ' + body + ' ' + snippet).toLowerCase();
        result.jenis = combinedText.includes('shopee') || 
                       combinedText.includes('virtual account') ||
                       combinedText.includes('payment') ? 
                       'transfer_keluar' : 'transfer_masuk';
      }
    }
    
    // Parse tanggal jika ada
    if (result.tanggal && typeof result.tanggal === 'string') {
      const parsedDate = parseIndonesianDate(result.tanggal);
      if (parsedDate) {
        result.tanggal = parsedDate;
      }
    }

    // Default tanggal to now if not set
    result.tanggal = result.tanggal || new Date().toISOString();

    // Jika note kosong, coba ambil dari subject atau snippet
    if (!result.note || result.note.trim() === '') {
      result.note = extractNoteFromContent(subject, snippet);
    }

    // Output standar
    return {
      tanggal: result.tanggal,
      jenis: result.jenis,
      nominal: result.nominal || 0,
      partner: result.partner || '',
      rekening: result.rekening || result.partner || '',
      note: result.note || '',
      referenceNumber: result.referenceNumber || '',
      username: result.username || '',
      fee: sanitizeCurrencyValue(result.fee)
    };
  } catch (error) {
    console.error('Error parsing transaction HTML:', error);
    return createDefaultTransaction(subject, body, snippet);
  }
}

// Helper untuk membuat transaksi default jika parsing gagal
function createDefaultTransaction(subject, body, snippet) {
  const jenis = inferTypeFromContent(subject, snippet);
  return {
    tanggal: new Date().toISOString(),
    jenis,
    nominal: extractAmountFromText(subject + ' ' + snippet) || 0,
    partner: extractBankInfo(subject + ' ' + snippet),
    rekening: '',
    note: extractNoteFromContent(subject, snippet),
    referenceNumber: extractReferenceNumber('', body, snippet),
    username: '',
    fee: 0
  };
}

// Helper untuk menebak tipe transaksi dari konten
function inferTypeFromContent(subject, snippet) {
  const text = (subject + ' ' + snippet).toLowerCase();
  
  // Pattern SeaBank Incoming
  if (text.includes('kamu menerima transfer') || 
      text.includes('kamu menerima') || 
      text.includes('transfer masuk')) {
    return 'transfer_masuk';
  }
  
  // Pattern SeaBank Outgoing
  if (text.includes('permintaan transfer kamu telah berhasil') || 
      text.includes('transfer kamu telah berhasil') || 
      text.includes('transfer berhasil diproses')) {
    return 'transfer_keluar';
  }
  
  // General patterns
  if (text.includes('masuk') || text.includes('menerima') || text.includes('terima')) {
    return 'transfer_masuk';
  }
  
  if (text.includes('keluar') || text.includes('kirim') || text.includes('transfer berhasil')) {
    return 'transfer_keluar';
  }
  
  return 'unknown';
}

// Helper untuk extract bank info dari text
function extractBankInfo(text) {
  const bankMatch = text.match(/(BCA|BNI|BRI|Mandiri|SeaBank|DANA|OVO|GOPAY|ShopeePay)/i);
  return bankMatch ? bankMatch[0] : '';
}

// Helper untuk extract note dari subject/snippet
function extractNoteFromContent(subject, snippet) {
  // Check if subject has specific transaction info
  if (subject.includes('Transfer') || 
      subject.includes('Pembayaran') || 
      subject.includes('Transaksi')) {
    return subject;
  }
  
  // Avoid using generic notification texts as notes
  if (snippet.includes('Notifikasi') && snippet.length < 30) {
    return ''; // Return empty if it's just a notification
  }
  
  // Extract meaningful information from the snippet
  const cleanSnippet = snippet
    .replace(/Notifikasi (Transfer|Pembayaran) [A-Za-z]+/g, '')
    .replace(/Hai [^,]+,/g, '')
    .trim();
    
  if (cleanSnippet.length > 10) {
    return cleanSnippet.substring(0, 100);
  }
  
  return ''; // Return empty if no meaningful note found
}

// Helper untuk extract nominal dari text
function extractAmountFromText(text) {
  const amountMatch = text.match(/Rp\s*(\d{1,3}(?:[.,]\d{3})*)/i);
  if (amountMatch && amountMatch[1]) {
    return sanitizeCurrencyValue(`Rp${amountMatch[1]}`);
  }
  return 0;
}

// New helper function to extract reference number
function extractReferenceNumber(html, body, snippet) {
  // Combined text to search for reference numbers
  const combinedText = html + ' ' + body + ' ' + snippet;
  
  // Patterns for reference numbers
  const patterns = [
    /(?:no\.|nomor)\s*referensi\s*[:#]?\s*(\d{14,})/i,
    /(?:reference|ref)\s*(?:number|no|#)\s*[:#]?\s*(\d{14,})/i,
    /(?:id transaksi|transaction id)\s*[:#]?\s*(\d{14,})/i,
    /(\d{14,})/  // Fallback: Any long number (at least 14 digits) might be a reference
  ];
  
  for (const pattern of patterns) {
    const match = combinedText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return '';
}

module.exports = { parseTransaction, sanitizeCurrencyValue }; 