# TSRFAT - Transaction Recognition and Financial Accounting Tool

Aplikasi otomatis untuk memproses email, mengenali transaksi, dan membuat entri jurnal keuangan.

## Fitur

- Integrasi Gmail API untuk monitoring email otomatis
- Pengenalan transaksi dari konten email
- Pembuatan jurnal otomatis berdasarkan jenis transaksi
- Sistem review manual untuk transaksi yang tidak terklasifikasi
- Antarmuka web responsif untuk mengelola transaksi dan entri jurnal

## Security Note

This application requires access to your Gmail account and uses OAuth for authentication. Please keep your credentials secure:

1. Never commit `.env` files, `credentials.json`, or any files containing API keys to your Git repository
2. Use environment variables for all sensitive information
3. Make sure `.gitignore` is properly configured to exclude sensitive files

## Setup Lokal

### Prasyarat

- Node.js (v14+)
- MongoDB
- Akun Gmail dengan akses API

### Instalasi

1. Clone repository
   ```
   git clone https://github.com/yourusername/tsrfat.git
   cd tsrfat
   ```

2. Install dependencies
   ```
   npm install
   cd client
   npm install
   cd ..
   ```

3. Setup environment variables
   ```
   cp .env.example .env
   ```
   Edit file `.env` dengan kredensial Anda

4. Setup OAuth credentials Google
   - Login ke [Google Cloud Console](https://console.cloud.google.com/)
   - Buat project baru
   - Aktifkan Gmail API
   - Buat kredensial OAuth
   - Download sebagai `credentials.json` dan simpan di root project

5. Dapatkan refresh token
   ```
   node get-auth-url.js
   ```
   Ikuti URL, authorize app, dapatkan kode dari redirect URL, kemudian:
   ```
   node get-refresh-token.js
   ```
   Tambahkan refresh token ke file `.env`

6. Jalankan aplikasi
   ```
   npm run dev
   ```

## Deployment ke Vercel

### 1. Fork / Clone Repository

Pastikan Anda memiliki akses ke repository GitHub.

### 2. Persiapan Project untuk Vercel

Struktur project sudah disesuaikan dengan kebutuhan Vercel dengan:
- API endpoints di folder `/api` (serverless functions)
- Frontend React di folder `/client`
- Konfigurasi routing di `vercel.json`

### 3. Setup Database

1. Buat cluster MongoDB Atlas (versi cloud MongoDB)
2. Dapatkan connection string: `mongodb+srv://...`

### 4. Deploy ke Vercel

#### Opsi 1: Deploy melalui Vercel Dashboard

1. Login ke [Vercel Dashboard](https://vercel.com/)
2. Klik "New Project" dan import repository GitHub Anda
3. Dalam project settings, tambahkan Environment Variables:
   - `MONGO_URI` - Connection string MongoDB Atlas 
   - `GMAIL_CLIENT_ID` - Google OAuth Client ID
   - `GMAIL_CLIENT_SECRET` - Google OAuth Client Secret
   - `GMAIL_REDIRECT_URI` - URI callback OAuth (gunakan domain Vercel Anda)
   - `GMAIL_REFRESH_TOKEN` - Token refresh dari step 5 setup lokal

4. Klik Deploy

#### Opsi 2: Deploy melalui CLI

1. Install Vercel CLI
   ```
   npm install -g vercel
   ```

2. Login ke Vercel
   ```
   vercel login
   ```

3. Deploy
   ```
   vercel
   ```

4. Ketika diminta, tambahkan Environment Variables yang sama dengan Opsi 1.

### 5. Konfigurasikan Webhook Gmail

Setelah deployment, Anda perlu:

1. Update Google OAuth Redirect URI ke domain Vercel Anda
2. Update Gmail webhook URL ke `https://your-app.vercel.app/api/process-gmail`

## Keterbatasan Vercel dan Solusi

Vercel adalah platform serverless yang ideal untuk frontend dan API, namun memiliki keterbatasan:

1. **Eksekusi Terbatas (10 detik)**: Proses email panjang mungkin timeout
   - Solusi: Pisahkan proses parsing email & background job ke platform seperti Heroku

2. **Tidak Mendukung Proses Background**:
   - Solusi: Implementasi microservice terpisah untuk pemrosesan email

## Alternatif Deployment dengan Backend Terpisah

Untuk fungsionalitas Gmail webhook yang lebih handal:

1. Deploy frontend ke Vercel
2. Deploy backend ke platform lain seperti:
   - Heroku
   - DigitalOcean
   - Railway.app

## License

[Your License] 