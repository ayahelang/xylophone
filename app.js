/* =========================================================
   Silver Xylophone v2 – with Google Sheets Gallery
   ========================================================= */

// ========== CONFIG ==========
// Ganti URL di bawah dengan Web App URL dari Apps Script-mu
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzg-m-sVzL0r8ig-9ft8u5P0xHvnzVnelDfMxMHf8wS4NuOm8aFeJ4Kf1vFlhQw12jH/exec';

// ========== STATE ==========
const $ = s => document.querySelector(s);
let audioCtx = null, master = null, convolver = null;
let recording = false, sequence = [], reverbOn = true, lastTime = 0;
let recMeta = { author: '', title: '', password: '' }; // data form record
let currentSong = null; // lagu yang sedang dilihat di detail
let isPlayingSequence = false;

const notes = [
  { name: "C", semi: 0, key: "A", color: "#e53935" },   // red
  { name: "D", semi: 2, key: "S", color: "#fb8c00" },   // orange
  { name: "E", semi: 4, key: "D", color: "#fdd835" },   // yellow
  { name: "F", semi: 5, key: "F", color: "#43a047" },   // green
  { name: "G", semi: 7, key: "G", color: "#00acc1" },   // cyan
  { name: "A", semi: 9, key: "H", color: "#1e88e5" },   // blue
  { name: "B", semi: 11, key: "J", color: "#8e24aa" },  // purple
  { name: "C", semi: 12, key: "K", color: "#ec407a" }   // pink
];

// ========== AUDIO ==========
function setupAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  master = audioCtx.createGain();
  master.gain.value = 0.8;
  master.connect(audioCtx.destination);
  convolver = audioCtx.createConvolver();
  const rate = audioCtx.sampleRate, len = rate * 1.1;
  const impulse = audioCtx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = impulse.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.3);
  }
  convolver.buffer = impulse;
  convolver.connect(master);
}

function freq(semi) {
  return 261.625565 * Math.pow(2, (Number($("#octave").value) - 4) + semi / 12);
}

function play(n) {
  setupAudio();
  if (audioCtx.state === "suspended") audioCtx.resume();
  const now = audioCtx.currentTime;
  const f = freq(n.semi);
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = $("#wave").value;
  osc.frequency.setValueAtTime(f, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(Number($("#volume").value) / 100 * 0.34, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
  osc.connect(gain);
  gain.connect(master);
  if (reverbOn) {
    const rg = audioCtx.createGain();
    rg.gain.value = 0.18;
    gain.connect(rg);
    rg.connect(convolver);
  }
  osc.start(now);
  osc.stop(now + 0.75);

  const el = document.querySelector(`[data-name="${n.name}"]`);
  if (el) {
    el.classList.add("playing");
    setTimeout(() => el.classList.remove("playing"), 90);
  }
  $("#nowNote").textContent = n.name;
  $("#nowFreq").textContent = `${Math.round(f)} Hz`;

  if (recording) {
    sequence.push({ note: n.name, semi: n.semi, at: Date.now() - lastTime });
  }
}

function playSequence(seq) {
  if (!seq || !seq.length || isPlayingSequence) return;
  isPlayingSequence = true;
  $("#playSongBtn").disabled = true;
  $("#playSongBtn").textContent = "♪ Playing…";

  let i = 0;
  const start = performance.now();

  function tick() {
    if (i >= seq.length) {
      isPlayingSequence = false;
      $("#playSongBtn").disabled = false;
      $("#playSongBtn").textContent = "▶ Play Melodi";
      return;
    }
    const item = seq[i];
    const elapsed = performance.now() - start;
    if (elapsed >= item.at) {
      const noteObj = notes.find(n => n.name === item.note && n.semi === item.semi)
        || notes.find(n => n.name === item.note)
        || { name: item.note, semi: item.semi || 0 };
      play(noteObj);
      i++;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ========== RENDER KEYS ==========
function render() {
  $("#keys").innerHTML = notes.map(n =>
    `<button class="key" data-name="${n.name}" style="background:${n.color}" aria-label="Nada ${n.name}">
      <span>${n.name}</span><small>${n.key}</small>
    </button>`
  ).join("");
  document.querySelectorAll(".key").forEach((el, i) => {
    el.addEventListener("pointerdown", e => {
      e.preventDefault();
      play(notes[i]);
    });
  });
  $("#scaleName").textContent = `C Major • Octave ${$("#octave").value}`;
}
render();

// ========== CONTROLS ==========
$("#volume").oninput = e => $("#volumeValue").textContent = e.target.value + "%";
$("#octave").oninput = () => {
  $("#octaveValue").textContent = $("#octave").value;
  render();
};
$("#reverbBtn").onclick = () => {
  reverbOn = !reverbOn;
  $("#reverbBtn").classList.toggle("active", reverbOn);
};

// ========== RECORD FLOW ==========
const recordDialog = $("#recordDialog");
const deleteDialog = $("#deleteDialog");

$("#recordBtn").onclick = () => {
  if (recording) {
    // Stop recording → save
    stopAndSave();
  } else {
    // Buka form dulu
    $("#recAuthor").value = localStorage.getItem("xylo-author") || "";
    $("#recTitle").value = "";
    $("#recPassword").value = "";
    recordDialog.showModal();
  }
};

$("#recordForm").onsubmit = e => {
  e.preventDefault();
  recMeta.author = $("#recAuthor").value.trim();
  recMeta.title = $("#recTitle").value.trim();
  recMeta.password = $("#recPassword").value;
  if (!recMeta.author || !recMeta.title || !recMeta.password) return;

  localStorage.setItem("xylo-author", recMeta.author);
  recordDialog.close();

  // Mulai rekam
  recording = true;
  sequence = [];
  lastTime = Date.now();
  $("#recordBtn").textContent = "■ Stop & Save";
  $("#recordBtn").classList.add("recording");
  showToast("Merekam… mainkan nadanya!");
};

$("#closeRecordDialog").onclick = $("#cancelRecord").onclick = () => recordDialog.close();

async function stopAndSave() {
  recording = false;
  $("#recordBtn").textContent = "● Record";
  $("#recordBtn").classList.remove("recording");

  if (sequence.length === 0) {
    showToast("Tidak ada nada yang direkam");
    return;
  }

  showToast("Menyimpan ke galeri…");
  try {
    const res = await api("POST", {
      action: "save",
      title: recMeta.title,
      author: recMeta.author,
      password: recMeta.password,
      notes: sequence
    });
    if (res.error) throw new Error(res.error);
    showToast("Berhasil disimpan!");
    sequence = [];
    loadGallery();
  } catch (err) {
    console.error("Save error:", err);
    showToast("Gagal simpan: " + err.message);
  }
}

$("#clearBtn").onclick = () => {
  sequence = [];
  $("#nowNote").textContent = "—";
  $("#nowFreq").textContent = "Ready";
};

// ========== THEME ==========
$("#themeBtn").onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("silver-xylophone-theme", document.body.classList.contains("dark") ? "dark" : "light");
  $("#themeBtn").textContent = document.body.classList.contains("dark") ? "☀" : "☾";
};
if (localStorage.getItem("silver-xylophone-theme") === "dark") {
  document.body.classList.add("dark");
  $("#themeBtn").textContent = "☀";
}

// ========== HELP ==========
const helpDialog = $("#helpDialog");
$("#helpBtn").onclick = () => helpDialog.showModal();
$("#closeHelp").onclick = $("#closeHelp2").onclick = () => helpDialog.close();

// ========== KEYBOARD ==========
document.addEventListener("keydown", e => {
  if (e.repeat) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  const n = notes.find(x => x.key.toLowerCase() === e.key.toLowerCase());
  if (n) play(n);
});

// ========== API HELPER ==========
async function api(method, body = null, params = {}) {
  // Pastikan SCRIPT_URL sudah diganti
  if (!SCRIPT_URL || SCRIPT_URL.includes("PASTE_YOUR")) {
    throw new Error("SCRIPT_URL belum diisi. Ganti di app.js dengan Web App URL-mu.");
  }

  const url = new URL(SCRIPT_URL);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));

  let res;
  try {
    if (method === "GET") {
      res = await fetch(url.toString(), {
        method: "GET",
        mode: "cors",
        redirect: "follow",
        cache: "no-cache"
      });
    } else {
      // POST – Content-Type text/plain menghindari preflight CORS
      res = await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "cors",
        redirect: "follow",
        cache: "no-cache",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(body || {})
      });
    }
  } catch (networkErr) {
    console.error("Fetch network error:", networkErr);
    throw new Error("Failed to fetch. Cek: 1) SCRIPT_URL benar 2) Deploy 'Anyone' 3) Authorize script dulu");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("HTTP error", res.status, text);
    throw new Error("Server error " + res.status);
  }

  const data = await res.json();
  return data;
}

// ========== GALLERY ==========
async function loadGallery() {
  const list = $("#galleryList");
  list.innerHTML = `<p class="gallery-empty">Memuat galeri…</p>`;
  try {
    const songs = await api("GET", null, { action: "list" });
    if (!Array.isArray(songs) || songs.length === 0) {
      list.innerHTML = `<p class="gallery-empty">Belum ada rekaman. Jadilah yang pertama!</p>`;
      return;
    }
    list.innerHTML = songs.map(s => `
      <button class="gallery-item" data-id="${s.id}">
        <div class="gi-title">${escapeHtml(s.title)}</div>
        <div class="gi-meta">
          <span>${escapeHtml(s.author)}</span>
          <span>♥ ${s.likes || 0}</span>
          <span>▶ ${s.plays || 0}</span>
        </div>
        <div class="gi-date">${formatDate(s.created_at)}</div>
      </button>
    `).join("");

    list.querySelectorAll(".gallery-item").forEach(btn => {
      btn.onclick = () => openSong(btn.dataset.id);
    });
  } catch (err) {
    list.innerHTML = `<p class="gallery-empty">Gagal memuat galeri.<br><small>${err.message}</small></p>`;
    console.error(err);
  }
}

$("#refreshGalleryBtn").onclick = loadGallery;

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ========== SONG DETAIL ==========
async function openSong(id) {
  showToast("Memuat lagu…");
  try {
    const song = await api("GET", null, { action: "get", id });
    if (song.error) throw new Error(song.error);
    currentSong = song;
    renderSongDetail(song);
    $("#songDetail").classList.remove("hidden");
    $("#songDetail").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    showToast("Gagal memuat: " + err.message);
  }
}

function renderSongDetail(song) {
  $("#detailTitle").textContent = song.title;
  $("#detailMeta").textContent = `oleh ${song.author} • ${formatDate(song.created_at)} • ${song.plays || 0} plays`;
  $("#likeCount").textContent = song.likes || 0;

  // Comments
  const cl = $("#commentsList");
  if (!song.comments || song.comments.length === 0) {
    cl.innerHTML = `<p class="no-comments">Belum ada komentar.</p>`;
  } else {
    cl.innerHTML = song.comments.map(c => `
      <div class="comment-item">
        <strong>${escapeHtml(c.author)}</strong>
        <span class="c-date">${formatDate(c.created_at)}</span>
        <p>${escapeHtml(c.comment)}</p>
      </div>
    `).join("");
  }
}

$("#closeDetailBtn").onclick = () => {
  $("#songDetail").classList.add("hidden");
  currentSong = null;
};

$("#playSongBtn").onclick = async () => {
  if (!currentSong || !currentSong.notes) return;
  playSequence(currentSong.notes);
  // Increment plays (fire & forget)
  try {
    await api("POST", { action: "play", id: currentSong.id });
    currentSong.plays = (currentSong.plays || 0) + 1;
    $("#detailMeta").textContent = `oleh ${currentSong.author} • ${formatDate(currentSong.created_at)} • ${currentSong.plays} plays`;
  } catch (_) {}
};

$("#likeBtn").onclick = async () => {
  if (!currentSong) return;
  try {
    const res = await api("POST", { action: "like", id: currentSong.id });
    if (res.error) throw new Error(res.error);
    currentSong.likes = res.likes;
    $("#likeCount").textContent = res.likes;
    showToast("Liked!");
    loadGallery(); // update counter di list
  } catch (err) {
    showToast(err.message);
  }
};

// ========== COMMENTS ==========
$("#commentForm").onsubmit = async e => {
  e.preventDefault();
  if (!currentSong) return;
  const author = $("#commentAuthor").value.trim();
  const comment = $("#commentText").value.trim();
  if (!author || !comment) return;

  try {
    const res = await api("POST", {
      action: "comment",
      song_id: currentSong.id,
      author,
      comment
    });
    if (res.error) throw new Error(res.error);
    $("#commentText").value = "";
    localStorage.setItem("xylo-author", author);
    showToast("Komentar terkirim");
    // Refresh detail
    openSong(currentSong.id);
  } catch (err) {
    showToast("Gagal: " + err.message);
  }
};

// Pre-fill comment author
$("#commentAuthor").value = localStorage.getItem("xylo-author") || "";

// ========== DELETE ==========
$("#deleteBtn").onclick = () => {
  if (!currentSong) return;
  $("#delPassword").value = "";
  deleteDialog.showModal();
};

$("#closeDeleteDialog").onclick = $("#cancelDelete").onclick = () => deleteDialog.close();

$("#deleteForm").onsubmit = async e => {
  e.preventDefault();
  if (!currentSong) return;
  const password = $("#delPassword").value;
  try {
    const res = await api("POST", {
      action: "delete",
      id: currentSong.id,
      password
    });
    if (res.error) throw new Error(res.error);
    deleteDialog.close();
    $("#songDetail").classList.add("hidden");
    currentSong = null;
    showToast("Lagu berhasil dihapus");
    loadGallery();
  } catch (err) {
    showToast(err.message);
  }
};

// ========== TOAST ==========
let toastTimer;
function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 3200);
}

// ========== INIT ==========
loadGallery();
