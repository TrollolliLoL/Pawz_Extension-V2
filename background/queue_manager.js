/**
 * PAWZ V2 - Queue Manager
 * @module background/queue_manager
 * 
 * Gestion de la file d'attente d'analyse des candidats.
 * Architecture Event-Driven avec concurrence limitée.
 */

import { db } from '../lib/db.js';
import { GeminiClient } from '../lib/gemini.js';
import { timestamp } from '../lib/utils.js';

/**
 * Configuration du Worker Pool.
 */
const CONFIG = {
    MAX_CONCURRENT: 3,      // Nombre max d'analyses simultanées
    MAX_RETRY: 3,           // Nombre max de tentatives avant FAILED
    WATCHDOG_INTERVAL: 1    // Intervalle du watchdog en minutes
};

/**
 * Flag pour éviter les exécutions parallèles de processQueue.
 */
let isProcessing = false;

/**
 * Traite la file d'attente des candidats.
 * Logique du "Worker Pool" (Module 4.2 SPECS).
 */
export async function processQueue() {
    // Éviter les exécutions parallèles
    if (isProcessing) {
        console.log('[Pawz:Queue] Déjà en cours d\'exécution, skip...');
        return;
    }

    isProcessing = true;

    try {
        // 1. Récupérer l'état actuel
        const data = await chrome.storage.local.get(['pawz_candidates', 'pawz_jobs']);
        const candidates = data.pawz_candidates || [];
        const jobs = data.pawz_jobs || [];

        // 2. Inventaire des statuts
        const processingItems = candidates.filter(c => c.status === 'processing');
        const pendingItems = candidates.filter(c => c.status === 'pending');

        // 3. Calcul de capacité
        const slotsAvailable = CONFIG.MAX_CONCURRENT - processingItems.length;

        // 4. Conditions d'arrêt silencieuses
        if (slotsAvailable <= 0 || pendingItems.length === 0) {
            return;
        }

        // Log seulement quand il y a du travail
        console.log(`[Pawz:Queue] 🚀 ${pendingItems.length} candidat(s) en attente, lancement...`);

        // 5. Tri intelligent (priorité FIFO)
        const sorted = pendingItems.sort((a, b) => {
            // Priorité haute en premier
            if (a.priority === 'high' && b.priority !== 'high') return -1;
            if (b.priority === 'high' && a.priority !== 'high') return 1;
            // Puis par timestamp (FIFO)
            return (a.timestamp_added || 0) - (b.timestamp_added || 0);
        });

        // 6. Lancer les analyses
        const toProcess = sorted.slice(0, slotsAvailable);

        for (const candidate of toProcess) {
            // Passer en PROCESSING immédiatement avec timestamp
            await updateCandidateStatus(candidate.id, 'processing', {
                timestamp_processing: timestamp()
            });

            // Lancer l'analyse sans attendre (parallèle)
            analyzeCandidate(candidate, jobs).catch(err => {
                console.error(`[Pawz:Queue] Erreur analyse ${candidate.id}:`, err);
            });
        }

    } catch (error) {
        console.error('[Pawz:Queue] Erreur processQueue:', error);
    } finally {
        isProcessing = false;
    }
}

/**
 * Met à jour le statut d'un candidat dans le storage.
 * @param {string} candidateId - ID du candidat
 * @param {string} status - Nouveau statut
 * @param {Object} [extraData] - Données supplémentaires à fusionner
 */
async function updateCandidateStatus(candidateId, status, extraData = {}) {
    const data = await chrome.storage.local.get('pawz_candidates');
    const candidates = data.pawz_candidates || [];
    
    const index = candidates.findIndex(c => c.id === candidateId);
    if (index === -1) {
        console.log(`[Pawz:Queue] Candidat ${candidateId} non trouvé (supprimé ?)`);
        return false;
    }

    candidates[index] = {
        ...candidates[index],
        status,
        ...extraData
    };

    await chrome.storage.local.set({ pawz_candidates: candidates });
    console.log(`[Pawz:Queue] Status ${candidateId}: ${status}`);
    return true;
}

/**
 * Pipeline d'analyse d'un candidat (Module 4.3 SPECS).
 * @param {Object} candidate - Objet candidat
 * @param {Array} jobs - Liste des jobs
 */
async function analyzeCandidate(candidate, jobs) {
    console.log(`[Pawz:Queue] Analyse candidat: ${candidate.id}`);

    try {
        // 1. Récupérer le payload depuis IndexedDB
        const payload = await db.getPayload(candidate.id);
        if (!payload) {
            console.error(`[Pawz:Queue] Payload introuvable pour ${candidate.id}`);
            await markAsFailed(candidate.id, 'Données sources perdues');
            return;
        }

        // 2. Récupérer le contexte du Job
        const job = jobs.find(j => j.id === candidate.job_id);
        if (!job) {
            console.error(`[Pawz:Queue] Job ${candidate.job_id} introuvable`);
            await markAsFailed(candidate.id, 'Fiche de poste non trouvée');
            return;
        }

        // 3. Récupérer les poids de réglage (AI Tuning)
        const tuningData = await chrome.storage.local.get('pawz_active_weights');
        const weights = tuningData.pawz_active_weights;

        // 4. Appeler l'IA Gemini avec heartbeat pour maintenir le SW actif
        // Le heartbeat empêche Chrome de tuer le Service Worker pendant les longues analyses
        let heartbeatCount = 0;
        const heartbeat = setInterval(() => {
            heartbeatCount++;
            console.log(`[Pawz:Queue] ⏳ Analyse en cours... (${heartbeatCount * 15}s)`);
        }, 15000);
        
        let result;
        try {
            result = await GeminiClient.analyzeCandidate(payload, job, weights, candidate.model);
        } finally {
            clearInterval(heartbeat);
        }

        // 5. Vérifier que le candidat existe toujours (pas supprimé pendant l'analyse)
        const stillExists = await checkCandidateExists(candidate.id);
        if (!stillExists) {
            console.log(`[Pawz:Queue] Candidat ${candidate.id} supprimé pendant l'analyse, abandon`);
            await db.deletePayload(candidate.id);
            return;
        }

        // 5. Finaliser en COMPLETED
        await updateCandidateStatus(candidate.id, 'completed', {
            candidate_name: result.candidate_name,
            candidate_title: result.candidate_title,
            score: result.score,
            verdict: result.verdict,
            analysis: result.analysis,
            timestamp_processed: timestamp()
        });

        // 6. FLUSH - Supprimer le payload d'IndexedDB
        await db.deletePayload(candidate.id);
        console.log(`[Pawz:Queue] ✅ Candidat ${candidate.id} analysé avec succès (Score: ${result.score})`);

    } catch (error) {
        console.error(`[Pawz:Queue] Erreur analyse ${candidate.id}:`, error);
        await handleAnalysisError(candidate, error);
    }
}

/**
 * Vérifie si un candidat existe toujours dans le storage.
 * @param {string} candidateId - ID du candidat
 * @returns {Promise<boolean>}
 */
async function checkCandidateExists(candidateId) {
    const data = await chrome.storage.local.get('pawz_candidates');
    const candidates = data.pawz_candidates || [];
    return candidates.some(c => c.id === candidateId);
}

/**
 * Gère les erreurs d'analyse (Retry ou FAILED).
 * @param {Object} candidate - Candidat en erreur
 * @param {Object} error - Erreur structurée
 */
async function handleAnalysisError(candidate, error) {
    const retryCount = (candidate.retry_count || 0) + 1;

    // Erreur retryable et quota de retry non atteint
    if (error.retryable && retryCount <= CONFIG.MAX_RETRY) {
        console.log(`[Pawz:Queue] Retry ${retryCount}/${CONFIG.MAX_RETRY} pour ${candidate.id}`);
        
        await updateCandidateStatus(candidate.id, 'pending', {
            retry_count: retryCount,
            last_error: error.message
        });

        // Planifier un retry via alarm
        chrome.alarms.create(`retry_${candidate.id}`, {
            delayInMinutes: 1
        });
        
        return;
    }

    // Erreur fatale ou quota dépassé
    await markAsFailed(candidate.id, error.message || 'Erreur inconnue');
}

/**
 * Marque un candidat comme FAILED.
 * @param {string} candidateId - ID du candidat
 * @param {string} errorMessage - Message d'erreur
 */
async function markAsFailed(candidateId, errorMessage) {
    await updateCandidateStatus(candidateId, 'failed', {
        error_msg: errorMessage,
        timestamp_processed: timestamp()
    });

    // Supprimer le payload (inutile de garder des données cassées)
    try {
        await db.deletePayload(candidateId);
    } catch (e) {
        console.error('[Pawz:Queue] Erreur suppression payload failed:', e);
    }

    console.log(`[Pawz:Queue] ❌ Candidat ${candidateId} FAILED: ${errorMessage}`);
}

/**
 * Configure le Watchdog (alarm récurrente).
 * Vérifie les items bloqués et relance le traitement.
 */
export function setupWatchdog() {
    chrome.alarms.create('pawz_watchdog', {
        periodInMinutes: CONFIG.WATCHDOG_INTERVAL
    });
    console.log('[Pawz:Queue] Watchdog configuré');
}

/**
 * Handler pour les alarms (watchdog + retry).
 * @param {Object} alarm - Alarm Chrome
 */
export async function handleAlarm(alarm) {
    // Watchdog silencieux sauf si action

    if (alarm.name === 'pawz_watchdog') {
        // Vérifier les items coincés en PROCESSING depuis trop longtemps
        await checkStuckItems();
        // Relancer le traitement
        await processQueue();
    } else if (alarm.name.startsWith('retry_')) {
        // Retry spécifique
        await processQueue();
    }
}

/**
 * Vérifie et reset les items coincés en PROCESSING.
 * (Ex: crash pendant l'analyse, Service Worker endormi)
 */
async function checkStuckItems() {
    const data = await chrome.storage.local.get('pawz_candidates');
    const candidates = data.pawz_candidates || [];
    const now = timestamp();
    const STUCK_THRESHOLD = 3 * 60; // 3 minutes (API timeout = 2min)

    let modified = false;

    for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        if (c.status === 'processing') {
            // Utiliser timestamp_processing si disponible, sinon timestamp_added
            const startTime = c.timestamp_processing || c.timestamp_added || 0;
            const processingTime = now - startTime;
            
            if (processingTime > STUCK_THRESHOLD) {
                console.log(`[Pawz:Queue] Item coincé détecté: ${c.id} (${Math.round(processingTime/60)}min)`);
                candidates[i].status = 'pending';
                candidates[i].retry_count = (c.retry_count || 0) + 1;
                delete candidates[i].timestamp_processing; // Reset
                modified = true;
            }
        }
    }

    if (modified) {
        await chrome.storage.local.set({ pawz_candidates: candidates });
        console.log('[Pawz:Queue] Items coincés réinitialisés');
    }
}

/**
 * Ajoute un nouveau candidat à la queue.
 * @param {Object} params - Paramètres du candidat
 * @param {string} params.id - UUID du candidat
 * @param {string} params.jobId - ID du job associé
 * @param {string} params.sourceUrl - URL source
 * @param {string} params.sourceType - Type de source
 * @param {string} params.payloadType - Type de payload ("text" ou "base64")
 * @param {string} params.payloadContent - Contenu du payload
 * @param {string} [params.model] - Modèle IA utilisé
 * @param {string} [params.tuningHash] - Hash des réglages IA
 * @param {string} [params.tuningName] - Nom du preset de réglage IA
 * @returns {Promise<Object>} Résultat de l'opération
 */
export async function addCandidate(params) {
    const { id, jobId, sourceUrl, sourceType, payloadType, payloadContent, model, tuningHash, tuningName } = params;

    console.log(`[Pawz:Queue] Ajout candidat: ${id}`);

    try {
        // 1. Sauvegarder le payload dans IndexedDB
        await db.savePayload(id, payloadType, payloadContent);

        // 2. Créer l'entrée dans chrome.storage
        const data = await chrome.storage.local.get('pawz_candidates');
        const candidates = data.pawz_candidates || [];

        const newCandidate = {
            id,
            job_id: jobId,
            source_url: sourceUrl,
            source_type: sourceType,
            model: model || 'pro',
            tuning_hash: tuningHash || null,
            tuning_name: tuningName || 'Par défaut',
            status: 'pending',
            priority: 'normal',
            candidate_name: 'En attente...',
            candidate_title: '',
            score: null,
            verdict: null,
            analysis: null,
            error_msg: null,
            retry_count: 0,
            timestamp_added: timestamp(),
            timestamp_processed: null
        };

        candidates.push(newCandidate);
        await chrome.storage.local.set({ pawz_candidates: candidates });

        console.log(`[Pawz:Queue] ✅ Candidat ${id} ajouté à la queue`);

        // 3. Déclencher le traitement
        // Note: Le storage.onChanged dans background.js le fera automatiquement

        return { success: true, candidateId: id };

    } catch (error) {
        console.error('[Pawz:Queue] Erreur ajout candidat:', error);
        // Cleanup en cas d'erreur partielle
        try {
            await db.deletePayload(id);
        } catch (e) {}
        
        return { success: false, error: error.message };
    }
}

/**
 * Supprime un candidat de la queue.
 * @param {string} candidateId - ID du candidat
 * @returns {Promise<boolean>} Succès
 */
export async function removeCandidate(candidateId) {
    console.log(`[Pawz:Queue] Suppression candidat: ${candidateId}`);

    try {
        // Supprimer du storage
        const data = await chrome.storage.local.get('pawz_candidates');
        const candidates = data.pawz_candidates || [];
        const filtered = candidates.filter(c => c.id !== candidateId);
        
        await chrome.storage.local.set({ pawz_candidates: filtered });

        // Supprimer le payload IndexedDB
        await db.deletePayload(candidateId);

        console.log(`[Pawz:Queue] ✅ Candidat ${candidateId} supprimé`);
        return true;

    } catch (error) {
        console.error('[Pawz:Queue] Erreur suppression:', error);
        return false;
    }
}
