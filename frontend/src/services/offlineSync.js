import { openDB } from 'idb';
import toast from 'react-hot-toast';

const DB_NAME = 'payroll-offline-db';
const DB_VERSION = 1;
const SYNC_STORE = 'sync-queue';

export async function initDB() {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(SYNC_STORE)) {
                // We use autoIncrement to process sequentially
                db.createObjectStore(SYNC_STORE, { keyPath: 'id', autoIncrement: true });
            }
        },
    });
}

/**
 * Stores an action in IndexedDB if the network is unavailable.
 * @param {string} actionName - Name of the api function (e.g., 'markAttendance')
 * @param {object} payload - The body to send
 */
export async function queueOfflineAction(actionName, payload) {
    const db = await initDB();
    const tx = db.transaction(SYNC_STORE, 'readwrite');
    await tx.store.add({
        actionName,
        payload,
        timestamp: new Date().toISOString()
    });
    await tx.done;
    toast('Saved offline. Will sync when connection returns.', { icon: '📶', duration: 4000 });
}

/**
 * Attempts to push queued actions to the backend.
 * @param {object} apiModule - The imported api.js to dynamically call functions
 */
export async function syncOfflineQueue(apiModule) {
    if (!navigator.onLine) return;

    const db = await initDB();
    const tx = db.transaction(SYNC_STORE, 'readonly');
    const allItems = await tx.store.getAll();
    await tx.done;

    if (allItems.length === 0) return;

    toast.loading(`Syncing ${allItems.length} offline actions...`, { id: 'sync-toast' });

    let successCount = 0;
    for (const item of allItems) {
        try {
            if (typeof apiModule[item.actionName] === 'function') {
                // Execute the stored API call
                await apiModule[item.actionName](item.payload, true);
                
                // If successful, delete from queue
                const delTx = db.transaction(SYNC_STORE, 'readwrite');
                await delTx.store.delete(item.id);
                await delTx.done;
                successCount++;
            }
        } catch (error) {
            console.error(`Failed to sync offline action: ${item.actionName}`, error);
        }
    }

    if (successCount > 0) {
        toast.success(`Successfully synced ${successCount} items.`, { id: 'sync-toast' });
    } else {
        toast.dismiss('sync-toast');
    }
}
