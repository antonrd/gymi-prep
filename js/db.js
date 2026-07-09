// db.js — thin IndexedDB wrapper (Promise-based, no dependencies).
//
// One store: `attempts`. Each attempt records the settings, the generated exercise
// (as serializable specs), per-example answers/correctness, timing, and score.
// Incomplete attempts (status 'in_progress') can be resumed.

const DB_NAME = 'gymi-prep';
const DB_VERSION = 1;
const STORE = 'attempts';

let _dbPromise = null;

function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('startedAt', 'startedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const store = t.objectStore(STORE);
        let result;
        Promise.resolve(fn(store)).then((r) => {
          result = r;
        });
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function reqAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function isAvailable() {
  return typeof indexedDB !== 'undefined';
}

/** Save (create or overwrite) an attempt record. */
export async function saveAttempt(attempt) {
  await tx('readwrite', (store) => store.put(attempt));
  return attempt.id;
}

export async function getAttempt(id) {
  return tx('readonly', (store) => reqAsPromise(store.get(id)));
}

/** All attempts, newest-started first. */
export async function getAllAttempts() {
  const all = await tx('readonly', (store) => reqAsPromise(store.getAll()));
  return all.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
}

/** The most recent still-in-progress attempt, or null. */
export async function getResumableAttempt() {
  const all = await getAllAttempts();
  return all.find((a) => a.status === 'in_progress') || null;
}

export async function deleteAttempt(id) {
  await tx('readwrite', (store) => store.delete(id));
}

/** Sum of `score` across all completed attempts (the lifetime total). */
export async function getTotalScore() {
  const all = await getAllAttempts();
  return all
    .filter((a) => a.status === 'completed')
    .reduce((sum, a) => sum + (a.score || 0), 0);
}
