// db.js — SQLite connection + schema setup for Music Library & Playlist System
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'music_library.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  genre TEXT,
  duration_seconds INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL,
  song_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  added_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
  UNIQUE(playlist_id, song_id)
);
`);

// Seed a demo user + a few songs on first run so the app isn't empty
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Akshat Mehta', 'akshat.mehta@example.com');

  const insertSong = db.prepare(
    'INSERT INTO songs (title, artist, album, genre, duration_seconds) VALUES (?, ?, ?, ?, ?)'
  );
  const demoSongs = [
    ['Blinding Lights', 'The Weeknd', 'After Hours', 'Synth-pop', 200],
    ['Bohemian Rhapsody', 'Queen', 'A Night at the Opera', 'Rock', 355],
    ['Levitating', 'Dua Lipa', 'Future Nostalgia', 'Pop', 203],
    ['Kal Ho Naa Ho', 'Sonu Nigam', 'Kal Ho Naa Ho', 'Bollywood', 297],
  ];
  for (const s of demoSongs) insertSong.run(...s);
}

module.exports = db;
