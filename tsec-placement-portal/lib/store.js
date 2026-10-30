/**
 * store.js — where the database file and uploaded resumes are kept
 * ----------------------------------------------------------------------------
 * Two modes:
 *   - Laptop (npm start):   files on disk, in data/ and uploads/resumes/
 *   - Netlify (online):     Netlify Blobs (Netlify's built-in file storage),
 *                           because Netlify Functions have no lasting disk.
 * Netlify mode is switched on by netlify/functions/api.js, which sets
 * PORTAL_STORAGE=blobs before anything else loads.
 */
const isBlobs = () => process.env.PORTAL_STORAGE === 'blobs';

let store = null;
function blobs() {
  if (!store) {
    const { getStore } = require('@netlify/blobs');
    // "strong" = every function instance sees the latest write immediately.
    store = getStore({ name: 'tsec-portal', consistency: 'strong' });
  }
  return store;
}

const DB_KEY = 'db/portal.db';

/** @returns {Promise<{data: Uint8Array, etag: string} | null>} */
async function readDb() {
  const r = await blobs().getWithMetadata(DB_KEY, { type: 'arrayBuffer' });
  if (!r || !r.data) return null;
  return { data: new Uint8Array(r.data), etag: r.etag };
}

/** @returns {Promise<string|null>} the current etag, or null if no DB saved yet */
async function dbEtag() {
  const m = await blobs().getMetadata(DB_KEY);
  return m ? m.etag : null;
}

/** @returns {Promise<string|null>} the new etag */
async function writeDb(bytes) {
  const r = await blobs().set(DB_KEY, bytes);
  return (r && r.etag) || (await dbEtag());
}

async function putFile(key, buffer) { await blobs().set('files/' + key, buffer); }
async function getFile(key) {
  const ab = await blobs().get('files/' + key, { type: 'arrayBuffer' });
  return ab ? Buffer.from(ab) : null;
}
async function deleteFile(key) { try { await blobs().delete('files/' + key); } catch { /* ignore */ } }

module.exports = { isBlobs, readDb, dbEtag, writeDb, putFile, getFile, deleteFile };
