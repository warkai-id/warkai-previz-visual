const DB = 'warkai-previz';
let dbPromise;
function db() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('projects');
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  return dbPromise;
}
export async function loadProject() {
  const d = await db(); return new Promise((resolve, reject) => { const r = d.transaction('projects').objectStore('projects').get('current'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
export async function saveProject(p) {
  const d = await db(); return new Promise((resolve, reject) => { const tx = d.transaction('projects', 'readwrite'); tx.objectStore('projects').put(p, 'current'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
