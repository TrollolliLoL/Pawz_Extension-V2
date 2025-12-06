/**
 * PAWZ V2 - Content Script
 * Phase 1 : Fondations
 * 
 * Ce script est injecté automatiquement par Chrome grâce à la config manifest.json
 */

console.log("[Pawz Content] Script loaded on:", window.location.href);

// --- CONFIG ---
const TRIGGER_ID = 'pawz-trigger-root';

// --- TRIGGER CREATION ---
function createTrigger() {
    // Éviter les doublons
    if (document.getElementById(TRIGGER_ID)) {
        console.log("[Pawz Content] Trigger already exists, skipping.");
        return;
    }

    // Vérifier que body existe
    if (!document.body) {
        console.warn("[Pawz Content] No body found, retrying...");
        setTimeout(createTrigger, 100);
        return;
    }

    console.log("[Pawz Content] Creating trigger...");

    // 1. Host Element (Container)
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

    // 2. Shadow DOM (Isolation CSS totale)
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
    
    // Logo Blanc sur fond bleu
    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('assets/logo-blanc.svg');
    img.className = 'trigger-icon-img';
    img.alt = 'Pawz';
    // Fallback si l'image ne charge pas
    img.onerror = () => {
        console.warn("[Pawz Content] Logo failed to load, using emoji fallback.");
        button.textContent = '🐾';
        button.style.fontSize = '32px';
    };
    button.appendChild(img);

    shadow.appendChild(button);

    // 5. Interaction
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log("[Pawz Content] Click Trigger!");
        
        // TODO Phase 2 : Envoi message au background
        // chrome.runtime.sendMessage({ action: 'ADD_CANDIDATE', ... });
    });

    console.log("[Pawz Content] Trigger created successfully!");
}

// --- INIT ---
function init() {
    console.log("[Pawz Content] Initializing...");
    createTrigger();
}

// --- LAUNCH ---
// S'assurer que le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM déjà chargé, exécuter immédiatement
    init();
}

console.log("[Pawz Content] Script initialized.");
