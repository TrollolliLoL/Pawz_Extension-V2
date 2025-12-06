/**
 * PAWZ V2 - Sidepanel Logic
 * Phase 1 : Fondations
 */

console.log("[Sidepanel] Script loading...");

// --- INIT ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("[Sidepanel] DOM Ready, initializing...");
    
    // 1. Initial Render
    renderDashboard();
    
    // 2. Setup Listeners
    setupUIListeners();
});

// --- CORE REACTION ---
chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local') {
        if (changes.pawz_candidates || changes.pawz_jobs) {
            console.log("[Sidepanel] Storage changed -> Render");
            renderDashboard();
        }
    }
});

// --- RENDER ENGINE ---
function renderDashboard() {
    console.log("[Sidepanel] Rendering Dashboard (Stub for Phase 1)...");
    
    // TODO: En Phase 3, on va :
    // 1. Récupérer les jobs et candidats
    // 2. Remplir le selecteur de job
    // 3. Remplir la liste des candidats
    
    var container = document.getElementById('candidates-list');
    if (!container) return;
    
    // On laisse l'empty state par défaut pour l'instant.
}

// --- UI EVENT LISTENERS ---
function setupUIListeners() {
    console.log("[Sidepanel] Setting up UI listeners...");
    
    // Settings Toggle
    var btnSettings = document.getElementById('btn-settings');
    var settingsOverlay = document.getElementById('settings-overlay');
    var btnCloseSettings = document.getElementById('btn-close-settings');
    var btnBackSettings = document.getElementById('btn-back-settings');

    if (btnSettings && settingsOverlay) {
        btnSettings.addEventListener('click', function() {
            settingsOverlay.classList.remove('hidden');
        });
        
        var closeSettings = function() {
            settingsOverlay.classList.add('hidden');
        };
        
        if (btnCloseSettings) btnCloseSettings.addEventListener('click', closeSettings);
        if (btnBackSettings) btnBackSettings.addEventListener('click', closeSettings);
    }

    console.log("[Sidepanel] UI listeners ready.");
}

console.log("[Sidepanel] Script loaded.");
