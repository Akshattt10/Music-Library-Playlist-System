// server.js — Music Library & Playlist System API
// CSEG2141 Web Technologies Lab — Assignment 3

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// ---------- helpers ----------
function badRequest(res, message) {
  return res.status(400).json({ error: message });
}
function notFound(res, message) {
  return res.status(404).json({ error: message });
}
function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// =========================================================
// USERS (Create / Read / Update / Delete)
// =========================================================
app.post('/api/users', (req, res) => {
  const { name, email } = req.body || {};
  if (!isNonEmptyString(name)) return badRequest(res, 'name is required');
  if (!isNonEmptyString(email) || !email.includes('@')) return badRequest(res, 'a valid email is required');

  try {
    const info = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run(name.trim(), email.trim());
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(user);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return badRequest(res, 'email already exists');
    res.status(500).json({ error: 'could not create user' });
  }
});

app.get('/api/users', (req, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY id DESC').all());
});

app.get('/api/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return notFound(res, 'user not found');
  res.json(user);
});

app.put('/api/users/:id', (req, res) => {
  const { name, email } = req.body || {};
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return notFound(res, 'user not found');
  if (!isNonEmptyString(name)) return badRequest(res, 'name is required');
  if (!isNonEmptyString(email) || !email.includes('@')) return badRequest(res, 'a valid email is required');

  try {
    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name.trim(), email.trim(), req.params.id);
    res.json(db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return badRequest(res, 'email already exists');
    res.status(500).json({ error: 'could not update user' });
  }
});

app.delete('/api/users/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return notFound(res, 'user not found');
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// =========================================================
// SONGS (Create / Read / Update / Delete) — the "library"
// =========================================================
app.post('/api/songs', (req, res) => {
  const { title, artist, album, genre, duration_seconds } = req.body || {};
  if (!isNonEmptyString(title)) return badRequest(res, 'title is required');
  if (!isNonEmptyString(artist)) return badRequest(res, 'artist is required');
  const duration = Number(duration_seconds);
  if (!Number.isFinite(duration) || duration <= 0) return badRequest(res, 'duration_seconds must be a positive number');

  const info = db
    .prepare('INSERT INTO songs (title, artist, album, genre, duration_seconds) VALUES (?, ?, ?, ?, ?)')
    .run(title.trim(), artist.trim(), (album || '').trim() || null, (genre || '').trim() || null, duration);
  res.status(201).json(db.prepare('SELECT * FROM songs WHERE id = ?').get(info.lastInsertRowid));
});

app.get('/api/songs', (req, res) => {
  const { q } = req.query;
  if (q) {
    const like = `%${q}%`;
    return res.json(
      db
        .prepare('SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? ORDER BY id DESC')
        .all(like, like, like)
    );
  }
  res.json(db.prepare('SELECT * FROM songs ORDER BY id DESC').all());
});

app.get('/api/songs/:id', (req, res) => {
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);
  if (!song) return notFound(res, 'song not found');
  res.json(song);
});

app.put('/api/songs/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);
  if (!existing) return notFound(res, 'song not found');
  const { title, artist, album, genre, duration_seconds } = req.body || {};
  if (!isNonEmptyString(title)) return badRequest(res, 'title is required');
  if (!isNonEmptyString(artist)) return badRequest(res, 'artist is required');
  const duration = Number(duration_seconds);
  if (!Number.isFinite(duration) || duration <= 0) return badRequest(res, 'duration_seconds must be a positive number');

  db.prepare('UPDATE songs SET title = ?, artist = ?, album = ?, genre = ?, duration_seconds = ? WHERE id = ?').run(
    title.trim(),
    artist.trim(),
    (album || '').trim() || null,
    (genre || '').trim() || null,
    duration,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id));
});

app.delete('/api/songs/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);
  if (!existing) return notFound(res, 'song not found');
  db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// =========================================================
// PLAYLISTS (Create / Read / Update / Delete)
// =========================================================
app.post('/api/playlists', (req, res) => {
  const { name, user_id, description } = req.body || {};
  if (!isNonEmptyString(name)) return badRequest(res, 'name is required');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  if (!user) return badRequest(res, 'user_id must reference an existing user');

  const info = db
    .prepare('INSERT INTO playlists (name, user_id, description) VALUES (?, ?, ?)')
    .run(name.trim(), user_id, (description || '').trim() || null);
  res.status(201).json(db.prepare('SELECT * FROM playlists WHERE id = ?').get(info.lastInsertRowid));
});

app.get('/api/playlists', (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT p.*, u.name AS owner_name,
                (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS song_count
         FROM playlists p JOIN users u ON u.id = p.user_id
         ORDER BY p.id DESC`
      )
      .all()
  );
});

// Read one playlist WITH its ordered songs — the core "library" workflow view
app.get('/api/playlists/:id', (req, res) => {
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
  if (!playlist) return notFound(res, 'playlist not found');
  const songs = db
    .prepare(
      `SELECT s.*, ps.position, ps.id AS playlist_song_id
       FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id
       WHERE ps.playlist_id = ? ORDER BY ps.position ASC`
    )
    .all(req.params.id);
  res.json({ ...playlist, songs });
});

app.put('/api/playlists/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
  if (!existing) return notFound(res, 'playlist not found');
  const { name, description } = req.body || {};
  if (!isNonEmptyString(name)) return badRequest(res, 'name is required');

  db.prepare('UPDATE playlists SET name = ?, description = ? WHERE id = ?').run(
    name.trim(),
    (description || '').trim() || null,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id));
});

app.delete('/api/playlists/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
  if (!existing) return notFound(res, 'playlist not found');
  db.prepare('DELETE FROM playlists WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// =========================================================
// PLAYLIST <-> SONG workflow: add song, remove song, reorder
// =========================================================
app.post('/api/playlists/:id/songs', (req, res) => {
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
  if (!playlist) return notFound(res, 'playlist not found');
  const { song_id } = req.body || {};
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(song_id);
  if (!song) return badRequest(res, 'song_id must reference an existing song');

  const existingLink = db
    .prepare('SELECT * FROM playlist_songs WHERE playlist_id = ? AND song_id = ?')
    .get(req.params.id, song_id);
  if (existingLink) return badRequest(res, 'this song is already in the playlist');

  const maxPos =
    db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM playlist_songs WHERE playlist_id = ?').get(req.params.id)
      .m;

  const info = db
    .prepare('INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)')
    .run(req.params.id, song_id, maxPos + 1);

  res.status(201).json({ id: info.lastInsertRowid, playlist_id: Number(req.params.id), song_id, position: maxPos + 1 });
});

app.delete('/api/playlists/:id/songs/:songId', (req, res) => {
  const link = db
    .prepare('SELECT * FROM playlist_songs WHERE playlist_id = ? AND song_id = ?')
    .get(req.params.id, req.params.songId);
  if (!link) return notFound(res, 'song is not in this playlist');
  db.prepare('DELETE FROM playlist_songs WHERE id = ?').run(link.id);
  res.json({ removed: true });
});

app.put('/api/playlists/:id/songs/:songId/position', (req, res) => {
  const { position } = req.body || {};
  const pos = Number(position);
  if (!Number.isFinite(pos) || pos <= 0) return badRequest(res, 'position must be a positive number');
  const link = db
    .prepare('SELECT * FROM playlist_songs WHERE playlist_id = ? AND song_id = ?')
    .get(req.params.id, req.params.songId);
  if (!link) return notFound(res, 'song is not in this playlist');
  db.prepare('UPDATE playlist_songs SET position = ? WHERE id = ?').run(pos, link.id);
  res.json({ updated: true });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Music Library & Playlist System running on http://localhost:${PORT}`);
});
