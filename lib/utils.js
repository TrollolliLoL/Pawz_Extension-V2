/**
 * PAWZ V2 - Utilitaires Partagés
 * @module lib/utils
 */

/**
 * Génère un UUID v4 unique pour les IDs candidats et jobs.
 * Utilise crypto.randomUUID() si disponible, sinon fallback manuel.
 * @returns {string} UUID au format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
export function generateUUID() {
    // Méthode native (Chrome 92+)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback pour environnements plus anciens
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Retourne le timestamp Unix actuel (en secondes).
 * @returns {number} Timestamp en secondes
 */
export function timestamp() {
    return Math.floor(Date.now() / 1000);
}

/**
 * Formate une date pour l'affichage (FR).
 * @param {number} ts - Timestamp Unix en secondes
 * @returns {string} Date formatée (ex: "06/12/2025 15:30")
 */
export function formatDate(ts) {
    const date = new Date(ts * 1000);
    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Vérifie le Kill Switch distant.
 * @returns {Promise<{active: boolean, message: string}>}
 */
export async function checkKillSwitch() {
    const KILL_SWITCH_URL = 'https://gist.githubusercontent.com/TrollolliLoL/2d2bf6ad500c5bde53f58c66a3bffddd/raw/gistfile1.txt';
    const CACHE_KEY = 'pawz_kill_switch';
    const CACHE_DURATION = 2 * 60; // 2 minutes en secondes
    
    try {
        console.log('[KillSwitch] Vérification du statut...');
        
        // Vérifier le cache
        const cached = await chrome.storage.local.get(CACHE_KEY);
        if (cached[CACHE_KEY]) {
            const { data, timestamp: ts } = cached[CACHE_KEY];
            const age = timestamp() - ts;
            
            console.log('[KillSwitch] Cache trouvé, âge:', age, 's');
            
            // Si cache valide (< 10 min), utiliser
            if (age < CACHE_DURATION) {
                console.log('[KillSwitch] Utilisation du cache:', data);
                return {
                    active: data.status === 'active',
                    message: data.message || ''
                };
            }
        }
        
        // Fetch distant
        console.log('[KillSwitch] Fetch depuis:', KILL_SWITCH_URL);
        const response = await fetch(KILL_SWITCH_URL, {
            cache: 'no-cache',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!response.ok) {
            console.warn('[KillSwitch] Erreur HTTP:', response.status);
            // En cas d'erreur réseau, autoriser par défaut
            return { active: true, message: '' };
        }
        
        const data = await response.json();
        console.log('[KillSwitch] Données reçues:', data);
        
        // Mettre en cache
        await chrome.storage.local.set({
            [CACHE_KEY]: {
                data,
                timestamp: timestamp()
            }
        });
        
        const result = {
            active: data.status === 'active',
            message: data.message || ''
        };
        
        console.log('[KillSwitch] Résultat final:', result);
        return result;
        
    } catch (error) {
        console.error('[KillSwitch] Erreur vérification:', error);
        // En cas d'erreur, autoriser par défaut (fail-open)
        return { active: true, message: '' };
    }
}
