/**
 * session-store.js — keeps login sessions in the SQLite database.
 * Used on Netlify, where each request may be handled by a different server
 * instance, so sessions can't live in one instance's memory.
 */
const session = require('express-session');
const db = require('../db');

class SqliteSessionStore extends session.Store {
  constructor() {
    super();
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      sid     TEXT PRIMARY KEY,
      sess    TEXT NOT NULL,
      expires INTEGER NOT NULL)`);
  }

  get(sid, cb) {
    try {
      const row = db.get('SELECT sess, expires FROM sessions WHERE sid = ?', [sid]);
      if (!row) return cb(null, null);
      if (row.expires < Date.now()) { db.run('DELETE FROM sessions WHERE sid = ?', [sid]); return cb(null, null); }
      cb(null, JSON.parse(row.sess));
    } catch (e) { cb(e); }
  }

  set(sid, sess, cb) {
    try {
      const expires = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 8 * 3600 * 1000;
      db.run('INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires',
        [sid, JSON.stringify(sess), expires]);
      // Housekeeping: drop expired sessions now and then.
      if (Math.random() < 0.05) db.run('DELETE FROM sessions WHERE expires < ?', [Date.now()]);
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }

  destroy(sid, cb) {
    try { db.run('DELETE FROM sessions WHERE sid = ?', [sid]); cb && cb(null); } catch (e) { cb && cb(e); }
  }

  // Sessions last 8 hours from login; no write needed on every page view.
  touch(sid, sess, cb) { cb && cb(null); }
}

/** A secret kept inside the database, so every server instance uses the same one. */
function storedSecret() {
  db.run('CREATE TABLE IF NOT EXISTS app_kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const row = db.get("SELECT value FROM app_kv WHERE key = 'session_secret'");
  if (row) return row.value;
  const value = require('crypto').randomBytes(32).toString('hex');
  db.run("INSERT INTO app_kv (key, value) VALUES ('session_secret', ?)", [value]);
  return value;
}

module.exports = { SqliteSessionStore, storedSecret };
