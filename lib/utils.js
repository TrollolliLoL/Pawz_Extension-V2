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
