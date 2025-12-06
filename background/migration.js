/**
 * PAWZ V2 - Script de Migration V1 -> V2
 * @module background/migration
 * 
 * Transforme les données de l'ancienne version en format V2.
 * Exécuté une seule fois lors de la mise à jour.
 */

import { generateUUID, timestamp } from '../lib/utils.js';

/**
 * Exécute la migration des données V1 vers V2.
 * @returns {Promise<Object>} Résultat de la migration
 */
export async function migrateV1toV2() {
    console.log('[Migration] Démarrage migration V1 -> V2...');

    try {
        // Récupérer les anciennes clés V1
        const v1Data = await chrome.storage.local.get([
            'pawz_search_criteria',
            'pawz_gemini_key',
            // Autres clés V1 potentielles
            'pawz_favorites',
            'pawz_domain_settings'
        ]);

        // Vérifier si migration nécessaire
        const hasV1Data = v1Data.pawz_search_criteria || v1Data.pawz_gemini_key;
        if (!hasV1Data) {
            console.log('[Migration] Aucune donnée V1 détectée');
            return { migrated: false, reason: 'NO_V1_DATA' };
        }

        // Récupérer les données V2 existantes
        const v2Data = await chrome.storage.local.get([
            'pawz_jobs',
            'pawz_candidates',
            'pawz_settings'
        ]);

        const result = {
            migrated: true,
            apiKeyMigrated: false,
            jobCreated: false,
            favoritesMigrated: 0
        };

        // --- Migration de la clé API ---
        let settings = v2Data.pawz_settings || {
            api_key: '',
            model_id: 'gemini-2.5-flash'
        };

        if (v1Data.pawz_gemini_key && !settings.api_key) {
            settings.api_key = v1Data.pawz_gemini_key;
            result.apiKeyMigrated = true;
            console.log('[Migration] Clé API migrée');
        }

        // --- Migration des critères de recherche en Job ---
        let jobs = v2Data.pawz_jobs || [];

        if (v1Data.pawz_search_criteria) {
            const criteria = v1Data.pawz_search_criteria;

            const migratedJob = {
                id: `job_${timestamp()}_${generateUUID().substring(0, 8)}`,
                title: extractJobTitle(criteria) || 'Mon Poste (Importé V1)',
                raw_brief: criteria.brief || criteria.rawBrief || '',
                criteria: {
                    must_have: normalizeCriteria(criteria.mustCriteria || criteria.must_have || []),
                    nice_to_have: normalizeCriteria(criteria.niceCriteria || criteria.nice_to_have || [])
                },
                created_at: timestamp(),
                active: true
            };

            // Désactiver les autres jobs existants
            jobs.forEach(job => job.active = false);

            // Ajouter le job migré
            jobs.push(migratedJob);
            result.jobCreated = true;
            
            console.log('[Migration] Critères migrés en Job:', migratedJob.title);
        }

        // --- Migration des favoris (si présents) ---
        if (v1Data.pawz_favorites && Array.isArray(v1Data.pawz_favorites)) {
            for (const fav of v1Data.pawz_favorites) {
                if (fav.brief || fav.mustCriteria) {
                    const favJob = {
                        id: `job_${timestamp()}_fav_${generateUUID().substring(0, 8)}`,
                        title: fav.name || fav.title || 'Favori V1',
                        raw_brief: fav.brief || '',
                        criteria: {
                            must_have: normalizeCriteria(fav.mustCriteria || []),
                            nice_to_have: normalizeCriteria(fav.niceCriteria || [])
                        },
                        created_at: timestamp(),
                        active: false
                    };
                    jobs.push(favJob);
                    result.favoritesMigrated++;
                }
            }
            
            if (result.favoritesMigrated > 0) {
                console.log(`[Migration] ${result.favoritesMigrated} favori(s) migré(s)`);
            }
        }

        // --- Sauvegarder les données migrées ---
        await chrome.storage.local.set({
            pawz_jobs: jobs,
            pawz_settings: settings,
            pawz_candidates: v2Data.pawz_candidates || []
        });

        // --- Nettoyage des anciennes clés ---
        await chrome.storage.local.remove([
            'pawz_search_criteria',
            'pawz_gemini_key',
            'pawz_favorites',
            'pawz_domain_settings'
        ]);

        console.log('[Migration] ✅ Migration terminée avec succès');
        return result;

    } catch (error) {
        console.error('[Migration] ❌ Erreur:', error);
        return { migrated: false, error: error.message };
    }
}

/**
 * Extrait un titre de job depuis les critères V1.
 * @param {Object} criteria - Critères V1
 * @returns {string|null} Titre extrait
 */
function extractJobTitle(criteria) {
    // Essayer différents champs possibles
    if (criteria.title) return criteria.title;
    if (criteria.jobTitle) return criteria.jobTitle;
    
    // Essayer d'extraire du brief
    if (criteria.brief) {
        const firstLine = criteria.brief.split('\n')[0].trim();
        if (firstLine.length > 5 && firstLine.length < 100) {
            return firstLine;
        }
    }
    
    return null;
}

/**
 * Normalise les critères en tableau de strings.
 * @param {Array|string} criteria - Critères bruts
 * @returns {Array<string>} Critères normalisés
 */
function normalizeCriteria(criteria) {
    if (!criteria) return [];
    
    if (typeof criteria === 'string') {
        // Séparer par virgule ou retour ligne
        return criteria.split(/[,\n]/)
            .map(c => c.trim())
            .filter(c => c.length > 0);
    }
    
    if (Array.isArray(criteria)) {
        return criteria
            .map(c => typeof c === 'string' ? c.trim() : String(c))
            .filter(c => c.length > 0);
    }
    
    return [];
}

/**
 * Vérifie si une migration est nécessaire.
 * @returns {Promise<boolean>}
 */
export async function needsMigration() {
    const data = await chrome.storage.local.get([
        'pawz_search_criteria',
        'pawz_gemini_key'
    ]);
    
    return !!(data.pawz_search_criteria || data.pawz_gemini_key);
}
