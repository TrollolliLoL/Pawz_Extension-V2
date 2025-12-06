/**
 * PAWZ V2 - Parser HTML
 * @module lib/parser
 * 
 * Nettoie le HTML avant envoi à Gemini pour réduire la consommation de tokens.
 * Objectif : Réduire la taille du payload de 50% à 70%.
 */

/**
 * Liste des sélecteurs CSS à supprimer du DOM.
 * Ces éléments n'apportent aucune info utile pour l'analyse de CV.
 */
const SELECTORS_TO_REMOVE = [
    'script',
    'style',
    'noscript',
    'nav',
    'footer',
    'header',
    'aside',
    'svg',
    'iframe',
    'video',
    'audio',
    'canvas',
    'form',
    'button',
    'input',
    // Publicités et tracking courants
    '[role="banner"]',
    '[role="navigation"]',
    '[role="complementary"]',
    '[role="contentinfo"]',
    '[class*="ad-"]',
    '[class*="advertisement"]',
    '[class*="sidebar"]',
    '[class*="cookie"]',
    '[class*="popup"]',
    '[class*="modal"]',
    '[id*="cookie"]',
    '[id*="popup"]'
];

/**
 * Limite de caractères pour le truncate (environ 6000 tokens).
 * Les infos clés (XP, Compétences) sont généralement au début.
 */
const MAX_CHAR_LENGTH = 25000;

/**
 * Nettoie le contenu HTML en supprimant les éléments inutiles.
 * @param {string} htmlContent - Contenu HTML brut ou texte
 * @returns {string} Texte nettoyé
 */
export function cleanHtml(htmlContent) {
    if (!htmlContent || typeof htmlContent !== 'string') {
        return '';
    }

    try {
        // Créer un DOM virtuel pour parser le HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');

        // Supprimer tous les éléments inutiles
        SELECTORS_TO_REMOVE.forEach(selector => {
            try {
                const elements = doc.querySelectorAll(selector);
                elements.forEach(el => el.remove());
            } catch (e) {
                // Ignorer les sélecteurs invalides
            }
        });

        // Supprimer les commentaires HTML
        const walker = doc.createTreeWalker(
            doc.body,
            NodeFilter.SHOW_COMMENT,
            null,
            false
        );
        const comments = [];
        while (walker.nextNode()) {
            comments.push(walker.currentNode);
        }
        comments.forEach(comment => comment.remove());

        // Extraire le texte propre
        let text = doc.body.innerText || doc.body.textContent || '';

        // Nettoyer les espaces multiples et lignes vides
        text = text
            .replace(/\s+/g, ' ')           // Espaces multiples -> un seul
            .replace(/\n{3,}/g, '\n\n')     // Max 2 sauts de ligne
            .trim();

        return text;
    } catch (error) {
        console.error('[Parser] Erreur cleanHtml:', error);
        // Fallback : retourner le texte brut nettoyé basiquement
        return htmlContent
            .replace(/<[^>]*>/g, ' ')       // Supprimer toutes les balises
            .replace(/\s+/g, ' ')
            .trim();
    }
}

/**
 * Tronque le texte s'il dépasse la limite.
 * Coupe proprement à la fin d'une phrase si possible.
 * @param {string} text - Texte à tronquer
 * @param {number} [maxLength=MAX_CHAR_LENGTH] - Longueur max
 * @returns {string} Texte tronqué
 */
export function truncateText(text, maxLength = MAX_CHAR_LENGTH) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    if (text.length <= maxLength) {
        return text;
    }

    // Couper à maxLength
    let truncated = text.substring(0, maxLength);

    // Essayer de couper proprement à la fin d'une phrase
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');
    const cutPoint = Math.max(lastPeriod, lastNewline);

    if (cutPoint > maxLength * 0.8) {
        // Couper à la fin de phrase si c'est assez proche
        truncated = truncated.substring(0, cutPoint + 1);
    }

    console.log(`[Parser] Texte tronqué: ${text.length} -> ${truncated.length} caractères`);
    return truncated + '\n[... contenu tronqué ...]';
}

/**
 * Pipeline complet de nettoyage pour un profil web.
 * @param {string} rawContent - Contenu brut (HTML ou texte)
 * @returns {string} Contenu prêt pour Gemini
 */
export function prepareForAnalysis(rawContent) {
    const cleaned = cleanHtml(rawContent);
    return truncateText(cleaned);
}
