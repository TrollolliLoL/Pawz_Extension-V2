/**
 * PAWZ V2 - Content Script
 * Phase 2 : Intelligence & Capture
 */

console.log("[Pawz Content] Script loaded.");

// --- CONFIG ---
const TRIGGER_ID = 'pawz-trigger-root';
let _shadowRoot = null;
let _triggerBtn = null;

// --- INIT ---
function init() {
    if (document.getElementById(TRIGGER_ID)) return;
    createTrigger();
}

// --- UI COMPONENTS (TRIGGER) ---
function createTrigger() {
    // 1. Host
    const host = document.createElement('div');
    host.id = TRIGGER_ID;
    host.style.cssText = `
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
    `;
    document.body.appendChild(host);

    // 2. Cloud Shadow
    _shadowRoot = host.attachShadow({ mode: 'open' });

    // 3. Styles
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('content/trigger.css');
    _shadowRoot.appendChild(styleLink);

    // 4. Element
    _triggerBtn = document.createElement('div');
    _triggerBtn.className = 'pawz-trigger-icon-only';
    _triggerBtn.title = 'Ajouter ce profil';

    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('assets/logo-blanc.svg');
    img.className = 'trigger-icon-img';
    img.onerror = () => { _triggerBtn.textContent = '🐾'; _triggerBtn.style.fontSize = '24px'; };
    _triggerBtn.appendChild(img);

    _shadowRoot.appendChild(_triggerBtn);

    // 5. Events
    _triggerBtn.addEventListener('click', handleCaptureClick);
}

// --- LOGIC: CAPTURE ---
async function handleCaptureClick(e) {
    e.stopPropagation();
    e.preventDefault();
    console.log("[Pawz] Capture triggered!");

    // 1. Extract Content
    const payload = extractPageContent();
    if (!payload) {
        showErrorAnimation();
        return;
    }

    // 2. Send to Background
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'ADD_CANDIDATE',
            payload: payload
        });

        // 3. Feedback
        if (response && response.success) {
            showSuccessAnimation();
        } else {
            console.warn("[Pawz] Background returned error:", response);
            // Si l'erreur est "Pas de job actif", on pourrait ouvrir le sidepanel
            showErrorAnimation();
            if (response && response.error === 'NO_ACTIVE_JOB') {
                // Ouvrir le sidepanel (via background car on ne peut pas le faire directement content script)
                // Mais chrome.sidePanel.open() doit être une action utilisateur.
                alert("Veuillez d'abord sélectionner un Job dans l'extension Pawz.");
            }
        }
    } catch (err) {
        console.error("[Pawz] Communication error:", err);
        showErrorAnimation();
    }
}

function extractPageContent() {
    // Stratégie simple pour Phase 2 : Tout le texte visible
    // Plus tard : Logique spécifique LinkedIn vs PDF
    const textContent = document.body.innerText;
    
    // Métadonnées de base
    const title = document.title;
    const url = window.location.href;

    if (!textContent || textContent.length < 50) return null;

    return {
        source_url: url,
        page_title: title,
        content_text: textContent,
        timestamp: Date.now()
    };
}

// --- LOGIC: ANIMATIONS (TRIGGER_UI) ---
function showSuccessAnimation() {
    if (!_triggerBtn) return;
    
    // Add success class
    _triggerBtn.classList.add('state-success');
    
    // Reset after 2s
    setTimeout(() => {
        _triggerBtn.classList.remove('state-success');
    }, 2000);
}

function showErrorAnimation() {
    if (!_triggerBtn) return;
    
    _triggerBtn.classList.add('state-error');
    setTimeout(() => {
        _triggerBtn.classList.remove('state-error');
    }, 500);
}

// --- LAUNCHER ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
