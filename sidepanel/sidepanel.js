/**
 * PAWZ V2 - Sidepanel Logic
 * Phase 1 : Fondations
 */

// --- STATE MANAGEMENT ---
// Le sidepanel est réactif : il n'a pas d'état local persistant.
// Tout vient de chrome.storage.local.

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Sidepanel] Initialisation...");
    
    // 1. Initial Render
    renderDashboard();
    
    // 2. Setup Listeners
    setupUIListeners();
});

// --- CORE REACTION ---
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        if (changes.pawz_candidates || changes.pawz_jobs) {
            console.log("[Sidepanel] Storage changed -> Render");
            renderDashboard();
        }
    }
});

// --- RENDER ENGINE ---
async function renderDashboard() {
    console.log("[Sidepanel] Rendering Dashboard (Stub for Phase 1)...");
    
    // TODO: En Phase 3, on va :
    // 1. Récupérer les jobs et candidats
    // 2. Remplir le selecteur de job
    // 3. Remplir la liste des candidats
    
    // Pour l'instant, on vérifie juste que ça ne plante pas.
    const container = document.getElementById('candidates-list');
    if (!container) return;
    
    // On laisse l'empty state par défaut pour l'instant.
}

// --- UI EVENT LISTENERS ---
function setupUIListeners() {
    
    // Settings Toggle
    const btnSettings = document.getElementById('btn-settings');
    const settingsOverlay = document.getElementById('settings-overlay');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnBackSettings = document.getElementById('btn-back-settings');

    if (btnSettings && settingsOverlay) {
        btnSettings.addEventListener('click', () => {
            settingsOverlay.classList.remove('hidden');
        });
        
        const closeSettings = () => settingsOverlay.classList.add('hidden');
        if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettings);
        if (btnBackSettings) btnBackSettings.addEventListener('click', closeSettings);
    }

    // Detail Panel Logic (Stub)
    // Sera implémenté en Phase 3
}

console.log("[Sidepanel] Loaded.");
