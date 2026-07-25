# Crate — Music Library & Playlist System

**CSEG2141 — Web Technologies Lab, Assignment 3**
**Student:** Akshat Mehta (SAP ID 500110479, BTech_CS_CCVT)

A database-connected web application for managing a music library and building
playlists. Users, songs, playlists and playlist entries are all persisted in a
SQLite database. The app implements full CRUD for songs and playlists, plus a
complete add-to-playlist / remove-from-playlist workflow, with input validation
and error handling throughout.

## Tech stack

- **Backend:** Node.js + Express
- **Database:** SQLite (via `better-sqlite3`) — a single-file database, ideal for
  this assignment's scope and for free-tier deployment
- **Frontend:** Vanilla HTML/CSS/JS (served as static files by Express), calling
  the backend's REST API with `fetch`

## Data model / schema

```
users (id, name, email UNIQUE, created_at)
songs (id, title, artist, album, genre, duration_seconds, created_at)
playlists (id, name, user_id -> users.id, description, created_at)
playlist_songs (id, playlist_id -> playlists.id, song_id -> songs.id, position, added_at)
                 UNIQUE(playlist_id, song_id)
```

- A **user** owns many **playlists**.
- A **playlist** contains many **songs**, via the join table `playlist_songs`,
  which also stores each song's `position` in the playlist (ordering) and
  enforces that a song can't be added to the same playlist twice.
- Deleting a user cascades to their playlists; deleting a playlist or a song
  cascades to the relevant `playlist_songs` rows. Foreign keys are enforced
  (`PRAGMA foreign_keys = ON`).

The schema is created automatically on first run inside `db.js` — there is no
separate migration step to run. A demo user ("Akshat Mehta") and four demo
songs are seeded the first time the database is empty, purely so the UI isn't
blank on first load; delete `music_library.db` at any time to reset to a clean
slate.

## End-to-end workflow implemented

1. Add songs to the shared **library** (Create).
2. Browse/search the library (Read).
3. Edit or remove a library track (Update / Delete).
4. Create a **playlist** under the current user (Create).
5. Open a playlist and **add tracks from the library** to it (Create, join
   table) — a track can't be added twice, and adding a non-existent track is
   rejected.
6. **Remove** a track from a playlist without deleting it from the library
   (Delete, join table).
7. Rename/edit a playlist's description (Update) or delete it entirely,
   which also clears its playlist_songs rows (Delete).

All of the above are backed by real API calls with server-side validation
(required fields, valid email format, positive duration, and foreign-key
existence checks) and proper HTTP status codes (`400` for validation errors,
`404` for missing resources, `201` for created resources).

## API reference

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/users` | Create user |
| GET | `/api/users`, `/api/users/:id` | List / read user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |
| POST | `/api/songs` | Add track to library |
| GET | `/api/songs`, `/api/songs?q=` | List / search tracks |
| GET | `/api/songs/:id` | Read one track |
| PUT | `/api/songs/:id` | Update track |
| DELETE | `/api/songs/:id` | Remove track |
| POST | `/api/playlists` | Create playlist |
| GET | `/api/playlists` | List playlists (with owner + track count) |
| GET | `/api/playlists/:id` | Read playlist with its ordered tracks |
| PUT | `/api/playlists/:id` | Rename / edit playlist |
| DELETE | `/api/playlists/:id` | Delete playlist |
| POST | `/api/playlists/:id/songs` | Add a track to a playlist `{ song_id }` |
| DELETE | `/api/playlists/:id/songs/:songId` | Remove a track from a playlist |
| PUT | `/api/playlists/:id/songs/:songId/position` | Reorder a track within a playlist |

## Running locally

```bash
npm install
npm start
```

Then open **http://localhost:3000**. The server serves both the API (`/api/...`)
and the frontend (`/`) from the same Express app, on the port from the `PORT`
environment variable (default `3000`).

## Deployment (Render)

1. Push this project to a GitHub repository.
2. On [render.com](https://render.com), create a **New Web Service** and
   connect the repo.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment:** Node
4. Render auto-assigns `PORT`; the app already reads `process.env.PORT`, so no
   extra config is needed. Add a **Disk** (Render's persistent disk add-on) if
   you want the SQLite file to survive restarts/redeploys — otherwise on the
   free tier the file resets on each redeploy, which is fine for demo
   purposes.
5. Once deployed, Render gives you a public URL like
   `https://crate-music-library.onrender.com` — that's the submission URL.

(Vercel and Netlify are better suited to serverless/static apps; since this
project needs a persistent SQLite file and a long-running Express server,
Render — or any host that runs a normal Node process, e.g. Railway or
Fly.io — is the simplest fit for a "suitable public platform" per the brief.)

## Project structure

```
music-library/
├── server.js        # Express app + all REST API routes
├── db.js             # SQLite connection, schema, demo seed data
├── package.json
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js         # Frontend logic (fetch calls to the API)
└── README.md
```

## Notes on validation & error handling

- Every write endpoint checks required fields and returns `400` with a
  human-readable message on failure (e.g. missing title, invalid email,
  non-positive duration, non-existent `user_id`/`song_id`).
- Every read/update/delete-by-id endpoint returns `404` if the record doesn't
  exist, instead of silently succeeding.
- Adding a song already in a playlist, or a song that doesn't exist, is
  rejected with a clear `400` error rather than a database crash.
