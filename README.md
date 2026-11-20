# Chika Personal Finance Hub & Multi-Wallet Dashboard with WhatsApp Bot 💰📱

Aplikasi web manajemen keuangan personal modern, estetis, dan responsif dengan integrasi WhatsApp Bot AI & Firebase Realtime Database.

---

## 🌟 Fitur Utama

### 1. Dashboard Overview & Multi-Wallet
- **Total Net Worth Real-Time:** Akumulasi saldo otomatis dari semua dompet gabungan dengan fitur sembunyikan/tampilkan nominal (*sensor mata*).
- **Multi-Wallet Cards:**
  - 💵 **Cash** (Dompet Fisik)
  - 📱 **DANA** (E-Wallet)
  - 🏦 **SeaBank** (Rekening Bank)
  - ➕ Opsi **Tambah Dompet Baru** (BCA, Mandiri, GoPay, OVO, ShopeePay, dll.)
- **Monthly Summary:** Pemasukan vs Pengeluaran bulan berjalan + persentase saving rate.

### 2. Visualisasi & Grafik (Charts)
- **Expense Breakdown (Donut Chart):** Distribusi pengeluaran per kategori (Makanan & Minuman, Transportasi, Belanja, Skincare & Perawatan, Tagihan, Hiburan, dll.).
- **Cashflow Trend (Bar Chart):** Grafik tren perbandingan pemasukan dan pengeluaran harian/mingguan.

### 3. Riwayat Transaksi & Transfer Antar-Dompet
- Tabel pencatatan transaksi lengkap dengan fitur pencarian instan, filter per dompet, filter jenis, filter kategori, dan tanggal.
- **Transfer Antar-Dompet:** Pindahkan saldo (contoh: dari SeaBank ke DANA / Tarik tunai ke Cash) secara otomatis memotong saldo asal dan menambah saldo tujuan secara atomik.
- Hapus transaksi dengan fitur pengembalian saldo otomatis (*auto-rollback*).

### 4. Target Tabungan (Savings Goals Tracker)
- Pantau impian finansial (Dana Darurat, Liburan, Beli Gadget) dengan visual progress bar.
- **Alokasi Dana:** Sisihkan saldo dari dompet pilihan ke dalam target tabungan kapan saja.

### 5. Akses & Keamanan Khusus
- **Dari [index.html](file:///d:/chiko%20nduut/index.html):** Tombol **Keuangan** dilindungi dengan **Scan Sidik Jari (Biometrik WebAuthn)** dan **4-Digit PIN Keamanan** (Default: `1234`).
- **Dari [real.html](file:///d:/chiko%20nduut/real.html):** Tombol **Keuangan** langsung masuk ke [finance.html](file:///d:/chiko%20nduut/finance.html) tanpa perlu password / sidik jari (*"kalau yg real gausa"*).

---

## 🤖 Integrasi WhatsApp Bot & NLP Parser

Bot WhatsApp siap dihubungkan ke penyedia gateway WhatsApp (seperti **Fonnte**, **Wablas**, atau **WhatsApp Cloud API Meta**).

### Contoh Perintah Chat WhatsApp:
1. **Pengeluaran:**
   - `"beli kopi 25rb pake dana"` ➔ Otomatis mencatat pengeluaran Rp 25.000 dari dompet DANA (Kategori: Makanan & Minuman).
   - `"bensin 35k cash"` ➔ Pengeluaran Rp 35.000 dari dompet Cash.
   - `"skincare 150.000 seabank"` ➔ Pengeluaran Rp 150.000 dari dompet SeaBank.
2. **Pemasukan:**
   - `"gajian 5jt masuk seabank"` ➔ Otomatis menambah saldo SeaBank sebesar Rp 5.000.000.
3. **Transfer Antar-Dompet:**
   - `"tarik tunai dari seabank ke cash 300rb"` ➔ Mengurangi saldo SeaBank Rp 300.000 dan menambah saldo Cash Rp 300.000.
4. **Cek Saldo & Laporan:**
   - `"cek saldo"` ➔ Membalas dengan rincian saldo semua dompet + Total Net Worth.
   - `"laporan hari ini"` ➔ Ringkasan pemasukan & pengeluaran hari ini.

---

## 🚀 Cara Menjalankan

### 1. Menjalankan Server Node.js
Pastikan dependencies sudah terpasang:
```bash
npm install
```
Jalankan server:
```bash
npm start
```
Server akan berjalan di:
- **Planner Arsinta:** `http://localhost:3000/index.html`
- **Planner Arsinta (Direct Bypass):** `http://localhost:3000/real.html`
- **Finance Dashboard:** `http://localhost:3000/finance.html`
- **WhatsApp Webhook:** `http://localhost:3000/api/webhook/whatsapp`

### 2. Mengaktifkan Webhook WhatsApp untuk Akses Publik
Gunakan [ngrok](https://ngrok.com) untuk menghubungkan localhost ke gateway WhatsApp:
```bash
ngrok http 3000
```
Salin URL publik yang dihasilkan (contoh: `https://xxxx.ngrok-free.app/api/webhook/whatsapp`) dan tempel ke pengaturan Webhook di provider gateway Anda (misal Fonnte atau Wablas).

### 3. Konfigurasi Environment (`.env`)
Salin berkas `.env.example` ke `.env`:
```env
PORT=3000
FIREBASE_DB_URL=https://chika-c61d6-default-rtdb.firebaseio.com
GEMINI_API_KEY=               # Opsional: untuk parser AI Gemini
FONNTE_TOKEN=                 # Opsional: untuk auto-reply via Fonnte API
WA_VERIFY_TOKEN=chika_finance_secret
```

