/**
 * PAWZ V2 - Content Script (Refactored)
 * Trigger Button with Drag-Drop, Mini-Sidebar, Smart Analysis Logic
 * 
 * Structure IIFE pour isoler PDF vs Web
 */

(function() {
    'use strict';
    
    console.log("[Pawz] Content script loaded.");

    // ============================================================================
    // PDF DETECTION - Vérifié EN PREMIER
    // ============================================================================

    function isPdfContext() {
        const url = window.location.href;
        const urlLower = url.toLowerCase();
        // Nettoyer l'URL des paramètres pour détecter .pdf
        const urlWithoutParams = urlLower.split('?')[0];
        
        // PDF local (file://.../*.pdf)
        if (window.location.protocol === 'file:' && urlWithoutParams.endsWith('.pdf')) {
            console.log('[Pawz] PDF local détecté');
            return { type: 'local', url };
        }
        
        // PDF distant CDN Collective.work (avec ou sans .pdf)
        if (url.includes('cdn.collective.work')) {
            console.log('[Pawz] PDF CDN Collective détecté');
            return { type: 'cdn', url };
        }
        
        // Autre PDF distant (URL se terminant par .pdf)
        if (urlWithoutParams.endsWith('.pdf') && window.location.protocol.startsWith('http')) {
            console.log('[Pawz] PDF distant détecté');
            return { type: 'remote', url };
        }
        
        return null;
    }

    /**
     * Initialise le mode PDF (avec mini-sidebar comme le web)
     */
    let _pdfShadow = null;
    let _pdfBtn = null;
    let _pdfSidebar = null;
    let _currentPdfContext = null;
    
    function initPdfMode(pdfContext) {
        console.log('[Pawz] Mode PDF activé:', pdfContext);
        
        // Stocker le contexte pour les listeners
        _currentPdfContext = pdfContext;
        
        // Éviter les doublons
        if (document.getElementById('pawz-pdf-trigger')) return;
        
        // Créer le host
        const host = document.createElement('div');
        host.id = 'pawz-pdf-trigger';
        host.style.cssText = `
            position: fixed !important;
            bottom: 20px !important;
            right: 20px !important;
            z-index: 2147483647 !important;
        `;
        document.body.appendChild(host);
        
        _pdfShadow = host.attachShadow({ mode: 'open' });
        
        // Styles
        const style = document.createElement('style');
        style.textContent = `
            .pawz-pdf-btn {
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%);
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(30,64,175,0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid white;
                transition: transform 0.2s, box-shadow 0.2s;
                font-size: 24px;
            }
            .pawz-pdf-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(30,64,175,0.6);
            }
            .pawz-pdf-btn.loading {
                opacity: 0.7;
                pointer-events: none;
            }
            .pawz-pdf-btn.success {
                background: linear-gradient(135deg, #059669 0%, #10B981 100%);
            }
            .pawz-pdf-btn.error {
                background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%);
            }
            
            /* Mini Sidebar */
            .pawz-pdf-sidebar {
                position: absolute;
                bottom: 70px;
                right: 0;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                padding: 8px;
                min-width: 180px;
                opacity: 0;
                transform: translateY(10px);
                pointer-events: none;
                transition: opacity 0.2s, transform 0.2s;
            }
            .pawz-pdf-sidebar.open {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            .sidebar-btn {
                display: block;
                width: 100%;
                padding: 10px 12px;
                margin: 4px 0;
                border: none;
                border-radius: 8px;
                font-size: 13px;
                cursor: pointer;
                text-align: left;
                transition: background 0.15s;
            }
            .btn-analyze {
                background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%);
                color: white;
            }
            .btn-analyze:hover {
                background: linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%);
            }
            .btn-view {
                background: #F3F4F6;
                color: #374151;
            }
            .btn-view:hover {
                background: #E5E7EB;
            }
            .btn-history {
                background: #FEF3C7;
                color: #92400E;
            }
            .btn-history:hover {
                background: #FDE68A;
            }
            .sidebar-info {
                padding: 8px 12px;
                font-size: 11px;
                color: #6B7280;
                text-align: center;
            }
        `;
        _pdfShadow.appendChild(style);
        
        // Bouton principal
        _pdfBtn = document.createElement('div');
        _pdfBtn.className = 'pawz-pdf-btn';
        _pdfBtn.innerHTML = '📄';
        _pdfBtn.title = 'Analyser ce PDF';
        _pdfShadow.appendChild(_pdfBtn);
        
        // Mini sidebar
        _pdfSidebar = document.createElement('div');
        _pdfSidebar.className = 'pawz-pdf-sidebar';
        _pdfShadow.appendChild(_pdfSidebar);
        
        // Click sur le bouton = toggle sidebar
        _pdfBtn.addEventListener('click', () => togglePdfSidebar(pdfContext));
        
        // Fermer si clic en dehors
        document.addEventListener('click', (e) => {
            if (!host.contains(e.target)) {
                _pdfSidebar.classList.remove('open');
            }
        });
    }
    
    /**
     * Toggle la mini-sidebar PDF et met à jour les boutons
     */
    async function togglePdfSidebar(pdfContext) {
        if (_pdfSidebar.classList.contains('open')) {
            _pdfSidebar.classList.remove('open');
            return;
        }
        
        // Mettre à jour les boutons selon le contexte
        await updatePdfSidebarButtons(pdfContext);
        _pdfSidebar.classList.add('open');
    }
    
    // ============================================================================
    // PDF HELPER - Conversion Blob vers Base64
    // ============================================================================
    
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    
    /**
     * Génère un hash simple des poids de tuning
     */
    function generatePdfTuningHash(weights) {
        if (!weights) return null;
        return Object.values(weights).join('-');
    }
    
    /**
     * Compare deux hashes de tuning
     */
    function isPdfSameTuning(hash1, hash2) {
        if (!hash1 && !hash2) return true;
        if (!hash1 || !hash2) return false;
        return hash1 === hash2;
    }

    /**
     * Met à jour les boutons de la sidebar PDF (aligné sur le Web)
     */
    async function updatePdfSidebarButtons(pdfContext) {
        _pdfSidebar.innerHTML = '';
        
        const currentUrl = pdfContext.url;
        const circumstances = await getPdfCircumstances();
        
        if (!circumstances) {
            _pdfSidebar.innerHTML = '<div class="sidebar-info">Configurez un job et une clé API dans Pawz.</div>';
            return;
        }
        
        // Chercher les analyses existantes pour cette URL
        const analyses = await getAnalysesForPdfUrl(currentUrl);
        
        // Chercher une analyse exacte (même job, model, tuning)
        const exactMatch = analyses.find(a => {
            const sameJob = a.job_id === circumstances.job_id;
            const analysisModel = a.model || 'pro';
            const sameModel = analysisModel === circumstances.model;
            const sameTuning = isPdfSameTuning(a.tuning_hash, circumstances.tuning_hash);
            return sameJob && sameModel && sameTuning;
        });
        
        if (exactMatch) {
            // ========================================
            // CAS 3 : "Déjà Vu" (Exact Match)
            // ========================================
            const btnView = document.createElement('button');
            btnView.className = 'sidebar-btn btn-view';
            btnView.textContent = '👁️ Voir l\'analyse';
            btnView.addEventListener('click', () => viewPdfAnalysis(exactMatch.id));
            _pdfSidebar.appendChild(btnView);
            
            if (analyses.length > 1) {
                const btnHistory = document.createElement('button');
                btnHistory.className = 'sidebar-btn btn-history';
                btnHistory.textContent = `📂 Analyses précédentes (${analyses.length})`;
                btnHistory.addEventListener('click', () => openPdfHistory(currentUrl));
                _pdfSidebar.appendChild(btnHistory);
            }
            
        } else if (analyses.length > 0) {
            // ========================================
            // CAS 2 : "Contexte Différent"
            // ========================================
            const btnAnalyze = document.createElement('button');
            btnAnalyze.className = 'sidebar-btn btn-analyze';
            btnAnalyze.textContent = '🚀 Nouvelle analyse';
            btnAnalyze.addEventListener('click', () => launchPdfAnalysis(pdfContext, _pdfBtn));
            _pdfSidebar.appendChild(btnAnalyze);
            
            const btnHistory = document.createElement('button');
            btnHistory.className = 'sidebar-btn btn-history';
            btnHistory.textContent = `📂 Analyses précédentes (${analyses.length})`;
            btnHistory.addEventListener('click', () => openPdfHistory(currentUrl));
            _pdfSidebar.appendChild(btnHistory);
            
        } else {
            // ========================================
            // CAS 1 : "Nouveau" (Jamais analysé)
            // ========================================
            const btnAnalyze = document.createElement('button');
            btnAnalyze.className = 'sidebar-btn btn-analyze';
            btnAnalyze.textContent = '🚀 Lancer l\'analyse';
            btnAnalyze.addEventListener('click', () => launchPdfAnalysis(pdfContext, _pdfBtn));
            _pdfSidebar.appendChild(btnAnalyze);
        }
    }
    
    async function getPdfCircumstances() {
        try {
            const data = await chrome.storage.local.get(['pawz_jobs', 'pawz_settings', 'pawz_active_weights']);
            const jobs = data.pawz_jobs || [];
            const settings = data.pawz_settings || {};
            const weights = data.pawz_active_weights || null;
            const activeJob = jobs.find(j => j.active === true);
            
            if (!activeJob || !settings.api_key) return null;
            
            return {
                job_id: activeJob.id,
                model: settings.selected_model || 'fast',
                api_key: settings.api_key,
                tuning_hash: generatePdfTuningHash(weights)
            };
        } catch (e) {
            console.error("[Pawz] Error getting PDF circumstances:", e);
            return null;
        }
    }
    
    async function getAnalysesForPdfUrl(url) {
        try {
            const data = await chrome.storage.local.get('pawz_candidates');
            const candidates = data.pawz_candidates || [];
            return candidates.filter(c => c.source_url === url);
        } catch (e) {
            return [];
        }
    }
    
    function viewPdfAnalysis(analysisId) {
        _pdfSidebar.classList.remove('open');
        chrome.runtime.sendMessage({
            action: 'OPEN_ANALYSIS',
            analysisId: analysisId
        });
    }
    
    function openPdfHistory(url) {
        _pdfSidebar.classList.remove('open');
        chrome.runtime.sendMessage({
            action: 'OPEN_ANALYSES_FOR_URL',
            url: url
        });
    }
    
    // Écouter les changements de storage pour rafraîchir la sidebar
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && _currentPdfContext) {
            if (changes.pawz_candidates || changes.pawz_jobs || changes.pawz_settings) {
                // Rafraîchir si la sidebar est ouverte
                if (_pdfSidebar && _pdfSidebar.classList.contains('open')) {
                    updatePdfSidebarButtons(_currentPdfContext);
                }
            }
        }
    });

    /**
     * Lance l'analyse d'un PDF - Capture Binaire Universelle
     */
    async function launchPdfAnalysis(pdfContext, btn) {
        console.log('[Pawz] Lancement analyse PDF (Capture Binaire)...', pdfContext);
        
        // Fermer la sidebar
        if (_pdfSidebar) _pdfSidebar.classList.remove('open');
        
        btn.classList.add('loading');
        btn.innerHTML = '⏳';
        
        try {
            // ============================================
            // CAPTURE BINAIRE UNIVERSELLE : Fetch + Base64
            // ============================================
            console.log('[Pawz] Fetch du PDF:', pdfContext.url);
            
            let pdfBase64 = null;
            
            try {
                const response = await fetch(pdfContext.url);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const blob = await response.blob();
                
                // Vérifier que c'est bien un PDF
                if (!blob.type.includes('pdf') && blob.type !== 'application/octet-stream') {
                    console.warn('[Pawz] Type MIME inattendu:', blob.type);
                }
                
                pdfBase64 = await blobToBase64(blob);
                console.log('[Pawz] PDF capturé en Base64, taille:', pdfBase64.length);
                
            } catch (fetchError) {
                console.error('[Pawz] Erreur fetch PDF:', fetchError);
                
                // Message d'erreur explicite selon le type
                let errorMsg = '';
                if (pdfContext.type === 'local') {
                    errorMsg = '❌ Accès refusé au PDF local.\n\n' +
                        'Pour analyser les PDF locaux :\n' +
                        '1. Allez dans chrome://extensions\n' +
                        '2. Cliquez sur "Détails" de Pawz\n' +
                        '3. Activez "Autoriser l\'accès aux URL de fichiers"';
                } else {
                    errorMsg = `❌ Impossible de télécharger le PDF.\n\nErreur: ${fetchError.message}\n\nCela peut être dû à une restriction CORS du serveur.`;
                }
                
                alert(errorMsg);
                throw fetchError;
            }
            
            // Construire le payload avec le Base64
            const payload = {
                pdf_url: pdfContext.url,
                pdf_base64: pdfBase64,
                source_type: pdfContext.type
            };
            
            console.log('[Pawz] Envoi au background avec Base64...');
            
            const response = await chrome.runtime.sendMessage({
                action: 'ADD_PDF_CANDIDATE',
                payload: payload
            });
            
            console.log('[Pawz] Réponse background:', response);
            
            if (response && response.success) {
                btn.classList.remove('loading');
                btn.classList.add('success');
                btn.innerHTML = '✅';
                setTimeout(() => {
                    btn.classList.remove('success');
                    btn.innerHTML = '📄';
                }, 2000);
            } else {
                throw new Error(response?.error || 'Erreur inconnue');
            }
            
        } catch (error) {
            console.error('[Pawz] Erreur analyse PDF:', error);
            btn.classList.remove('loading');
            btn.classList.add('error');
            btn.innerHTML = '❌';
            setTimeout(() => {
                btn.classList.remove('error');
                btn.innerHTML = '📄';
            }, 3000);
        }
    }

    // === VÉRIFICATION PDF AU DÉMARRAGE ===
    const pdfContext = isPdfContext();
    
    if (pdfContext) {
        // Mode PDF : initialiser UI et STOP
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => initPdfMode(pdfContext));
        } else {
            initPdfMode(pdfContext);
        }
        return; // STOP ICI - Ne pas charger le code web
    }

    // ============================================================================
    // WEB MODE - Code existant (exécuté seulement si PAS un PDF)
    // ============================================================================
    
    console.log("[Pawz] Mode Web activé");

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
        const analysisModel = a.model || 'pro';
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
        // Retourne TOUTES les analyses pour cette URL (pending, processing, completed, failed)
        // Évite les doublons si une analyse est déjà en cours
        return candidates.filter(c => c.source_url === url);
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

})(); // Fin IIFE
