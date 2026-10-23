import { openDB, DBSchema, IDBPDatabase } from 'idb';


export interface DrinkRecord {
    id: number;
    name: string;
    caffeineMg: number;
    timestamp: number;
    stomachState?: 'empty' | 'full'; // Yeni eklenen özellik
}

export interface CircadiaDB extends DBSchema {
    history: {
        key: number;
        value: DrinkRecord;
    };
    settings: {
        key: string;
        value: any;
    };
}

const DB_NAME = 'circadia-db';
const DB_VERSION = 1;

export async function initDB(): Promise<IDBPDatabase<CircadiaDB>> {
    return openDB<CircadiaDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('history')) {
                db.createObjectStore('history', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings');
            }
        },
    });
}

export async function migrateFromLocalStorage() {
    try {
        const db = await initDB();
        const historyJson = localStorage.getItem('circadia_history');
        if (historyJson) {
            const history: DrinkRecord[] = JSON.parse(historyJson);
            const tx = db.transaction('history', 'readwrite');
            for (const record of history) {
                // Eski verilere 'empty' stomachState varsayılanını ata
                if (!record.stomachState) record.stomachState = 'empty';
                await tx.store.put(record);
            }
            await tx.done;
            localStorage.removeItem('circadia_history');
            console.log('Migrated history to IndexedDB');
        }

        const settingsKeys = [
            'circadia_cigs',
            'circadia_tolerance',
            'circadia_is_quit',
            'circadia_days_quit',
            'circadia_prior_cigs',
            'circadia_is_ocp',
            'circadia_red_shift'
        ];

        const tx = db.transaction('settings', 'readwrite');
        let migratedAny = false;
        for (const key of settingsKeys) {
            const val = localStorage.getItem(key);
            if (val !== null) {
                // Try parsing JSON if possible, otherwise store as string
                try {
                    await tx.store.put(JSON.parse(val), key);
                } catch {
                    await tx.store.put(val, key);
                }
                localStorage.removeItem(key);
                migratedAny = true;
            }
        }
        await tx.done;
        if (migratedAny) console.log('Migrated settings to IndexedDB');
    } catch (e) {
        console.error('Migration failed:', e);
    }
}
