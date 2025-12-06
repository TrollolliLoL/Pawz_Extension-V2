/**
 * PAWZ V2 - Content Script
 * Phase 1 : Fondations
 */

console.log("[Pawz] Content Script Injected.");

// --- CONFIG ---
const TRIGGER_ID = 'pawz-trigger-root';

// --- INIT ---
function init() {
    // Eviter les doublons
    if (document.getElementById(TRIGGER_ID)) return;

    createTrigger();
}

// --- TRIGGER CREATION ---
function createTrigger() {
    // 1. Host Element
    const host = document.createElement('div');
    host.id = TRIGGER_ID;
    host.style.position = 'fixed';
    host.style.bottom = '20px';
    host.style.right = '20px';
    host.style.zIndex = '2147483647'; // Max z-index
    document.body.appendChild(host);

    // 2. Shadow DOM (Isolation CSS)
    const shadow = host.attachShadow({ mode: 'open' });

    // 3. Styles Injection
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('content/trigger.css');
    shadow.appendChild(styleLink);

    // 4. Button Element (Pastille)
    const button = document.createElement('div');
    button.className = 'pawz-trigger-icon-only';
    button.title = 'Ajouter ce profil à Pawz';
    
    // Logo (Simulé pour l'instant, ou image)
    // On utilise le logo blanc comme demandé
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('assets/logo-blanc.svg');
    img.className = 'trigger-icon-img';
    button.appendChild(img);

    shadow.appendChild(button);

    // 5. Interaction
    button.addEventListener('click', () => {
        console.log("Click Trigger");
        // Phase 2 : Envoi message au background
    });
}

// Launch
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
