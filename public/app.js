const API = '/api';

let state = { users: [], songs: [], playlists: [], currentUserId: null, openPlaylistId: null };

// ---------- fetch helpers ----------
async function api(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ---------- init ----------
async function init() {
  state.users = await api('GET', '/users');
  if (!state.users.length) {
    state.users = [await api('POST', '/users', { name: 'Guest', email: `guest${Date.now()}@example.com` })];
  }
  state.currentUserId = state.users[0].id;
  renderUserSelect();

  await refreshSongs();
  await refreshPlaylists();

  document.getElementById('userSelect').addEventListener('change', (e) => {
    state.currentUserId = Number(e.target.value);
    refreshPlaylists();
  });

  document.getElementById('songForm').addEventListener('submit', onAddSong);
  document.getElementById('songSearch').addEventListener('input', debounce(onSearchSongs, 300));
  document.getElementById('playlistForm').addEventListener('submit', onAddPlaylist);
  document.getElementById('closeDetail').addEventListener('click', closeDetail);
  document.getElementById('editPlaylistForm').addEventListener('submit', onSavePlaylist);
  document.getElementById('deletePlaylistBtn').addEventListener('click', onDeletePlaylist);
  document.getElementById('addSongBtn').addEventListener('click', onAddSongToPlaylist);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- users ----------
function renderUserSelect() {
  const sel = document.getElementById('userSelect');
  sel.innerHTML = state.users.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join('');
  sel.value = state.currentUserId;
}

// ---------- songs (library CRUD) ----------
async function refreshSongs(q) {
  state.songs = await api('GET', q ? `/songs?q=${encodeURIComponent(q)}` : '/songs');
  renderSongsTable();
}

function renderSongsTable() {
  const tbody = document.querySelector('#songsTable tbody');
  tbody.innerHTML = state.songs.map(s => `
    <tr data-id="${s.id}">
      <td>${escapeHtml(s.title)}</td>
      <td>${escapeHtml(s.artist)}</td>
      <td>${escapeHtml(s.album || '—')}</td>
      <td>${escapeHtml(s.genre || '—')}</td>
      <td>${formatDuration(s.duration_seconds)}</td>
      <td class="actions">
        <button data-action="delete-song" data-id="${s.id}">Delete</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6">No tracks yet — add one above.</td></tr>';

  tbody.querySelectorAll('[data-action="delete-song"]').forEach(btn => {
    btn.addEventListener('click', () => onDeleteSong(btn.dataset.id));
  });
}

async function onAddSong(e) {
  e.preventDefault();
  const form = e.target;
  const errEl = document.getElementById('songFormError');
  errEl.textContent = '';
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await api('POST', '/songs', payload);
    form.reset();
    await refreshSongs();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

async function onDeleteSong(id) {
  if (!confirm('Remove this track from the library? It will also be removed from any playlists.')) return;
  await api('DELETE', `/songs/${id}`);
  await refreshSongs();
  if (state.openPlaylistId) openPlaylistDetail(state.openPlaylistId);
}

function onSearchSongs(e) {
  refreshSongs(e.target.value.trim());
}

// ---------- playlists CRUD ----------
async function refreshPlaylists() {
  state.playlists = await api('GET', '/playlists');
  renderPlaylistGrid();
}

function renderPlaylistGrid() {
  const grid = document.getElementById('playlistGrid');
  const mine = state.playlists.filter(p => p.user_id === state.currentUserId);
  grid.innerHTML = mine.map(p => `
    <div class="playlist-card" data-id="${p.id}">
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.description || 'No description')}</p>
      <div class="meta">${p.song_count} track${p.song_count === 1 ? '' : 's'}</div>
    </div>
  `).join('') || '<p>No playlists yet — create one above.</p>';

  grid.querySelectorAll('.playlist-card').forEach(card => {
    card.addEventListener('click', () => openPlaylistDetail(card.dataset.id));
  });
}

async function onAddPlaylist(e) {
  e.preventDefault();
  const form = e.target;
  const errEl = document.getElementById('playlistFormError');
  errEl.textContent = '';
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.user_id = state.currentUserId;
  try {
    await api('POST', '/playlists', payload);
    form.reset();
    await refreshPlaylists();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

// ---------- playlist detail + add/remove song workflow ----------
async function openPlaylistDetail(id) {
  state.openPlaylistId = Number(id);
  const playlist = await api('GET', `/playlists/${id}`);
  document.getElementById('detail-panel').hidden = false;
  document.getElementById('detailName').textContent = playlist.name;

  const editForm = document.getElementById('editPlaylistForm');
  editForm.name.value = playlist.name;
  editForm.description.value = playlist.description || '';

  const list = document.getElementById('playlistSongsList');
  list.innerHTML = playlist.songs.map(s => `
    <li data-song-id="${s.id}">
      <span><span class="pos">${s.position}.</span>${escapeHtml(s.title)} — ${escapeHtml(s.artist)} (${formatDuration(s.duration_seconds)})</span>
      <button data-action="remove">Remove</button>
    </li>
  `).join('') || '<li>No tracks in this playlist yet.</li>';

  list.querySelectorAll('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const songId = e.target.closest('li').dataset.songId;
      await api('DELETE', `/playlists/${id}/songs/${songId}`);
      await refreshPlaylists();
      openPlaylistDetail(id);
    });
  });

  const existingIds = new Set(playlist.songs.map(s => s.id));
  const addSel = document.getElementById('addSongSelect');
  const options = state.songs.filter(s => !existingIds.has(s.id));
  addSel.innerHTML = options.length
    ? options.map(s => `<option value="${s.id}">${escapeHtml(s.title)} — ${escapeHtml(s.artist)}</option>`).join('')
    : '<option value="">All tracks already in this playlist</option>';

  document.getElementById('deletePlaylistBtn').dataset.id = id;
  document.getElementById('addSongError').textContent = '';
}

function closeDetail() {
  document.getElementById('detail-panel').hidden = true;
  state.openPlaylistId = null;
}

async function onSavePlaylist(e) {
  e.preventDefault();
  const id = state.openPlaylistId;
  const payload = Object.fromEntries(new FormData(e.target).entries());
  await api('PUT', `/playlists/${id}`, payload);
  await refreshPlaylists();
  document.getElementById('detailName').textContent = payload.name;
}

async function onDeletePlaylist() {
  const id = state.openPlaylistId;
  if (!confirm('Delete this playlist? This cannot be undone.')) return;
  await api('DELETE', `/playlists/${id}`);
  closeDetail();
  await refreshPlaylists();
}

async function onAddSongToPlaylist() {
  const id = state.openPlaylistId;
  const songId = document.getElementById('addSongSelect').value;
  const errEl = document.getElementById('addSongError');
  errEl.textContent = '';
  if (!songId) { errEl.textContent = 'Pick a track first'; return; }
  try {
    await api('POST', `/playlists/${id}/songs`, { song_id: Number(songId) });
    await refreshPlaylists();
    openPlaylistDetail(id);
  } catch (err) {
    errEl.textContent = err.message;
  }
}

// ---------- utils ----------
function formatDuration(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

init();
