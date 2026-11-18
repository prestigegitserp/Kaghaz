import { emptyState, parseState, STORAGE_KEY, type SavedState } from './model.ts';
export function loadState(): SavedState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return emptyState();
        const value = JSON.parse(raw);
        const state = parseState(value);
        // Locally persisted references may be restored; imported JSON never gains this privilege.
        for (const b of state.customBooths) {
            const source = value.customBooths?.find((v: {
                id: string;
            }) => v.id === b.id);
            if (source?.modelKey === `model:${b.id}`)
                b.modelKey = source.modelKey;
            if (source?.catalogKey === `catalog:${b.id}`)
                b.catalogKey = source.catalogKey;
        }
        return state;
    }
    catch {
        return emptyState();
    }
}
export function saveState(state: SavedState): boolean {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    }
    catch {
        return false;
    }
}
let dbPromise: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
    return dbPromise ||= new Promise((resolve, reject) => {
        const request = indexedDB.open('kaghaz.assets.v4', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('assets');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function putAsset(key: string, blob: Blob): Promise<void> {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
        const tx = database.transaction('assets', 'readwrite');
        tx.objectStore('assets').put(blob, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}
export async function getAsset(key: string): Promise<Blob | undefined> {
    const database = await db();
    return new Promise((resolve, reject) => {
        const request = database.transaction('assets').objectStore('assets').get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function deleteAsset(key: string): Promise<void> {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
        const tx = database.transaction('assets', 'readwrite');
        tx.objectStore('assets').delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
export function download(name: string, data: string | Blob, type = 'text/plain;charset=utf-8'): void {
    const blob = typeof data === 'string' ? new Blob(['\uFEFF', data], { type }) : data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
