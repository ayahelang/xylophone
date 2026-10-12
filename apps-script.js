/**
 * Silver Xylophone - Google Apps Script Backend
 * 
 * CARA PAKAI:
 * 1. Buka Google Sheet baru (boleh kosong total)
 * 2. Extensions → Apps Script
 * 3. Hapus kode default, paste SEMUA kode ini
 * 4. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Salin Web App URL, masukkan ke app.js (variabel SCRIPT_URL)
 * 
 * Script ini akan OTOMATIS membuat sheet "Songs" dan "Comments"
 * beserta header-nya jika belum ada.
 */

const SONGS_SHEET = 'Songs';
const COMMENTS_SHEET = 'Comments';

const SONGS_HEADERS = ['id', 'title', 'author', 'password', 'notes', 'created_at', 'plays', 'likes'];
const COMMENTS_HEADERS = ['id', 'song_id', 'author', 'comment', 'created_at'];

// ===================== ENTRY POINTS =====================

function doGet(e) {
  try {
    ensureSheets();
    const action = (e.parameter.action || '').toLowerCase();

    if (action === 'list') {
      return jsonResponse(listSongs());
    }
    if (action === 'get') {
      const id = e.parameter.id;
      if (!id) return jsonResponse({ error: 'id required' }, 400);
      return jsonResponse(getSong(id));
    }
    // Default: health check
    return jsonResponse({ status: 'ok', message: 'Silver Xylophone API ready' });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function doPost(e) {
  try {
    ensureSheets();
    const data = JSON.parse(e.postData.contents);
    const action = (data.action || '').toLowerCase();

    if (action === 'save') return jsonResponse(saveSong(data));
    if (action === 'like') return jsonResponse(likeSong(data.id));
    if (action === 'comment') return jsonResponse(addComment(data));
    if (action === 'delete') return jsonResponse(deleteSong(data.id, data.password));
    if (action === 'play') return jsonResponse(incrementPlays(data.id));

    return jsonResponse({ error: 'unknown action' }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ===================== SHEET SETUP (OTOMATIS) =====================

function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Songs sheet
  let songs = ss.getSheetByName(SONGS_SHEET);
  if (!songs) {
    songs = ss.insertSheet(SONGS_SHEET);
    songs.appendRow(SONGS_HEADERS);
    songs.getRange(1, 1, 1, SONGS_HEADERS.length).setFontWeight('bold');
    songs.setFrozenRows(1);
  } else if (songs.getLastRow() === 0) {
    songs.appendRow(SONGS_HEADERS);
    songs.getRange(1, 1, 1, SONGS_HEADERS.length).setFontWeight('bold');
    songs.setFrozenRows(1);
  }

  // Comments sheet
  let comments = ss.getSheetByName(COMMENTS_SHEET);
  if (!comments) {
    comments = ss.insertSheet(COMMENTS_SHEET);
    comments.appendRow(COMMENTS_HEADERS);
    comments.getRange(1, 1, 1, COMMENTS_HEADERS.length).setFontWeight('bold');
    comments.setFrozenRows(1);
  } else if (comments.getLastRow() === 0) {
    comments.appendRow(COMMENTS_HEADERS);
    comments.getRange(1, 1, 1, COMMENTS_HEADERS.length).setFontWeight('bold');
    comments.setFrozenRows(1);
  }

  // Hapus sheet default "Sheet1" kalau masih ada dan kosong
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }
}

// ===================== HELPERS =====================

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// ===================== SONGS =====================

function listSongs() {
  const sheet = getSheet(SONGS_SHEET);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    delete obj.password; // jangan kirim password ke frontend
    try {
      obj.notes = JSON.parse(obj.notes || '[]');
    } catch (e) {
      obj.notes = [];
    }
    obj.plays = Number(obj.plays) || 0;
    obj.likes = Number(obj.likes) || 0;
    return obj;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function getSong(id) {
  const songs = listSongs();
  const song = songs.find(s => s.id === id);
  if (!song) return { error: 'not found' };

  // Ambil komentar
  const sheet = getSheet(COMMENTS_SHEET);
  const rows = sheet.getDataRange().getValues();
  const comments = [];

  if (rows.length > 1) {
    const headers = rows[0];
    const idx = {
      id: headers.indexOf('id'),
      song_id: headers.indexOf('song_id'),
      author: headers.indexOf('author'),
      comment: headers.indexOf('comment'),
      created_at: headers.indexOf('created_at')
    };

    rows.slice(1).forEach(row => {
      if (row[idx.song_id] === id) {
        comments.push({
          id: row[idx.id],
          author: row[idx.author],
          comment: row[idx.comment],
          created_at: row[idx.created_at]
        });
      }
    });
  }

  comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  song.comments = comments;
  return song;
}

function saveSong(data) {
  if (!data.title || !data.author || !data.password || !Array.isArray(data.notes)) {
    return { error: 'title, author, password, dan notes wajib diisi' };
  }
  if (data.notes.length === 0) {
    return { error: 'melodi kosong, rekam dulu minimal 1 nada' };
  }

  const id = Utilities.getUuid().substring(0, 8);
  const sheet = getSheet(SONGS_SHEET);

  sheet.appendRow([
    id,
    String(data.title).trim().substring(0, 80),
    String(data.author).trim().substring(0, 40),
    String(data.password),
    JSON.stringify(data.notes),
    new Date().toISOString(),
    0,
    0
  ]);

  return { success: true, id: id };
}

function likeSong(id) {
  if (!id) return { error: 'id required' };

  const sheet = getSheet(SONGS_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const likesCol = headers.indexOf('likes');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === id) {
      const current = Number(data[i][likesCol]) || 0;
      sheet.getRange(i + 1, likesCol + 1).setValue(current + 1);
      return { success: true, likes: current + 1 };
    }
  }
  return { error: 'not found' };
}

function incrementPlays(id) {
  if (!id) return { error: 'id required' };

  const sheet = getSheet(SONGS_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const playsCol = headers.indexOf('plays');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === id) {
      const current = Number(data[i][playsCol]) || 0;
      sheet.getRange(i + 1, playsCol + 1).setValue(current + 1);
      return { success: true, plays: current + 1 };
    }
  }
  return { error: 'not found' };
}

function deleteSong(id, password) {
  if (!id || !password) return { error: 'id dan password required' };

  const sheet = getSheet(SONGS_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('id');
  const passCol = headers.indexOf('password');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === id) {
      if (String(data[i][passCol]) !== String(password)) {
        return { error: 'Password salah' };
      }
      // Hapus lagu
      sheet.deleteRow(i + 1);

      // Hapus semua komentar terkait
      const cSheet = getSheet(COMMENTS_SHEET);
      const cData = cSheet.getDataRange().getValues();
      if (cData.length > 1) {
        const songIdCol = cData[0].indexOf('song_id');
        for (let j = cData.length - 1; j >= 1; j--) {
          if (cData[j][songIdCol] === id) {
            cSheet.deleteRow(j + 1);
          }
        }
      }
      return { success: true };
    }
  }
  return { error: 'Lagu tidak ditemukan' };
}

// ===================== COMMENTS =====================

function addComment(data) {
  if (!data.song_id || !data.author || !data.comment) {
    return { error: 'song_id, author, dan comment wajib diisi' };
  }

  const author = String(data.author).trim().substring(0, 40);
  const comment = String(data.comment).trim().substring(0, 300);
  if (!author || !comment) {
    return { error: 'Nama dan komentar tidak boleh kosong' };
  }

  // Pastikan lagu ada
  const songs = listSongs();
  if (!songs.find(s => s.id === data.song_id)) {
    return { error: 'Lagu tidak ditemukan' };
  }

  const id = Utilities.getUuid().substring(0, 8);
  const sheet = getSheet(COMMENTS_SHEET);

  sheet.appendRow([
    id,
    data.song_id,
    author,
    comment,
    new Date().toISOString()
  ]);

  return { success: true, id: id };
}
