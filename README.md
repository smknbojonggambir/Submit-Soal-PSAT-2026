# Submit Soal PSAT 2026 — SMK Negeri Bojonggambir

Formulir online untuk guru mengumpulkan soal.

| Bagian | Fungsi |
|---|---|
| GitHub Pages | Menampilkan halaman formulir |
| Google Apps Script | Menerima kiriman dan memeriksa data |
| Google Drive | Menyimpan file Kisi-Kisi dan Soal Word |
| Google Sheet | Rekap data kiriman |

```
index.html, style.css, script.js, config.js   -> diunggah ke GitHub
apps-script/Code.gs                           -> ditempel ke Apps Script
```

Gunakan **akun Google panitia** untuk semua langkah Google. File dan rekap akan tersimpan di akun tersebut.

## Langkah 1 — Google Sheet dan Apps Script

1. Buka <https://sheets.new>, beri nama misalnya `Rekap Soal PSAT 2026`.
2. Klik **Ekstensi → Apps Script**.
3. Hapus semua isi `Code.gs`, tempel seluruh isi file `apps-script/Code.gs`, lalu **Simpan**.
4. Di bagian atas editor, pilih fungsi **setup**, klik **Jalankan**.
5. Berikan izin saat diminta. Jika muncul "Google belum memverifikasi aplikasi ini", klik **Lanjutan → Buka (nama proyek)**. Peringatan ini muncul karena skrip buatan sendiri.
6. Hasilnya: tab **Data Soal** di Sheet, dan folder **Soal PSAT 2026 - SMK Negeri Bojonggambir** di Drive (berisi `Kisi-Kisi` dan `Soal Word`).

## Langkah 2 — Deploy sebagai Web App

1. Klik **Deploy → Deployment baru**.
2. Pada ikon roda gigi pilih **Aplikasi web**.
3. Isi:
   - **Jalankan sebagai:** Saya
   - **Yang memiliki akses:** Siapa saja
4. Klik **Deploy**, lalu salin **URL aplikasi web** (berakhiran `/exec`).
5. Tes: buka URL itu di browser. Harus tampil `Layanan Submit Soal PSAT 2026 aktif.`

> Akun sekolah (Google Workspace) kadang tidak menyediakan pilihan "Siapa saja". Minta admin mengizinkannya, atau gunakan akun Gmail khusus panitia.

## Langkah 3 — Hubungkan formulir

Buka `config.js`, tempel URL tadi:

```js
SCRIPT_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
```

## Langkah 4 — Terbitkan di GitHub Pages

1. Buat akun di <https://github.com> jika belum punya.
2. Klik **New repository**, nama `submit-soal-psat-2026`, pilih **Public**, klik **Create**.
3. Klik **uploading an existing file**, seret `index.html`, `style.css`, `script.js`, `config.js`, `README.md`, dan folder `apps-script`, lalu **Commit changes**.
4. Buka **Settings → Pages**. Pada **Source** pilih **Deploy from a branch**, branch **main**, folder **/ (root)**, klik **Save**.
5. Tunggu beberapa menit. Alamat formulir: `https://NAMA-AKUN.github.io/submit-soal-psat-2026/`

## Uji coba sebelum dibagikan

Kirim satu data contoh dari HP atau laptop, lalu pastikan:

- muncul nomor bukti di layar,
- ada baris baru di tab **Data Soal**,
- kedua file ada di Drive dan bisa dibuka dari link di Sheet.

Hapus data contoh setelah selesai.

## Jika mengubah Code.gs

Setelah menyimpan, buka **Deploy → Kelola deployment → ikon pensil → Versi: Versi baru → Deploy**. URL tetap sama. Tanpa langkah ini perubahan belum berlaku.

## Masalah umum

| Gejala | Solusi |
|---|---|
| "Aplikasi belum terhubung" | `SCRIPT_URL` di `config.js` masih kosong |
| "Tidak mendapat jawaban yang benar dari server" | Pastikan akses deployment **Siapa saja** dan URL berakhiran `/exec` |
| "Server belum disiapkan" | Jalankan fungsi `setup` |
| Halaman belum berubah | Tunggu beberapa menit, lalu muat ulang dengan Ctrl+F5 |

## Keamanan

- File di Drive tidak dibuat publik. Hanya pemilik dan orang yang Anda beri akses folder yang bisa membukanya.
- **Jangan unggah soal atau data guru ke repository GitHub.** Repository hanya berisi kode.
- Formulir tidak memakai login: siapa pun yang tahu alamatnya bisa mengirim. Bagikan hanya kepada guru.
- Setelah masa pengumpulan selesai, tutup lewat **Deploy → Kelola deployment → Arsipkan**.
