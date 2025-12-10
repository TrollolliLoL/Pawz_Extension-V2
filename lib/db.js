/**
 * PAWZ V2 - Wrapper IndexedDB
 * @module lib/db
 * 
 * Gère le stockage des payloads lourds (textes/PDFs Base64).
 * Séparé de chrome.storage.local pour ne pas bloquer l'UI.
 */

const DB_NAME = 'pawz_db';
const DB_VERSION = 1;
const STORE_NAME = 'payloads';

let dbInstance = null;

/**
 * Ouvre ou crée la base IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('[DB] Erreur ouverture IndexedDB:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Créer le store "payloads" si inexistant
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('created_at', 'created_at', { unique: false });
            }
        };
    });
}

/**
 * Récupère l'instance de DB (singleton pattern).
 * @returns {Promise<IDBDatabase>}
 */
async function getDB() {
    if (!dbInstance) {
        dbInstance = await openDatabase();
    }
    return dbInstance;
}

/**
 * Wrapper IndexedDB pour les opérations sur les payloads.
 */
export const db = {
    /**
     * Initialise la connexion IndexedDB.
     * À appeler au démarrage du Service Worker.
     * @returns {Promise<void>}
     */
    async init() {
        try {
            await getDB();
            console.log('[DB] Initialisation réussie');
        } catch (error) {
            console.error('[DB] Échec initialisation:', error);
            throw error;
        }
    },

    /**
     * Sauvegarde un payload lourd dans IndexedDB.
     * @param {string} id - ID du candidat (clé primaire)
     * @param {string} type - Type de contenu: "text" ou "base64"
     * @param {string} content - Le contenu brut (texte ou PDF encodé)
     * @returns {Promise<void>}
     */
    async savePayload(id, type, content) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                
                const payload = {
                    id,
                    type,
                    content,
                    created_at: Math.floor(Date.now() / 1000)
                };

                const request = store.put(payload);
                
                request.onerror = () => {
                    console.error('[DB] Erreur savePayload:', request.error);
                    reject(request.error);
                };
                
                request.onsuccess = () => {
                    resolve();
                };
            });
        } catch (error) {
            console.error('[DB] savePayload failed:', error);
            throw error;
        }
    },

    /**
     * Récupère un payload par son ID.
     * @param {string} id - ID du candidat
     * @returns {Promise<Object|null>} Le payload ou null si non trouvé
     */
    async getPayload(id) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(id);

                request.onerror = () => {
                    console.error('[DB] Erreur getPayload:', request.error);
                    reject(request.error);
                };

                request.onsuccess = () => {
                    resolve(request.result || null);
                };
            });
        } catch (error) {
            console.error('[DB] getPayload failed:', error);
            throw error;
        }
    },

    /**
     * Supprime un payload (Flush après analyse réussie).
     * @param {string} id - ID du candidat
     * @returns {Promise<void>}
     */
    async deletePayload(id) {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(id);

                request.onerror = () => {
                    console.error('[DB] Erreur deletePayload:', request.error);
                    reject(request.error);
                };

                request.onsuccess = () => {
                    resolve();
                };
            });
        } catch (error) {
            console.error('[DB] deletePayload failed:', error);
            throw error;
        }
    },

    /**
     * Vide complètement le store (Reset/Désinstallation).
     * @returns {Promise<void>}
     */
    async clearAll() {
        try {
            const db = await getDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();

                request.onerror = () => {
                    console.error('[DB] Erreur clearAll:', request.error);
                    reject(request.error);
                };

                request.onsuccess = () => {
                    resolve();
                };
            });
        } catch (error) {
            console.error('[DB] clearAll failed:', error);
            throw error;
        }
    }
};
