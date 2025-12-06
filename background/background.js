/**
 * PAWZ V2 - Service Worker (Background)
 * Phase 1 : Fondations
 * 
 * NOTE: Les imports vers lib/ sont désactivés pour l'instant car les fichiers sont vides.
 * Ils seront activés en Phase 2 quand le Backend sera implémenté.
 */

console.log("[Background] Service Worker Started.");

// --- INSTALLATION ---
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log("[Background] Extension Installed/Updated:", details.reason);
    
    // Initialiser les données par défaut si première installation
    if (details.reason === 'install') {
        await initDefaultStorage();
    }
});

// --- SIDE PANEL : Ouvrir au clic sur l'icône ---
chrome.action.onClicked.addListener(async (tab) => {
    console.log("[Background] Icon clicked, opening Side Panel...");
    try {
        await chrome.sidePanel.open({ tabId: tab.id });
        console.log("[Background] Side Panel opened successfully.");
    } catch (error) {
        console.error("[Background] Failed to open Side Panel:", error);
        // Fallback : essayer d'ouvrir globalement
        try {
            await chrome.sidePanel.open({ windowId: tab.windowId });
        } catch (fallbackError) {
            console.error("[Background] Fallback also failed:", fallbackError);
        }
    }
});

// --- MESSAGING ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[Background] Message received:", message);
    
    // Sera implémenté en Phase 2
    if (message.action === 'ADD_CANDIDATE') {
        // TODO: Ajouter le candidat à la queue
        sendResponse({ success: true, message: "Placeholder" });
    }
    
    return true; // Keep channel open for async
});

// --- STORAGE INIT ---
async function initDefaultStorage() {
    console.log("[Background] Initializing default storage...");
    
    const defaults = {
        pawz_jobs: [],
        pawz_candidates: [],
        pawz_settings: {
            api_key: '',
            model_id: 'gemini-2.5-flash'
        }
    };
    
    await chrome.storage.local.set(defaults);
    console.log("[Background] Default storage set.");
}

console.log("[Background] Listeners registered.");
