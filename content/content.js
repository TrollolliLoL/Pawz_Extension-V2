/**
 * PAWZ V2 - Content Script (Refactored)
 * Trigger Button with Drag-Drop, Mini-Sidebar, Smart Analysis Logic
 */

console.log("[Pawz] Content script loaded.");

// === CONFIG ===
const TRIGGER_ID = 'pawz-trigger-root';
const STORAGE_KEY_POS = 'pawz_trigger_position';

let _shadowRoot = null;
let _triggerBtn = null;
let _miniSidebar = null;
let _dragOverlay = null;
let _isDragging = false;
let _startY = 0;
let _currentY = 50; // % from top

// === INIT ===
function init() {
    if (document.getElementById(TRIGGER_ID)) return;
    loadPosition().then(() => {
        createTrigger();
    });
}

async function loadPosition() {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEY_POS);
        if (data[STORAGE_KEY_POS]) {
            _currentY = data[STORAGE_KEY_POS];
        }
    } catch (e) {
        console.warn("[Pawz] Error loading position:", e);
    }
}

async function savePosition() {
    try {
        await chrome.storage.local.set({ [STORAGE_KEY_POS]: _currentY });
    } catch (e) {
        console.warn("[Pawz] Error saving position:", e);
    }
}

// === CREATE UI ===
function createTrigger() {
    // Host
    const host = document.createElement('div');
    host.id = TRIGGER_ID;
    host.style.cssText = `
        position: fixed !important;
        top: ${_currentY}% !important;
        right: 15px !important;
        transform: translateY(-50%) !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
    `;
    document.body.appendChild(host);

    // Shadow DOM
    _shadowRoot = host.attachShadow({ mode: 'open' });

    // Styles
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('content/trigger.css');
    _shadowRoot.appendChild(styleLink);

    // Trigger Button
    _triggerBtn = document.createElement('div');
    _triggerBtn.className = 'pawz-trigger';
    _triggerBtn.title = 'Pawz - Analyser';

    const img = document.createElement('img');
    img.src = chrome.runtime.getURL('assets/Logo Pawz Blanc VFinal.PNG');
    img.className = 'trigger-logo';
    img.draggable = false;
    img.onerror = () => { _triggerBtn.textContent = '🐾'; };
    _triggerBtn.appendChild(img);

    _shadowRoot.appendChild(_triggerBtn);

    // Mini-Sidebar (hidden initially)
    createMiniSidebar();

    // Events
    setupEvents();
}

function createMiniSidebar() {
    _miniSidebar = document.createElement('div');
    _miniSidebar.className = 'pawz-mini-sidebar hidden';
    _miniSidebar.innerHTML = `
        <div class="mini-sidebar-buttons"></div>
    `;
    _shadowRoot.appendChild(_miniSidebar);
}

function closeMiniSidebar() {
    _miniSidebar.classList.remove('open');
    setTimeout(() => _miniSidebar.classList.add('hidden'), 200);
}

function openMiniSidebar() {
    updateMiniSidebarButtons();
    _miniSidebar.classList.remove('hidden');
    requestAnimationFrame(() => _miniSidebar.classList.add('open'));
}

function toggleMiniSidebar() {
    if (_miniSidebar.classList.contains('hidden')) {
        openMiniSidebar();
    } else {
        closeMiniSidebar();
    }
}

// === SETUP EVENTS ===
function setupEvents() {
    _triggerBtn.addEventListener('mousedown', handleMouseDown);
}

let _dragStartPos = null;
let _hasMoved = false;

function handleMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    
    e.preventDefault();
    _dragStartPos = { x: e.clientX, y: e.clientY };
    _hasMoved = false;

    const host = document.getElementById(TRIGGER_ID);
    const rect = host.getBoundingClientRect();
    const initialTop = rect.top + rect.height / 2;

    const onMouseMove = (moveEvent) => {
        const deltaX = Math.abs(moveEvent.clientX - _dragStartPos.x);
        const deltaY = Math.abs(moveEvent.clientY - _dragStartPos.y);
        
        // Threshold to distinguish click from drag
        if (deltaX > 5 || deltaY > 5) {
            _hasMoved = true;
            _isDragging = true;
            
            // Create overlay if not exists
            if (!_dragOverlay) {
                _dragOverlay = document.createElement('div');
                _dragOverlay.className = 'pawz-drag-overlay';
                _shadowRoot.appendChild(_dragOverlay);
                _triggerBtn.classList.add('dragging');
                closeMiniSidebar(); // Close on drag start
            }

            const newY = moveEvent.clientY;
            _currentY = Math.max(5, Math.min(95, (newY / window.innerHeight) * 100));
            host.style.top = `${_currentY}%`;
        }
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (_dragOverlay) {
            _dragOverlay.remove();
            _dragOverlay = null;
        }
        _triggerBtn.classList.remove('dragging');

        if (_hasMoved) {
            // It was a drag
            savePosition();
            _isDragging = false;
        } else {
            // It was a click
            toggleMiniSidebar();
        }
        
        _dragStartPos = null;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// === MINI-SIDEBAR BUTTONS LOGIC ===
async function updateMiniSidebarButtons() {
    const container = _miniSidebar.querySelector('.mini-sidebar-buttons');
    container.innerHTML = '';

    const currentUrl = window.location.href;
    const circumstances = await getCurrentCircumstances();

    if (!circumstances) {
        // Pas de job ou clé API
        container.innerHTML = '<div style="padding:10px; color:#6b7280; font-size:12px;">Configurez un job et une clé API dans Pawz.</div>';
        return;
    }

    // Check existing analyses for this URL
    const analyses = await getAnalysesForUrl(currentUrl);
    
    // Find exact match (same job, same model, same tuning)
    // Note: Pour les données legacy sans model/tuning_hash, on compare seulement le job_id
    const exactMatch = analyses.find(a => {
        const sameJob = a.job_id === circumstances.job_id;
        // Si l'analyse n'a pas de model (legacy), on considère que c'est le modèle par défaut
        const analysisModel = a.model || 'fast';
        const sameModel = analysisModel === circumstances.model;
        const sameTuning = isSameTuning(a.tuning_hash, circumstances.tuning_hash);
        
        return sameJob && sameModel && sameTuning;
    });

    if (exactMatch) {
        // ========================================
        // CAS 3 : "Déjà Vu" (Exact Match)
        // ========================================
        const btnView = document.createElement('button');
        btnView.className = 'mini-sidebar-btn btn-view-analysis';
        btnView.textContent = '👁️ Voir l\'analyse';
        btnView.addEventListener('click', () => viewAnalysis(exactMatch.id));
        container.appendChild(btnView);
        
        // Si plusieurs analyses existent, montrer le bouton historique
        if (analyses.length > 1) {
            const btnHistory = document.createElement('button');
            btnHistory.className = 'mini-sidebar-btn btn-history';
            btnHistory.textContent = '📂 Analyses précédentes';
            btnHistory.addEventListener('click', () => openAnalysesHistory(currentUrl));
            container.appendChild(btnHistory);
        }
        
    } else if (analyses.length > 0) {
        // ========================================
        // CAS 2 : "Contexte Différent"
        // ========================================
        const btnAnalyze = document.createElement('button');
        btnAnalyze.className = 'mini-sidebar-btn btn-analyze';
        btnAnalyze.textContent = '🚀 Nouvelle analyse';
        btnAnalyze.addEventListener('click', () => launchAnalysis(circumstances));
        container.appendChild(btnAnalyze);

        // Most recent analysis
        const btnHistory = document.createElement('button');
        btnHistory.className = 'mini-sidebar-btn btn-history';
        btnHistory.textContent = '📂 Analyses précédentes (' + analyses.length + ')';
        btnHistory.addEventListener('click', () => openAnalysesHistory(currentUrl));
        container.appendChild(btnHistory);
        
    } else {
        // ========================================
        // CAS 1 : "Nouveau" (Jamais analysé)
        // ========================================
        const btnAnalyze = document.createElement('button');
        btnAnalyze.className = 'mini-sidebar-btn btn-analyze';
        btnAnalyze.textContent = '🚀 Lancer l\'analyse';
        btnAnalyze.addEventListener('click', () => launchAnalysis(circumstances));
        container.appendChild(btnAnalyze);
    }
}

/**
 * Compare deux hashes de tuning (simplified)
 */
function isSameTuning(hash1, hash2) {
    // Si les hashes n'existent pas, on considère que c'est le même (legacy)
    if (!hash1 && !hash2) return true;
    if (!hash1 || !hash2) return false;
    return hash1 === hash2;
}

/**
 * Génère un hash simple des poids de tuning
 */
function generateTuningHash(weights) {
    if (!weights) return null;
    // Simple hash: concaténation des valeurs
    return Object.values(weights).join('-');
}

/**
 * Ouvre le Sidepanel sur l'onglet Analyse avec filtre URL
 */
function openAnalysesHistory(url) {
    closeMiniSidebar();
    chrome.runtime.sendMessage({
        action: 'OPEN_ANALYSES_FOR_URL',
        url: url
    });
}

async function getCurrentCircumstances() {
    try {
        const data = await chrome.storage.local.get(['pawz_jobs', 'pawz_settings', 'pawz_active_weights']);
        console.log("[Pawz] Storage Data:", data); // DEBUG

        const jobs = data.pawz_jobs || [];
        const settings = data.pawz_settings || {};
        const weights = data.pawz_active_weights || null;

        const activeJob = jobs.find(j => j.active === true);
        
        if (!activeJob) console.warn("[Pawz] No active job found (jobs:", jobs.length, ")");
        if (!settings.api_key) console.warn("[Pawz] No API key configured");

        if (!activeJob || !settings.api_key) return null;

        return {
            job_id: activeJob.id,
            model: settings.selected_model || 'fast',
            api_key: settings.api_key,
            tuning_hash: generateTuningHash(weights)
        };
    } catch (e) {
        console.error("[Pawz] Error getting circumstances:", e);
        return null;
    }
}

// === STORAGE LISTENER ===
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        // Rafraîchir si jobs, settings, tuning ou candidats changent
        if (changes.pawz_jobs || changes.pawz_settings || changes.pawz_active_weights || changes.pawz_candidates) {
            console.log("[Pawz] Storage changed, updating trigger UI...");
            // Si la sidebar est ouverte, on rafraichit
            if (_miniSidebar && _miniSidebar.classList.contains('open')) {
                updateMiniSidebarButtons();
            }
        }
    }
});

async function getAnalysesForUrl(url) {
    try {
        const data = await chrome.storage.local.get('pawz_candidates');
        const candidates = data.pawz_candidates || [];
        return candidates.filter(c => c.source_url === url && c.status === 'completed');
    } catch (e) {
        console.error("[Pawz] Error getting analyses:", e);
        return [];
    }
}

// === ACTIONS ===
async function launchAnalysis(circumstances) {
    closeMiniSidebar();
    
    // Show loading state
    _triggerBtn.classList.add('dragging');

    try {
        const payload = extractPageContent();
        if (!payload) {
            showError();
            return;
        }

        payload.job_id = circumstances.job_id;
        payload.model = circumstances.model;

        const response = await chrome.runtime.sendMessage({
            action: 'ADD_CANDIDATE',
            payload: payload
        });

        if (response && response.success) {
            showSuccess();
        } else {
            console.warn("[Pawz] Error:", response?.error);
            showError();
        }
    } catch (e) {
        console.error("[Pawz] Analysis error:", e);
        showError();
    }

    _triggerBtn.classList.remove('dragging');
}

function viewAnalysis(analysisId) {
    closeMiniSidebar();
    
    // Send message to open side panel with this analysis
    chrome.runtime.sendMessage({
        action: 'OPEN_ANALYSIS',
        analysisId: analysisId
    });
}

// === CONTENT EXTRACTION ===
function extractPageContent() {
    const url = window.location.href;
    const title = document.title;
    
    let contentType = 'website';
    let content = '';

    // Detect page type
    if (url.includes('linkedin.com')) {
        contentType = 'linkedin';
        content = document.body.innerText;
    } else if (url.endsWith('.pdf') || location.protocol === 'file:') {
        contentType = 'pdf';
        // PDF handling would need special logic
        content = document.body.innerText;
    } else {
        contentType = 'website';
        // Truncate for websites to reduce tokens
        content = document.body.innerText.substring(0, 15000);
    }

    // DEBUG: Log pour vérifier la qualité de capture
    console.log("[Pawz] DEBUG CAPTURE - Type:", contentType);
    console.log("[Pawz] DEBUG CAPTURE - Premiers 500 chars:", content.substring(0, 500));
    console.log("[Pawz] DEBUG CAPTURE - Longueur totale:", content.length);

    if (!content || content.length < 50) return null;

    return {
        source_url: url,
        page_title: title,
        content_text: content,
        content_type: contentType,
        timestamp: Date.now()
    };
}

// === FEEDBACK ===
function showSuccess() {
    _triggerBtn.classList.add('state-success');
    setTimeout(() => _triggerBtn.classList.remove('state-success'), 2000);
}

function showError() {
    _triggerBtn.classList.add('state-error');
    setTimeout(() => _triggerBtn.classList.remove('state-error'), 500);
}

// === LAUNCH ===
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
