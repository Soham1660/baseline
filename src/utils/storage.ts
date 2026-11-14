import type { ApartmentRecord } from '../types/baseline';

const STORAGE_KEY = 'baseline_apartments_v1';
const DB_NAME = 'baseline_video_vault_v1';
const STORE_NAME = 'videos';

function openVideoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveVideoBlob(videoId: string, blob: Blob): Promise<void> {
  try {
    const db = await openVideoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, videoId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Non-fatal if IndexedDB unavailable in private browsing
  }
}

export async function loadVideoBlobUrl(videoId: string): Promise<string | null> {
  try {
    const db = await openVideoDb();
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(videoId);
      req.onsuccess = () => resolve(req.result as Blob | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (blob instanceof Blob) {
      return URL.createObjectURL(blob);
    }
    return null;
  } catch {
    return null;
  }
}

export async function deleteVideoBlob(videoId: string): Promise<void> {
  try {
    const db = await openVideoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(videoId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Non-fatal
  }
}

export function loadSavedApartments(): ApartmentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ApartmentRecord[];
  } catch {
    return [];
  }
}

export function persistApartments(apartments: ApartmentRecord[]): void {
  try {
    // Strip transient blob: objectUrls before writing to localStorage; restore from serverFileId or IndexedDB on load
    const serializable = apartments.map((apt) => ({
      ...apt,
      moveInVideo: apt.moveInVideo
        ? {
            ...apt.moveInVideo,
            objectUrl: apt.moveInVideo.objectUrl?.startsWith('blob:')
              ? undefined
              : apt.moveInVideo.objectUrl,
          }
        : undefined,
      moveOutVideo: apt.moveOutVideo
        ? {
            ...apt.moveOutVideo,
            objectUrl: apt.moveOutVideo.objectUrl?.startsWith('blob:')
              ? undefined
              : apt.moveOutVideo.objectUrl,
          }
        : undefined,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // Ignore storage quota issues cleanly
  }
}
