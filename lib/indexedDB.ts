import { DB_NAME, DB_VERSION, RECORDS_OBJECT_STORE_NAME } from './constants';

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
        const db = request.result;
        if (db.objectStoreNames.contains('fileHandles')) {
            db.deleteObjectStore('fileHandles');
        }
        if (!db.objectStoreNames.contains(RECORDS_OBJECT_STORE_NAME)) {
            db.createObjectStore(RECORDS_OBJECT_STORE_NAME);
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const idbGet = async (key: string): Promise<any> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORDS_OBJECT_STORE_NAME, 'readonly');
    const store = tx.objectStore(RECORDS_OBJECT_STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const idbSet = async (key: string, value: any): Promise<void> => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RECORDS_OBJECT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(RECORDS_OBJECT_STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const idbClear = async (): Promise<void> => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RECORDS_OBJECT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(RECORDS_OBJECT_STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
