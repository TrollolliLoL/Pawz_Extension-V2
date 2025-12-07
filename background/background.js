/**
 * PAWZ V2 - Service Worker (Background)
 * Point d'entrée principal de l'extension.
 * 
 * Architecture Event-Driven (Module 4.1 SPECS):
 * - Réagit aux événements chrome.storage.onChanged
 * - Watchdog via chrome.alarms pour la résilience
 */

import { db } from '../lib/db.js';
import { generateUUID } from '../lib/utils.js';
import { 
    processQueue, 
    setupWatchdog, 
    handleAlarm,
    addCandidate,
    removeCandidate 
} from './queue_manager.js';

console.log('[Background] Service Worker Started (Phase 2)');

// ============================================================================
// INSTALLATION & INITIALISATION
// ============================================================================

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Background] Extension Installed/Updated:', details.reason);
    
    // Initialiser IndexedDB
    try {
        await db.init();
        console.log('[Background] IndexedDB initialisée');
    } catch (error) {
        console.error('[Background] Erreur init DB:', error);
    }

    // Initialiser les données par défaut si première installation
    if (details.reason === 'install') {
        await initDefaultStorage();
    }

    // Migration V1 -> V2 si mise à jour
    if (details.reason === 'update') {
        await runMigration();
    }

    // Configurer le Watchdog
    setupWatchdog();
});

// Au démarrage du Worker (réveil)
chrome.runtime.onStartup.addListener(async () => {
    console.log('[Background] Chrome démarré, initialisation...');
    
    try {
        await db.init();
        setupWatchdog();
        // Vérifier s'il y a des items en attente
        await processQueue();
    } catch (error) {
        console.error('[Background] Erreur startup:', error);
    }
});

// ============================================================================
// SIDE PANEL - Ouvrir au clic sur l'icône
// ============================================================================

chrome.action.onClicked.addListener(async (tab) => {
    console.log('[Background] Icon clicked, opening Side Panel...');
    try {
        await chrome.sidePanel.open({ tabId: tab.id });
        console.log('[Background] Side Panel opened successfully.');
    } catch (error) {
        console.error('[Background] Failed to open Side Panel:', error);
        // Fallback : essayer d'ouvrir globalement
        try {
            await chrome.sidePanel.open({ windowId: tab.windowId });
        } catch (fallbackError) {
            console.error('[Background] Fallback also failed:', fallbackError);
        }
    }
});

// ============================================================================
// MESSAGING - Communication avec Content Scripts et Side Panel
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Message received:', message.action);
    
    // Traiter le message de manière asynchrone
    handleMessage(message, sender)
        .then(response => sendResponse(response))
        .catch(error => {
            console.error('[Background] Message error:', error);
            sendResponse({ success: false, error: error.message });
        });
    
    // Garder le canal ouvert pour la réponse async
    return true;
});

/**
 * Gestionnaire de messages asynchrone.
 * @param {Object} message - Message reçu
 * @param {Object} sender - Expéditeur
 * @returns {Promise<Object>} Réponse
 */
async function handleMessage(message, sender) {
    switch (message.action) {
        case 'ADD_CANDIDATE':
            return await handleAddCandidate(message.payload, sender);

        case 'REMOVE_CANDIDATE':
            const removed = await removeCandidate(message.candidateId);
            return { success: removed };

        case 'GET_ACTIVE_JOB':
            return await getActiveJob();

        case 'PRIORITIZE_CANDIDATE':
            return await prioritizeCandidate(message.candidateId);

        case 'RETRY_CANDIDATE':
            return await retryCandidate(message.candidateId);

        case 'OPEN_ANALYSIS':
            // Ouvre le sidepanel et affiche un candidat spécifique
            try {
                await chrome.sidePanel.open({ tabId: sender.tab?.id });
                // Store l'ID pour que le sidepanel puisse l'ouvrir
                await chrome.storage.local.set({ pawz_open_candidate: message.analysisId });
                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }

        case 'OPEN_ANALYSES_FOR_URL':
            // Ouvre le sidepanel avec filtre URL
            try {
                await chrome.sidePanel.open({ tabId: sender.tab?.id });
                await chrome.storage.local.set({ pawz_filter_url: message.url });
                return { success: true };
            } catch (e) {
                return { success: false, error: e.message };
            }

        default:
            console.warn('[Background] Action inconnue:', message.action);
            return { success: false, error: 'Action non reconnue' };
    }
}

/**
 * Gère l'ajout d'un nouveau candidat.
 * @param {Object} payload - Données du candidat
 * @param {Object} sender - Expéditeur (contient l'URL)
 */
async function handleAddCandidate(payload, sender) {
    // Vérifier qu'il y a un Job actif
    const activeJob = await getActiveJob();
    if (!activeJob.success || !activeJob.job) {
        console.warn('[Background] Pas de Job actif');
        return { 
            success: false, 
            error: 'NO_ACTIVE_JOB',
            message: 'Veuillez d\'abord sélectionner une Fiche de Poste'
        };
    }

    // Récupérer le modèle et les réglages IA
    const settingsData = await chrome.storage.local.get(['pawz_settings', 'pawz_active_weights', 'pawz_active_preset_name']);
    const settings = settingsData.pawz_settings || {};
    const weights = settingsData.pawz_active_weights || null;
    const presetName = settingsData.pawz_active_preset_name || 'Par défaut';
    
    const model = settings.selected_model || 'gemini-2.0-flash';
    const tuningHash = weights ? Object.values(weights).join('-') : null;

    // Générer un ID unique
    const candidateId = `cand_${generateUUID()}`;
    const sourceUrl = sender.tab?.url || payload.sourceUrl || 'unknown';

    // Ajouter à la queue avec contexte complet
    const result = await addCandidate({
        id: candidateId,
        jobId: activeJob.job.id,
        sourceUrl: sourceUrl,
        sourceType: payload.content_type || 'generic_web',
        payloadType: 'text',
        payloadContent: payload.content_text,
        model: model,
        tuningHash: tuningHash,
        tuningName: presetName
    });

    if (result.success) {
        // Déclencher le traitement de la queue
        // (setTimeout pour laisser le temps au storage.onChanged de se propager)
        setTimeout(() => processQueue(), 100);
    }

    return result;
}

/**
 * Récupère le Job actif.
 */
async function getActiveJob() {
    try {
        const data = await chrome.storage.local.get('pawz_jobs');
        const jobs = data.pawz_jobs || [];
        const activeJob = jobs.find(j => j.active === true);
        
        return { 
            success: true, 
            job: activeJob || null,
            hasActiveJob: !!activeJob
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Priorise un candidat dans la queue.
 */
async function prioritizeCandidate(candidateId) {
    try {
        const data = await chrome.storage.local.get('pawz_candidates');
        const candidates = data.pawz_candidates || [];
        
        const index = candidates.findIndex(c => c.id === candidateId);
        if (index === -1) {
            return { success: false, error: 'Candidat non trouvé' };
        }

        candidates[index].priority = 'high';
        await chrome.storage.local.set({ pawz_candidates: candidates });
        
        // Relancer le traitement pour réévaluer les priorités
        await processQueue();
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Relance l'analyse d'un candidat en erreur.
 */
async function retryCandidate(candidateId) {
    try {
        const data = await chrome.storage.local.get('pawz_candidates');
        const candidates = data.pawz_candidates || [];
        
        const index = candidates.findIndex(c => c.id === candidateId);
        if (index === -1) {
            return { success: false, error: 'Candidat non trouvé' };
        }

        // Remettre en pending
        candidates[index].status = 'pending';
        candidates[index].retry_count = 0;
        candidates[index].error_msg = null;
        
        await chrome.storage.local.set({ pawz_candidates: candidates });
        
        // Relancer le traitement
        await processQueue();
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================================================
// STORAGE LISTENER - Réactivité (Module 4.1 SPECS)
// ============================================================================

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    // Si les candidats changent, potentiellement relancer le traitement
    if (changes.pawz_candidates) {
        const newCandidates = changes.pawz_candidates.newValue || [];
        const hasPending = newCandidates.some(c => c.status === 'pending');
        
        if (hasPending) {
            console.log('[Background] Nouveaux candidats PENDING détectés');
            // Petit délai pour éviter les race conditions
            setTimeout(() => processQueue(), 50);
        }
    }
});

// ============================================================================
// ALARMS LISTENER - Watchdog & Retry
// ============================================================================

chrome.alarms.onAlarm.addListener(handleAlarm);

// ============================================================================
// STORAGE INIT & MIGRATION
// ============================================================================

async function initDefaultStorage() {
    console.log('[Background] Initializing default storage...');
    
    const defaults = {
        pawz_jobs: [],
        pawz_candidates: [],
        pawz_settings: {
            api_key: '',
            model_id: 'gemini-2.5-flash'
        }
    };
    
    await chrome.storage.local.set(defaults);
    console.log('[Background] Default storage set.');
}

async function runMigration() {
    console.log('[Background] Checking for V1 -> V2 migration...');
    
    try {
        const data = await chrome.storage.local.get([
            'pawz_search_criteria',
            'pawz_gemini_key'
        ]);

        // Vérifier si des données V1 existent
        if (!data.pawz_search_criteria && !data.pawz_gemini_key) {
            console.log('[Background] Pas de données V1 à migrer');
            return;
        }

        console.log('[Background] Données V1 détectées, migration...');

        // Récupérer les données V2 existantes
        const v2Data = await chrome.storage.local.get([
            'pawz_jobs',
            'pawz_settings'
        ]);

        const jobs = v2Data.pawz_jobs || [];
        const settings = v2Data.pawz_settings || { api_key: '', model_id: 'gemini-2.5-flash' };

        // Migrer la clé API
        if (data.pawz_gemini_key) {
            settings.api_key = data.pawz_gemini_key;
            console.log('[Background] Clé API migrée');
        }

        // Migrer les critères de recherche en Job
        if (data.pawz_search_criteria) {
            const criteria = data.pawz_search_criteria;
            const newJob = {
                id: `job_${Date.now()}_migrated`,
                title: 'Mon Poste (Importé V1)',
                raw_brief: criteria.brief || '',
                criteria: {
                    must_have: criteria.mustCriteria || [],
                    nice_to_have: criteria.niceCriteria || []
                },
                created_at: Math.floor(Date.now() / 1000),
                active: true
            };

            // Désactiver les autres jobs
            jobs.forEach(j => j.active = false);
            jobs.push(newJob);
            
            console.log('[Background] Critères migrés en Job V2');
        }

        // Sauvegarder les données migrées
        await chrome.storage.local.set({
            pawz_jobs: jobs,
            pawz_settings: settings
        });

        // Supprimer les anciennes clés V1
        await chrome.storage.local.remove([
            'pawz_search_criteria',
            'pawz_gemini_key'
        ]);

        console.log('[Background] ✅ Migration V1 -> V2 terminée');

    } catch (error) {
        console.error('[Background] Erreur migration:', error);
    }
}

console.log('[Background] Listeners registered (Phase 2).');
