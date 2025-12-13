/**
 * PAWZ V2 - Content Script (Refactored)
 * Trigger Button with Drag-Drop, Mini-Sidebar, Smart Analysis Logic
 * 
 * Structure IIFE pour isoler PDF vs Web
 */

(function() {
    'use strict';
    
    console.log("[Pawz:Content] Script loaded.");

    // ============================================================================
    // IDENTIFICATION UNIQUE DES CANDIDATS (Signature)
    // ============================================================================
    
    /**
     * Liste des domaines SPA où l'URL ne change pas entre candidats.
     * Sur ces sites, on utilise un hash du contenu pour identifier le candidat.
     */
    const SPA_DOMAINS = [
        'app.turnover-it.com'
    ];
    
    let _lastPageSignature = null;
    let _mutationDebounceTimer = null;
    
    /**
     * Hash djb2 - Algorithme rapide pour générer une signature numérique
     */
    function djb2Hash(str) {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    }
    
    /**
     * Détecte le type de site pour adapter la stratégie d'identification
     * @returns {'spa' | 'linkedin' | 'web'}
     */
    function getSiteType() {
        const hostname = window.location.hostname;
        
        if (SPA_DOMAINS.some(domain => hostname.includes(domain))) {
            return 'spa';
        }
        if (hostname.includes('linkedin.com')) {
            return 'linkedin';
        }
        return 'web';
    }
    
    /**
     * Génère une signature unique pour identifier le candidat sur la page.
     * 
     * STRATÉGIE :
     * - SPA : Hash du contenu (l'URL ne bouge pas)
     * - LinkedIn : origin + pathname (ignorer les params de tracking)
     * - Web : URL complète (les params ?id=123 sont importants)
     * 
     * @returns {string} - Signature unique
     */
    function getContentSignature() {
        const siteType = getSiteType();
        
        switch (siteType) {
            case 'spa':
                // Hash du contenu visible (nettoyé)
                const text = document.body.innerText
                    .replace(/\d+/g, '')       // Retirer les chiffres (dates, compteurs)
                    .replace(/\s+/g, ' ')      // Normaliser les espaces
                    .trim()
                    .substring(0, 10000);
                return 'hash:' + djb2Hash(text);
                
            case 'linkedin':
                // URL sans query params (éviter les ?miniProfileUrn...)
                return 'url:' + window.location.origin + window.location.pathname;
                
            default: // 'web'
                // URL complète (les params sont souvent nécessaires)
                return 'url:' + window.location.href;
        }
    }
    
    /**
     * Vérifie si on est sur un site SPA (nécessite MutationObserver)
     */
    function isSpaMode() {
        return getSiteType() === 'spa';
    }

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
            return { type: 'local', url };
        }
        
        // PDF distant CDN Collective.work (avec ou sans .pdf)
        if (url.includes('cdn.collective.work')) {
            return { type: 'cdn', url };
        }
        
        // Autre PDF distant (URL se terminant par .pdf)
        if (urlWithoutParams.endsWith('.pdf') && window.location.protocol.startsWith('http')) {
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
    let _pdfDragOverlay = null;
    let _currentPdfContext = null;
    let _pdfCurrentY = 50; // % from top (comme le web)
    const PDF_STORAGE_KEY_POS = 'pawz_pdf_trigger_position';
    
    async function loadPdfPosition() {
        try {
            const data = await chrome.storage.local.get(PDF_STORAGE_KEY_POS);
            if (data[PDF_STORAGE_KEY_POS]) {
                _pdfCurrentY = data[PDF_STORAGE_KEY_POS];
            }
        } catch (e) {
            // Silent
        }
    }
    
    async function savePdfPosition() {
        try {
            await chrome.storage.local.set({ [PDF_STORAGE_KEY_POS]: _pdfCurrentY });
        } catch (e) {
            // Silent
        }
    }
    
    function initPdfMode(pdfContext) {
        console.log('[Pawz:Content] Mode PDF activé');
        
        // Stocker le contexte pour les listeners
        _currentPdfContext = pdfContext;
        
        // Éviter les doublons
        if (document.getElementById('pawz-pdf-trigger')) return;
        
        // Charger la position puis créer l'UI
        loadPdfPosition().then(() => {
            createPdfTrigger(pdfContext);
        });
    }
    
    function createPdfTrigger(pdfContext) {
        // Injecter le CSS de l'overlay dans la page (hors Shadow DOM)
        if (!document.getElementById('pawz-pdf-overlay-style')) {
            const overlayStyle = document.createElement('style');
            overlayStyle.id = 'pawz-pdf-overlay-style';
            overlayStyle.textContent = `
                .pawz-pdf-drag-overlay {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    background: transparent !important;
                    z-index: 2147483646 !important;
                    cursor: grabbing !important;
                    user-select: none !important;
                }
            `;
            document.head.appendChild(overlayStyle);
        }
        
        // Créer le host (même style que le web)
        const host = document.createElement('div');
        host.id = 'pawz-pdf-trigger';
        host.style.cssText = `
            position: fixed !important;
            top: ${_pdfCurrentY}% !important;
            right: 15px !important;
            transform: translateY(-50%) !important;
            z-index: 2147483647 !important;
            pointer-events: auto !important;
        `;
        document.body.appendChild(host);
        
        _pdfShadow = host.attachShadow({ mode: 'open' });
        
        // Styles (harmonisés avec trigger.css)
        const style = document.createElement('style');
        style.textContent = `
            /* === PASTILLE PDF (même style que Web) === */
            .pawz-pdf-btn {
                width: 52px;
                height: 52px;
                border-radius: 50%;
                background: linear-gradient(145deg, #0077cc 0%, #005fa3 100%);
                border: 2px solid #004d85;
                box-shadow:
                    0 4px 12px rgba(0, 80, 160, 0.4),
                    inset 0 2px 3px rgba(255, 255, 255, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s ease;
                z-index: 2147483647;
                user-select: none;
                -webkit-user-drag: none;
            }
            .pawz-pdf-btn:hover {
                transform: scale(1.08);
                box-shadow: 0 6px 18px rgba(0, 80, 160, 0.5);
            }
            .pawz-pdf-btn.dragging {
                cursor: grabbing;
                transform: scale(1.05);
                box-shadow: 0 8px 24px rgba(0, 80, 160, 0.6);
            }
            .pawz-pdf-btn.loading {
                opacity: 0.7;
                pointer-events: none;
            }
            .pawz-pdf-btn.success {
                background: linear-gradient(145deg, #10B981 0%, #059669 100%) !important;
                border-color: #047857 !important;
            }
            .pawz-pdf-btn.error {
                background: linear-gradient(145deg, #ef4444 0%, #dc2626 100%) !important;
                border-color: #b91c1c !important;
            }
            
            .pdf-trigger-logo {
                width: 90%;
                height: 90%;
                object-fit: contain;
                pointer-events: none;
                user-select: none;
                -webkit-user-drag: none;
            }
            
            /* === OVERLAY DRAG === */
            .pawz-pdf-drag-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: transparent;
                z-index: 2147483646;
                cursor: grabbing;
                user-select: none;
            }
            
            /* === MINI SIDEBAR (même style que Web) === */
            .pawz-pdf-sidebar {
                position: absolute;
                right: 60px;
                top: 50%;
                transform: translateY(-50%);
                background: white;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                padding: 8px;
                min-width: 180px;
                z-index: 2147483646;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s, transform 0.2s;
            }
            .pawz-pdf-sidebar.open {
                opacity: 1;
                pointer-events: auto;
            }
            .pawz-pdf-sidebar.hidden {
                display: none;
            }
            
            /* Boutons sidebar */
            .sidebar-btn {
                display: block;
                width: 100%;
                padding: 10px 14px;
                margin-bottom: 4px;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                text-align: left;
                transition: all 0.2s;
            }
            .sidebar-btn:last-child {
                margin-bottom: 0;
            }
            .btn-analyze {
                background: linear-gradient(145deg, #0077cc 0%, #005fa3 100%);
                color: white;
            }
            .btn-analyze:hover {
                background: linear-gradient(145deg, #0088dd 0%, #006bb4 100%);
            }
            .btn-view {
                background: #f3f4f6;
                color: #374151;
            }
            .btn-view:hover {
                background: #e5e7eb;
            }
            .btn-history {
                background: #eff6ff;
                color: #1e40af;
                border: 1px solid #dbeafe;
            }
            .btn-history:hover {
                background: #dbeafe;
                border-color: #bfdbfe;
            }
            .sidebar-info {
                padding: 8px 12px;
                font-size: 11px;
                color: #6B7280;
                text-align: center;
            }
        `;
        _pdfShadow.appendChild(style);
        
        // Bouton principal avec LOGO (pas emoji)
        _pdfBtn = document.createElement('div');
        _pdfBtn.className = 'pawz-pdf-btn';
        _pdfBtn.title = 'Pawz - Analyser ce PDF';
        
        const img = document.createElement('img');
        img.src = chrome.runtime.getURL('assets/Logo Pawz Blanc VFinal.PNG');
        img.className = 'pdf-trigger-logo';
        img.draggable = false;
        img.onerror = () => { _pdfBtn.textContent = '🐾'; };
        _pdfBtn.appendChild(img);
        
        _pdfShadow.appendChild(_pdfBtn);
        
        // Mini sidebar
        _pdfSidebar = document.createElement('div');
        _pdfSidebar.className = 'pawz-pdf-sidebar hidden';
        _pdfSidebar.innerHTML = '<div class="sidebar-buttons"></div>';
        _pdfShadow.appendChild(_pdfSidebar);
        
        // Setup events (drag & drop + click)
        setupPdfEvents(host, pdfContext);
        
        // Fermer si clic en dehors
        document.addEventListener('click', (e) => {
            if (!host.contains(e.target)) {
                closePdfSidebar();
            }
        });
    }
    
    function closePdfSidebar() {
        _pdfSidebar.classList.remove('open');
        setTimeout(() => _pdfSidebar.classList.add('hidden'), 200);
    }
    
    function openPdfSidebar(pdfContext) {
        updatePdfSidebarButtons(pdfContext);
        _pdfSidebar.classList.remove('hidden');
        requestAnimationFrame(() => _pdfSidebar.classList.add('open'));
    }
    
    // === SETUP PDF EVENTS (Drag & Drop comme le Web) ===
    let _pdfDragStartPos = null;
    let _pdfHasMoved = false;
    
    function setupPdfEvents(host, pdfContext) {
        _pdfBtn.addEventListener('mousedown', (e) => handlePdfMouseDown(e, host, pdfContext));
    }
    
    function handlePdfMouseDown(e, host, pdfContext) {
        if (e.button !== 0) return; // Left click only
        
        e.preventDefault();
        e.stopPropagation();
        _pdfDragStartPos = { x: e.clientX, y: e.clientY };
        _pdfHasMoved = false;
        
        // Créer l'overlay IMMÉDIATEMENT pour le curseur grabbing
        _pdfDragOverlay = document.createElement('div');
        _pdfDragOverlay.className = 'pawz-pdf-drag-overlay';
        document.body.appendChild(_pdfDragOverlay);
        
        const onMouseMove = (moveEvent) => {
            const deltaX = Math.abs(moveEvent.clientX - _pdfDragStartPos.x);
            const deltaY = Math.abs(moveEvent.clientY - _pdfDragStartPos.y);
            
            // Threshold to distinguish click from drag
            if (deltaX > 5 || deltaY > 5) {
                _pdfHasMoved = true;
                _pdfBtn.classList.add('dragging');
                closePdfSidebar();
                
                const newY = moveEvent.clientY;
                _pdfCurrentY = Math.max(5, Math.min(95, (newY / window.innerHeight) * 100));
                host.style.top = `${_pdfCurrentY}%`;
            }
        };
        
        const cleanup = () => {
            // Retirer TOUS les listeners
            window.removeEventListener('mousemove', onMouseMove, true);
            window.removeEventListener('mouseup', onMouseUp, true);
            
            if (_pdfDragOverlay) {
                _pdfDragOverlay.remove();
                _pdfDragOverlay = null;
            }
            _pdfBtn.classList.remove('dragging');
            _pdfDragStartPos = null;
        };
        
        const onMouseUp = () => {
            const wasDrag = _pdfHasMoved;
            cleanup();
            
            if (wasDrag) {
                // It was a drag
                savePdfPosition();
            } else {
                // It was a click - toggle sidebar
                if (_pdfSidebar.classList.contains('hidden')) {
                    openPdfSidebar(pdfContext);
                } else {
                    closePdfSidebar();
                }
            }
        };
        
        // Utiliser window avec capture:true pour intercepter TOUS les événements
        // même ceux du viewer PDF de Chrome
        window.addEventListener('mousemove', onMouseMove, true);
        window.addEventListener('mouseup', onMouseUp, true);
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
     * Lance l'analyse d'un PDF
     * - Local (file://) : Délègue au Background (qui a les privilèges)
     * - CDN/Remote : Fetch + Base64 dans le Content Script
     */
    // Helper pour restaurer le logo PDF
    function restorePdfLogo(btn) {
        btn.innerHTML = '';
        const img = document.createElement('img');
        img.src = chrome.runtime.getURL('assets/Logo Pawz Blanc VFinal.PNG');
        img.className = 'pdf-trigger-logo';
        img.draggable = false;
        img.onerror = () => { btn.textContent = '🐾'; };
        btn.appendChild(img);
    }
    
    async function launchPdfAnalysis(pdfContext, btn) {
        
        // Fermer la sidebar
        if (_pdfSidebar) closePdfSidebar();
        
        // Sauvegarder le logo et afficher loading
        const logoImg = btn.querySelector('.pdf-trigger-logo');
        if (logoImg) logoImg.style.opacity = '0.5';
        btn.classList.add('loading');
        
        try {
            let payload = {
                pdf_url: pdfContext.url,
                source_type: pdfContext.type
            };
            
            // ============================================
            // PDF LOCAL : Déléguer au Background
            // ============================================
            if (pdfContext.type === 'local') {
                // PDF LOCAL : Déléguer au Background (qui a les privilèges)
            }
            // ============================================
            // PDF CDN/REMOTE : Fetch + Base64 ici
            // ============================================
            else {
                
                try {
                    const response = await fetch(pdfContext.url);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const blob = await response.blob();
                    
                    if (!blob.type.includes('pdf') && blob.type !== 'application/octet-stream') {
                        console.warn('[Pawz:Content] Type MIME inattendu:', blob.type);
                    }
                    
                    const pdfBase64 = await blobToBase64(blob);
                    
                    payload.pdf_base64 = pdfBase64;
                    
                } catch (fetchError) {
                    console.error('[Pawz:Content] Erreur fetch PDF:', fetchError.message);
                    alert(`❌ Impossible de télécharger le PDF.\n\nErreur: ${fetchError.message}\n\nCela peut être dû à une restriction CORS du serveur.`);
                    throw fetchError;
                }
            }
            
            const response = await chrome.runtime.sendMessage({
                action: 'ADD_PDF_CANDIDATE',
                payload: payload
            });
            
            if (response && response.success) {
                btn.classList.remove('loading');
                btn.classList.add('success');
                if (logoImg) logoImg.style.opacity = '1';
                setTimeout(() => {
                    btn.classList.remove('success');
                }, 2000);
            } else {
                // Afficher l'erreur du background
                const errorMsg = response?.error || 'Erreur inconnue';
                if (pdfContext.type === 'local' && errorMsg.includes('fetch')) {
                    alert('❌ Impossible de lire le fichier PDF local.\n\n' +
                        'Vérifiez que la case "Autoriser l\'accès aux URL de fichiers" est bien cochée :\n' +
                        '1. Allez dans chrome://extensions\n' +
                        '2. Cliquez sur "Détails" de Pawz\n' +
                        '3. Activez cette option');
                }
                throw new Error(errorMsg);
            }
            
        } catch (error) {
            console.error('[Pawz:Content] Erreur analyse PDF:', error.message);
            btn.classList.remove('loading');
            btn.classList.add('error');
            if (logoImg) logoImg.style.opacity = '1';
            setTimeout(() => {
                btn.classList.remove('error');
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
    
    console.log("[Pawz:Content] Mode Web activé");

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
            // Activer la détection SPA (sauf LinkedIn)
            setupSpaObserver();
        });
    }
    
    /**
     * MutationObserver pour détecter les changements de contenu (SPA UNIQUEMENT)
     * Avec debounce de 1s pour éviter le spam pendant le chargement
     */
    function setupSpaObserver() {
        // PERFORMANCE : Observer actif UNIQUEMENT sur les sites SPA
        // LinkedIn et Web classique utilisent le changement d'URL natif
        if (!isSpaMode()) return;
        
        console.log('[Pawz:Content] 👁️ Mode SPA détecté - Observer activé');
        
        const observer = new MutationObserver(() => {
            // Debounce : attendre 1s après le dernier changement
            if (_mutationDebounceTimer) {
                clearTimeout(_mutationDebounceTimer);
            }
            
            _mutationDebounceTimer = setTimeout(() => {
                const newSignature = getContentSignature();
                
                // Si la signature a changé, rafraîchir les boutons
                if (newSignature !== _lastPageSignature) {
                    _lastPageSignature = newSignature;
                    
                    // Rafraîchir si sidebar ouverte
                    if (_miniSidebar && _miniSidebar.classList.contains('open')) {
                        updateMiniSidebarButtons();
                    }
                }
            }, 1000);
        });
        
        // Observer les changements dans le body
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

async function loadPosition() {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEY_POS);
        if (data[STORAGE_KEY_POS]) {
            _currentY = data[STORAGE_KEY_POS];
        }
    } catch (e) {
        // Position loading error (silent)
    }
}

async function savePosition() {
    try {
        await chrome.storage.local.set({ [STORAGE_KEY_POS]: _currentY });
    } catch (e) {
        // Position saving error (silent)
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

    // Calculer la signature unique du candidat (adapte la stratégie selon le site)
    const currentSignature = getContentSignature();
    _lastPageSignature = currentSignature;
    
    // Chercher les analyses existantes avec cette signature exacte
    const analyses = await getAnalysesForSignature(currentSignature);
    
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
        // Storage data loaded

        const jobs = data.pawz_jobs || [];
        const settings = data.pawz_settings || {};
        const weights = data.pawz_active_weights || null;

        const activeJob = jobs.find(j => j.active === true);
        
        if (!activeJob || !settings.api_key) return null;

        return {
            job_id: activeJob.id,
            model: settings.selected_model || 'fast',
            api_key: settings.api_key,
            tuning_hash: generateTuningHash(weights)
        };
    } catch (e) {
        console.error("[Pawz:Content] Error getting circumstances:", e.message);
        return null;
    }
}

// === STORAGE LISTENER ===
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        // Rafraîchir si jobs, settings, tuning ou candidats changent
        if (changes.pawz_jobs || changes.pawz_settings || changes.pawz_active_weights || changes.pawz_candidates) {
            // Storage changed - refresh UI if sidebar open
            // Si la sidebar est ouverte, on rafraichit
            if (_miniSidebar && _miniSidebar.classList.contains('open')) {
                updateMiniSidebarButtons();
            }
        }
    }
});

/**
 * Recherche les analyses existantes par signature exacte.
 * La signature contient déjà toute l'info d'identité (hash ou URL selon le site).
 * @param {string} signature - Signature unique du candidat
 * @returns {Promise<Array>} - Candidats correspondants
 */
async function getAnalysesForSignature(signature) {
    try {
        const data = await chrome.storage.local.get('pawz_candidates');
        const candidates = data.pawz_candidates || [];
        
        // Filtrer par signature exacte
        return candidates.filter(c => c.content_signature === signature);
    } catch (e) {
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
            console.warn("[Pawz:Content] Analyse échouée:", response?.error);
            showError();
        }
    } catch (e) {
        console.error("[Pawz:Content] Erreur analyse:", e.message);
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

    if (!content || content.length < 50) return null;

    // Signature unique pour identifier ce candidat
    const signature = getContentSignature();

    return {
        source_url: url,
        page_title: title,
        content_text: content,
        content_type: contentType,
        content_signature: signature,
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
