/**
 * Backend "Submit Soal PSAT 2026" - SMK Negeri Bojonggambir
 *
 * Cara pakai: tempel di Apps Script milik Google Sheet panitia,
 * jalankan fungsi setup() sekali, lalu Deploy sebagai Web app.
 */

var MAX_FILE_MB = 10; // samakan dengan config.js
var SHEET_NAME = 'Data Soal';
var ROOT_FOLDER_NAME = 'Soal PSAT 2026 - SMK Negeri Bojonggambir';
var TIMEZONE = 'Asia/Jakarta';

var HEADERS = [
  'Waktu Kirim', 'Nomor Bukti', 'Nama Guru', 'Mata Pelajaran', 'Kelas',
  'Jumlah Soal', 'Link Google Form', 'File Kisi-Kisi', 'File Soal Word',
  'Catatan', 'ID Pengiriman'
];

var FILE_RULES = {
  kisi: { label: 'Kisi-Kisi', folderKey: 'FOLDER_KISI', ext: ['pdf', 'doc', 'docx', 'xls', 'xlsx'] },
  soal: { label: 'Soal Word', folderKey: 'FOLDER_SOAL', ext: ['doc', 'docx'] }
};

var MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

/** Jalankan SEKALI dari editor Apps Script. Aman dijalankan ulang. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Buka Apps Script dari menu Ekstensi di Google Sheet panitia.');
  ss.setSpreadsheetTimeZone(TIMEZONE);

  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight('bold')
    .setBackground('#14537a')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.getRange('A2:A').setNumberFormat('dd/MM/yyyy HH:mm:ss');
  sheet.setColumnWidths(1, HEADERS.length, 160);

  var props = PropertiesService.getScriptProperties();
  var root = getOrCreateFolder_(props, 'FOLDER_ROOT', ROOT_FOLDER_NAME, null);
  getOrCreateFolder_(props, 'FOLDER_KISI', 'Kisi-Kisi', root);
  getOrCreateFolder_(props, 'FOLDER_SOAL', 'Soal Word', root);
  props.setProperty('SPREADSHEET_ID', ss.getId());

  Logger.log('Setup selesai. Folder Drive: ' + root.getUrl());
}

function getOrCreateFolder_(props, key, name, parent) {
  var id = props.getProperty(key);
  if (id) {
    try {
      var existing = DriveApp.getFolderById(id);
      if (!existing.isTrashed()) return existing;
    } catch (e) { /* folder lama hilang, buat baru */ }
  }
  var folder = parent ? parent.createFolder(name) : DriveApp.createFolder(name);
  props.setProperty(key, folder.getId());
  return folder;
}

/** Untuk mengetes URL Web App di browser. */
function doGet() {
  return json_({ ok: true, message: 'Layanan Submit Soal PSAT 2026 aktif.' });
}

function doPost(e) {
  try {
    var data = parseRequest_(e);
    var lock = LockService.getScriptLock();
    // Satu pengiriman diproses pada satu waktu: mencegah baris ganda/tertimpa
    if (!lock.tryLock(60000)) throw userError_('Server sedang sibuk. Coba lagi sebentar.');
    try {
      return json_({ ok: true, receipt: save_(data) });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({
      ok: false,
      message: err && err.isUserError ? err.message : 'Terjadi kesalahan di server. Hubungi panitia.'
    });
  }
}

/** Semua data diperiksa ulang di server. */
function parseRequest_(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    throw userError_('Data kiriman tidak terbaca.');
  }
  if (!body || typeof body !== 'object') throw userError_('Data kiriman tidak terbaca.');

  var data = {
    submissionId: String(body.submissionId || ''),
    namaGuru: text_(body.namaGuru, 'Nama Guru', 100),
    mapel: text_(body.mapel, 'Mata Pelajaran', 100),
    kelas: text_(body.kelas, 'Kelas', 60),
    linkForm: text_(body.linkForm, 'Link Google Form', 500),
    catatan: String(body.catatan || '').trim().slice(0, 1000),
    jumlahSoal: Number(body.jumlahSoal)
  };

  if (!/^[a-f0-9]{16}$/.test(data.submissionId)) throw userError_('ID pengiriman tidak valid.');
  if (!(data.jumlahSoal % 1 === 0 && data.jumlahSoal >= 1 && data.jumlahSoal <= 200)) {
    throw userError_('Jumlah Soal harus angka bulat 1 sampai 200.');
  }
  if (!/^https:\/\/(forms\.gle\/|docs\.google\.com\/forms\/)\S+$/i.test(data.linkForm)) {
    throw userError_('Link Google Form tidak valid.');
  }

  data.kisi = file_(body.kisi, FILE_RULES.kisi);
  data.soal = file_(body.soal, FILE_RULES.soal);
  return data;
}

function text_(value, label, max) {
  var s = String(value || '').trim();
  if (!s) throw userError_(label + ' wajib diisi.');
  if (s.length > max) throw userError_(label + ' terlalu panjang.');
  return s;
}

function file_(file, rule) {
  if (!file || !file.name || !file.data) throw userError_('File ' + rule.label + ' wajib diunggah.');
  var parts = String(file.name).split('.');
  var ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
  if (rule.ext.indexOf(ext) === -1) {
    throw userError_('Format file ' + rule.label + ' harus ' + rule.ext.join(', ').toUpperCase() + '.');
  }
  var maxBytes = MAX_FILE_MB * 1024 * 1024;
  var tooBig = 'File ' + rule.label + ' melebihi ' + MAX_FILE_MB + ' MB.';
  if (String(file.data).length > Math.ceil(maxBytes / 3) * 4) throw userError_(tooBig);
  var bytes;
  try {
    bytes = Utilities.base64Decode(file.data);
  } catch (err) {
    throw userError_('File ' + rule.label + ' rusak saat dikirim.');
  }
  if (!bytes.length) throw userError_('File ' + rule.label + ' kosong.');
  if (bytes.length > maxBytes) throw userError_(tooBig);
  return { bytes: bytes, ext: ext };
}

function save_(data) {
  var props = PropertiesService.getScriptProperties();
  var spreadsheetId = props.getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) throw userError_('Server belum disiapkan. Admin perlu menjalankan setup().');
  var sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(SHEET_NAME);
  if (!sheet) throw userError_('Tab "' + SHEET_NAME + '" tidak ditemukan. Admin perlu menjalankan setup().');

  // Jika kiriman yang sama sudah tersimpan (guru menekan kirim ulang), jangan gandakan
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var found = sheet.getRange(2, HEADERS.length, lastRow - 1, 1)
      .createTextFinder(data.submissionId).matchEntireCell(true).findNext();
    if (found) return String(sheet.getRange(found.getRow(), 2).getValue());
  }

  var now = new Date();
  var receipt = 'PSAT-' + Utilities.formatDate(now, TIMEZONE, 'MMdd') + '-' +
    data.submissionId.slice(0, 6).toUpperCase();

  var created = [];
  try {
    ['kisi', 'soal'].forEach(function (key) {
      var rule = FILE_RULES[key];
      var file = data[key];
      var name = clean_([data.kelas, data.mapel, data.namaGuru, rule.label, receipt].join(' - ')) +
        '.' + file.ext;
      var blob = Utilities.newBlob(file.bytes, MIME[file.ext], name);
      // File mengikuti izin folder panitia (tidak dibuat publik)
      created.push(DriveApp.getFolderById(props.getProperty(rule.folderKey)).createFile(blob));
    });

    sheet.appendRow([
      now, receipt, safe_(data.namaGuru), safe_(data.mapel), safe_(data.kelas),
      data.jumlahSoal, safe_(data.linkForm), created[0].getUrl(), created[1].getUrl(),
      safe_(data.catatan), data.submissionId
    ]);
    SpreadsheetApp.flush();
  } catch (err) {
    // Gagal di tengah jalan: buang file yang terlanjur dibuat
    created.forEach(function (f) { f.setTrashed(true); });
    throw err;
  }
  return receipt;
}

/** Cegah isian seperti "=IMPORTXML(...)" dijalankan sebagai rumus. */
function safe_(s) {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function clean_(s) {
  return s.replace(/[\\\/:*?"<>|\x00-\x1f]/g, '-').slice(0, 180);
}

function userError_(message) {
  var err = new Error(message);
  err.isUserError = true;
  return err;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
