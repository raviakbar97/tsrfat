function detectTransactionType(subject, body, snippet = '') {
  // Gabungkan semua text untuk analisis
  const fullText = (subject + ' ' + body + ' ' + snippet).toLowerCase();
  
  // Special handling for known transaction types
  if (fullText.includes('jenis transaksi') && fullText.includes('transfer virtual account')) {
    // Virtual Account transfers are typically outgoing (you paying someone)
    return 'transfer_keluar';
  }
  
  // Handle specific merchants 
  if (fullText.includes('shopee') || 
      fullText.includes('tokopedia') || 
      fullText.includes('lazada') || 
      fullText.includes('bukalapak')) {
    // E-commerce transactions are typically outgoing payments
    return 'transfer_keluar';
  }
  
  // Transfer masuk - pattern dari contoh email SeaBank
  if (fullText.includes('kamu menerima transfer masuk') || 
      fullText.includes('menerima transfer') || 
      fullText.includes('kamu menerima') ||
      fullText.includes('transfer masuk') ||
      fullText.includes('dana masuk')) {
    return 'transfer_masuk';
  }
  
  // Transfer keluar - pattern dari contoh email SeaBank
  if (fullText.includes('permintaan transfer kamu telah berhasil diproses') ||
      fullText.includes('transfer kamu telah berhasil') || 
      fullText.includes('transfer keluar') || 
      fullText.includes('kamu mentransfer') ||
      fullText.includes('virtual account')) {
    return 'transfer_keluar';
  }
  
  // Pembayaran
  if (fullText.includes('pembayaran')) {
    // Jika mengandung "masuk", berarti menerima pembayaran
    if (fullText.includes('masuk')) {
      return 'pembayaran_masuk';
    }
    return 'pembayaran_keluar';
  }
  
  // Top up
  if (fullText.includes('top up')) {
    return 'topup';
  }
  
  // Default - cek dulu indikasi "masuk" vs "keluar"
  if (fullText.includes('masuk') || fullText.includes('menerima') || fullText.includes('terima')) {
    return 'transfer_masuk';
  }
  
  if (fullText.includes('keluar') || 
      fullText.includes('kirim') || 
      fullText.includes('permintaan transfer') || 
      fullText.includes('virtual account') ||
      fullText.includes('va')) {
    return 'transfer_keluar';
  }
  
  // Jika tidak ada pola yang cocok
  return 'unknown';
}

module.exports = { detectTransactionType }; 