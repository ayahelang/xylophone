# Silver Xylophone v2

Web xylophone ringan berbasis HTML, CSS, JavaScript + Google Sheets (via Apps Script) sebagai database.

## Fitur
- 8 nada C Major
- Mouse, touch, dan keyboard A S D F G H J K
- Volume dan octave 3–5
- Soft / Bright / Digital tone
- Reverb
- Dark/light mode
- **Rekam melodi** → simpan ke Google Sheets
- **Galeri publik** – semua rekaman tampil di sini
- Play, Like, Komentar
- Hapus lagu dengan password (yang di-set saat rekam)
- Responsive & fluid
- Pure frontend (GitHub Pages) + Apps Script backend

## Setup Google Sheets + Apps Script

1. Buat **Google Sheet baru** (boleh kosong total, tidak perlu buat header manual).
2. Buka **Extensions → Apps Script**.
3. Hapus kode default, lalu **paste seluruh isi file `apps-script.js`**.
4. Klik **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Setelah deploy, salin **Web App URL**.
6. Buka file `app.js`, cari baris:
   ```js
   const SCRIPT_URL = 'https://script.google.com/macros/s/PASTE_YOUR_DEPLOYMENT_ID_HERE/exec';
   ```
   Ganti dengan URL yang kamu salin.

> Script akan **otomatis** membuat sheet `Songs` dan `Comments` beserta header-nya saat pertama kali dipanggil.

## Deploy ke GitHub Pages

1. Upload semua file (kecuali `apps-script.js` boleh ikut sebagai dokumentasi) ke repository.
2. Settings → Pages → Source: Deploy from branch → `main` / root.
3. Selesai.

## Alur Pengguna

1. Tekan **Record** → isi Nama, Judul Melodi, Password → Mulai Rekam.
2. Mainkan nada → tekan **Stop & Save**.
3. Melodi langsung muncul di **Galeri Rekaman**.
4. Pengunjung bisa Play, Like, dan Komentar.
5. Pemilik bisa Hapus dengan memasukkan password yang sama.
