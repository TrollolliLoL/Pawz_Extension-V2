/**
 * PAWZ V2 - Sidepanel Logic -- PHASE 2.1 REFINED
 * UI Façade : Navigation Master-Detail (Jobs)
 */

(function() {
    'use strict';

    // ===================================
    // STATE
    // ===================================
    let _activeJobId = null;
    let _editingJobId = null;
    let _allJobs = [];
    let _allCandidates = [];
    
    // UI State
    let _searchViewMode = 'LIST'; // 'LIST' | 'EDIT'
    
    // Form Data
    let _mustCriteria = [];
    let _niceCriteria = [];
    
    // Form State (dirty tracking)
    let _formDirty = false;
    let _originalFormData = null;

    // ===================================
    // INIT
    // ===================================
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('[Sidepanel] Init Phase 2.1 Refined...');
        
        await loadSettings();
        await refreshData();

        setupTabsListeners();
        setupSettingsListeners();
        setupJobManagerListeners();
        setupAccordionListeners();
        setupNavigationShortcuts();
        
        console.log('[Sidepanel] Ready.');
    });

    // ===================================
    // NAVIGATION SHORTCUTS
    // ===================================
    function setupNavigationShortcuts() {
        // MOUSE BACK BUTTONS
        window.addEventListener('mouseup', (e) => {
            if (e.button === 3 || e.button === 4) { // 3=Back, 4=Forward
                e.preventDefault();
                handleBackNavigation();
            }
        });

        // KEYBOARD BACK SHORTCUTS
        window.addEventListener('keydown', (e) => {
            // Alt + Left Arrow
            if (e.altKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                handleBackNavigation();
            }
            // Backspace (if not in input)
            if (e.key === 'Backspace') {
                const tag = document.activeElement.tagName;
                const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
                if (!isInput) {
                    e.preventDefault();
                    handleBackNavigation();
                }
            }
        });
    }

    function handleBackNavigation() {
        console.log("[Nav] Back shortcut triggered");

        // 1. DETAIL OVERLAY
        const detailOverlay = document.getElementById('detail-overlay');
        if (detailOverlay && !detailOverlay.classList.contains('hidden')) {
            document.getElementById('btn-close-detail')?.click();
            return;
        }

        // 2. SETTINGS OVERLAY
        const settingsOverlay = document.getElementById('settings-overlay');
        if (settingsOverlay && !settingsOverlay.classList.contains('hidden')) {
            document.getElementById('btn-back-settings')?.click();
            return;
        }

        // 3. JOB EDIT VIEW (Back to List)
        const jobEditView = document.getElementById('job-edit-view');
        if (jobEditView && !jobEditView.classList.contains('hidden')) {
            document.getElementById('btn-back-jobs')?.click();
            return;
        }
    }

    // ===================================
    // REACTIVITY
    // ===================================
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;

        if (changes.pawz_jobs || changes.pawz_candidates) {
            refreshData();
        }
        if (changes.pawz_settings) {
            loadSettings();
        }
    });

    async function refreshData() {
        const data = await chrome.storage.local.get(['pawz_jobs', 'pawz_candidates']);
        _allJobs = data.pawz_jobs || [];
        _allCandidates = data.pawz_candidates || [];
        
        const activeJob = _allJobs.find(j => j.active);
        _activeJobId = activeJob ? activeJob.id : null;
        
        // Rafraîchir la vue en cours
        if (_searchViewMode === 'LIST') {
            renderJobsList();
        } else if (_editingJobId && _editingJobId !== 'new') {
            // Si on édite un job existant, on peut refresh certaines parties
            renderJobCandidates(_editingJobId);
        }

        renderCandidatesList();
        updateActiveBanner(activeJob);
    }

    // ===================================
    // NAVIGATION TABS
    // ===================================
    function setupTabsListeners() {
        const tabSearch = document.getElementById('tab-search');
        const tabAnalysis = document.getElementById('tab-analysis');
        const viewSearch = document.getElementById('view-search');
        const viewAnalysis = document.getElementById('view-analysis');

        tabSearch.addEventListener('click', () => {
            tabSearch.classList.add('active');
            tabAnalysis.classList.remove('active');
            viewSearch.classList.remove('hidden');
            viewAnalysis.classList.add('hidden');
        });

        tabAnalysis.addEventListener('click', () => {
            tabAnalysis.classList.add('active');
            tabSearch.classList.remove('active');
            viewAnalysis.classList.remove('hidden');
            viewSearch.classList.add('hidden');
        });
    }

    // ===================================
    // JOB MANAGER LOGIC
    // ===================================
    
    function setupJobManagerListeners() {
        document.getElementById('btn-create-job').addEventListener('click', () => {
            openJobEditor('new');
        });

        document.getElementById('btn-back-jobs').addEventListener('click', () => {
            tryNavigateBack();
        });

        // Boutons Undo et Clear
        document.getElementById('btn-undo-form')?.addEventListener('click', undoFormChanges);
        document.getElementById('btn-clear-form')?.addEventListener('click', clearForm);

        // Navigation souris (bouton précédent) et clavier (Backspace)
        document.addEventListener('mouseup', (e) => {
            // Bouton 3 = bouton "précédent" de la souris
            if (e.button === 3 && _searchViewMode === 'EDIT') {
                e.preventDefault();
                tryNavigateBack();
            }
        });

        document.addEventListener('keydown', (e) => {
            // Backspace quand pas dans un input
            if (e.key === 'Backspace' && _searchViewMode === 'EDIT') {
                const tag = document.activeElement?.tagName;
                if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
                    e.preventDefault();
                    tryNavigateBack();
                }
            }
        });

        setupFormListeners();

        // Bouton "Analyser ma fiche de poste"
        const btnUnderstand = document.getElementById('btn-understand');
        if (btnUnderstand) {
            btnUnderstand.addEventListener('click', () => {
                alert("Cette fonctionnalité sera disponible dans la prochaine mise à jour !");
            });
        }
    }

    // --- Navigation avec confirmation ---
    function tryNavigateBack() {
        if (_formDirty) {
            const choice = confirm("Vous avez des modifications non enregistrées.\n\nCliquez OK pour les sauvegarder, ou Annuler pour les ignorer.");
            if (choice) {
                saveCurrentJob().then(() => switchSearchView('LIST'));
                return;
            }
        }
        switchSearchView('LIST');
    }

    // --- Undo : Recharger la version enregistrée ---
    function undoFormChanges() {
        if (_editingJobId === 'new') {
            // Pour un nouveau, on vide tout
            clearForm();
            return;
        }
        const job = _allJobs.find(j => j.id === _editingJobId);
        if (job) {
            fillJobForm(job);
        }
    }

    // --- Clear : Vider le formulaire (sans confirmation) ---
    function clearForm() {
        document.getElementById('job-title-input').value = '';
        document.getElementById('brief-text').value = '';
        _mustCriteria = [];
        _niceCriteria = [];
        renderTags();
        checkFormDirty();
    }

    // --- NAVIGATION HELPERS ---
    function switchSearchView(mode) {
        _searchViewMode = mode;
        const listView = document.getElementById('jobs-list-view');
        const editView = document.getElementById('job-edit-view');

        if (mode === 'LIST') {
            listView.classList.remove('hidden');
            editView.classList.add('hidden');
            _editingJobId = null;
            renderJobsList();
        } else {
            listView.classList.add('hidden');
            editView.classList.remove('hidden');
        }
    }

    function openJobEditor(jobId) {
        _editingJobId = jobId;
        switchSearchView('EDIT');
        
        const extraSections = document.getElementById('job-extra-sections');
        const titleInput = document.getElementById('job-title-input');
        const briefTextarea = document.getElementById('brief-text');
        
        // Reset Form
        titleInput.value = '';
        briefTextarea.value = '';
        _mustCriteria = [];
        _niceCriteria = [];
        renderTags();

        if (jobId === 'new') {
            // Nouveau Job : Cacher les sections extra
            extraSections.classList.add('hidden');
            titleInput.placeholder = 'Titre de la nouvelle recherche...';
        } else {
            // Édition : Afficher les sections extra
            extraSections.classList.remove('hidden');
            
            const job = _allJobs.find(j => j.id === jobId);
            if (job) {
                fillJobForm(job);
                renderJobCandidates(jobId);
                updateUnderstandBlock(job);
            }
        }
    }

    function fillJobForm(job) {
        document.getElementById('job-title-input').value = job.title || '';
        document.getElementById('brief-text').value = job.raw_brief || '';
        _mustCriteria = job.criteria?.must_have ? [...job.criteria.must_have] : [];
        _niceCriteria = job.criteria?.nice_to_have ? [...job.criteria.nice_to_have] : [];
        renderTags();
        
        // Stocker l'état original pour détecter les changements
        _originalFormData = {
            title: job.title || '',
            brief: job.raw_brief || '',
            must: [..._mustCriteria],
            nice: [..._niceCriteria]
        };
        _formDirty = false;
        updateSaveButton();
    }

    function updateUnderstandBlock(job) {
        const emptyState = document.getElementById('understand-empty');
        const resultState = document.getElementById('understand-result');
        const summaryEl = document.getElementById('understand-summary');

        if (job.ai_summary) {
            // L'analyse existe déjà
            emptyState.classList.add('hidden');
            resultState.classList.remove('hidden');
            summaryEl.textContent = job.ai_summary;
        } else {
            // Pas encore analysé
            emptyState.classList.remove('hidden');
            resultState.classList.add('hidden');
        }
    }

    // --- RENDER JOBS LIST (REFINED) ---
    function renderJobsList() {
        const container = document.getElementById('jobs-container');
        container.innerHTML = '';

        if (_allJobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="margin-top:20px">
                    <p>Aucune recherche.</p>
                    <small>Créez votre première recherche avec le bouton ci-dessus.</small>
                </div>`;
            return;
        }

        // Tri: Actif d'abord, puis les autres du plus récent au plus ancien
        const sortedJobs = [..._allJobs].sort((a, b) => {
            if (a.active && !b.active) return -1;  // Active en premier
            if (b.active && !a.active) return 1;
            // Pour les non-actifs, trier par date (récent d'abord)
            const dateA = a.created_at || 0;
            const dateB = b.created_at || 0;
            return dateB - dateA;  // Plus grand (récent) en premier
        });

        sortedJobs.forEach(job => {
            const card = createJobCard(job);
            container.appendChild(card);
        });
    }

    function createJobCard(job) {
        const card = document.createElement('div');
        card.className = `job-card ${job.active ? 'is-active' : ''}`;
        
        // Compter les candidats pour ce job
        const jobCandidates = _allCandidates.filter(c => c.job_id === job.id);
        const pendingCount = jobCandidates.filter(c => ['pending', 'processing'].includes(c.status)).length;
        const doneCount = jobCandidates.filter(c => c.status === 'completed').length;

        card.innerHTML = `
            <div class="job-card-top">
                <div class="job-card-header">
                    <span class="job-title">${job.title || 'Sans titre'}</span>
                </div>
                <div class="job-stats-row">
                    <span>⏳ ${pendingCount} en attente</span>
                    <span>✅ ${doneCount} analysés</span>
                </div>
            </div>
            <div class="job-actions-row">
                ${job.active 
                    ? `<span class="active-label">✓ Recherche active</span>`
                    : `<button class="btn-activate-card" data-job-id="${job.id}">Activer cette recherche</button>`
                }
                <button class="btn-delete-job" data-job-id="${job.id}" title="Supprimer">🗑️</button>
            </div>
        `;
        
        // Interaction: Clic sur la partie haute -> Édition
        card.querySelector('.job-card-top').addEventListener('click', () => {
            openJobEditor(job.id);
        });

        // Interaction: Activer
        const activateBtn = card.querySelector('.btn-activate-card');
        if (activateBtn) {
            activateBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await activateJob(job.id);
            });
        }

        // Interaction: Supprimer
        card.querySelector('.btn-delete-job').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Supprimer "${job.title}" et tous ses candidats ?`)) {
                await deleteJob(job.id);
            }
        });

        return card;
    }

    // --- RENDER CANDIDATES IN JOB DETAIL (MINI LIST) ---
    function renderJobCandidates(jobId) {
        const container = document.getElementById('job-candidates-list');
        if (!container) return;
        container.innerHTML = '';

        const candidates = _allCandidates.filter(c => c.job_id === jobId);

        if (candidates.length === 0) {
            container.innerHTML = '<div class="empty-state" style="margin:10px 0"><small>Aucun candidat analysé.</small></div>';
            return;
        }

        candidates.slice(0, 5).forEach(c => { // Max 5 pour la mini-liste
            const card = document.createElement('div');
            card.className = `candidate-card status-${c.status}`;
            const name = c.candidate_name || 'Candidat';
            card.innerHTML = `
                <div class="card-left"><div class="avatar">${name.slice(0,2).toUpperCase()}</div></div>
                <div class="card-center">
                    <div class="name">${name}</div>
                    <div class="status-text">${c.status === 'completed' ? (c.score || 0) + '%' : c.status}</div>
                </div>
                <div class="card-right"><button class="action-btn delete-mini" data-id="${c.id}" title="Supprimer">🗑️</button></div>
            `;
            
            // Click -> Open Detail
            card.addEventListener('click', () => openCandidateDetail(c.id));
            
            // Delete listener
            card.querySelector('.delete-mini').addEventListener('click', async (e) => {
                e.stopPropagation();
                if(confirm('Supprimer ce candidat ?')) {
                    const cands = _allCandidates.filter(x => x.id !== c.id);
                    await chrome.storage.local.set({ pawz_candidates: cands });
                    // The storage change will trigger a re-render
                }
            });
            
            container.appendChild(card);
        });

        if (candidates.length > 5) {
            const more = document.createElement('small');
            more.style.cssText = 'display:block; text-align:center; color:#6b7280; margin-top:8px;';
            more.textContent = `+ ${candidates.length - 5} autres`;
            container.appendChild(more);
        }
    }

    // --- FORM LOGIC ---
    function setupFormListeners() {
        const mustInput = document.getElementById('must-input');
        const niceInput = document.getElementById('nice-input');
        const btnAddMust = document.getElementById('btn-add-must');
        const btnAddNice = document.getElementById('btn-add-nice');
        const btnSave = document.getElementById('btn-save-search');
        const titleInput = document.getElementById('job-title-input');
        const briefTextarea = document.getElementById('brief-text');

        const addMust = () => { addTag(mustInput, _mustCriteria, 'must'); checkFormDirty(); };
        const addNice = () => { addTag(niceInput, _niceCriteria, 'nice'); checkFormDirty(); };

        btnAddMust?.addEventListener('click', addMust);
        mustInput?.addEventListener('keypress', e => { if (e.key === 'Enter') addMust(); });
        btnAddNice?.addEventListener('click', addNice);
        niceInput?.addEventListener('keypress', e => { if (e.key === 'Enter') addNice(); });

        // Détecter les changements sur les champs texte
        titleInput?.addEventListener('input', checkFormDirty);
        briefTextarea?.addEventListener('input', checkFormDirty);

        btnSave?.addEventListener('click', handleSaveOrActivate);
    }

    function checkFormDirty() {
        if (_editingJobId === 'new' || !_originalFormData) {
            _formDirty = true;
            updateSaveButton();
            return;
        }
        
        const currentTitle = document.getElementById('job-title-input').value;
        const currentBrief = document.getElementById('brief-text').value;
        
        const titleChanged = currentTitle !== _originalFormData.title;
        const briefChanged = currentBrief !== _originalFormData.brief;
        const mustChanged = JSON.stringify(_mustCriteria) !== JSON.stringify(_originalFormData.must);
        const niceChanged = JSON.stringify(_niceCriteria) !== JSON.stringify(_originalFormData.nice);
        
        _formDirty = titleChanged || briefChanged || mustChanged || niceChanged;
        updateSaveButton();
    }

    function updateSaveButton() {
        const btnSave = document.getElementById('btn-save-search');
        if (!btnSave) return;
        
        const job = _allJobs.find(j => j.id === _editingJobId);
        const isActive = job?.active || false;
        
        if (_editingJobId === 'new') {
            btnSave.textContent = 'Enregistrer';
            btnSave.className = 'btn-main primary';
        } else if (_formDirty) {
            btnSave.textContent = 'Enregistrer';
            btnSave.className = 'btn-main primary';
        } else if (!isActive) {
            btnSave.textContent = 'Activer cette recherche';
            btnSave.className = 'btn-main activate';
        } else {
            btnSave.textContent = '✓ Recherche active';
            btnSave.className = 'btn-main disabled';
        }
    }

    async function handleSaveOrActivate() {
        if (_formDirty || _editingJobId === 'new') {
            await saveCurrentJob();
        } else {
            // Pas de changements -> Activer la recherche
            await activateJob(_editingJobId);
            updateSaveButton();
        }
    }

    function addTag(input, list, type) {
        const val = input.value.trim();
        if (val && !list.includes(val)) {
            list.push(val);
            input.value = '';
            renderTags();
        }
    }

    function renderTags() {
        renderTagList('must-tags', _mustCriteria, 'must');
        renderTagList('nice-tags', _niceCriteria, 'nice');
    }

    function renderTagList(containerId, list, type) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        list.forEach((tag, idx) => {
            const span = document.createElement('span');
            span.className = `skill-tag ${type}`;
            span.innerHTML = `${tag} <span class="remove-x" data-idx="${idx}">×</span>`;
            container.appendChild(span);
        });
        container.querySelectorAll('.remove-x').forEach(el => {
            el.addEventListener('click', e => {
                e.stopPropagation();
                list.splice(parseInt(e.target.dataset.idx), 1);
                renderTags();
                checkFormDirty(); // Détecter la suppression
            });
        });
    }

    async function saveCurrentJob() {
        const title = document.getElementById('job-title-input').value.trim() || 'Nouvelle Recherche';
        const brief = document.getElementById('brief-text').value;

        let jobs = [..._allJobs];
        let wasNew = false;

        if (_editingJobId === 'new') {
            wasNew = true;
            const newId = 'job_' + Date.now();
            const newJob = {
                id: newId,
                title: title,
                raw_brief: brief,
                criteria: { must_have: [..._mustCriteria], nice_to_have: [..._niceCriteria] },
                created_at: Date.now(),
                active: jobs.length === 0
            };
            jobs.push(newJob);
            _editingJobId = newId;
            
            await chrome.storage.local.set({ pawz_jobs: jobs });
            
            // Afficher les sections extra sans réinitialiser le formulaire
            document.getElementById('job-extra-sections').classList.remove('hidden');
            // Mettre à jour _allJobs local
            _allJobs = jobs;
            const job = jobs.find(j => j.id === newId);
            if (job) {
                renderJobCandidates(newId);
                updateUnderstandBlock(job);
            }
        } else {
            const idx = jobs.findIndex(j => j.id === _editingJobId);
            if (idx !== -1) {
                jobs[idx].title = title;
                jobs[idx].raw_brief = brief;
                jobs[idx].criteria = { must_have: [..._mustCriteria], nice_to_have: [..._niceCriteria] };
            }
            await chrome.storage.local.set({ pawz_jobs: jobs });
            _allJobs = jobs;
        }
        
        // Mettre à jour l'état original (plus de diff après save)
        _originalFormData = {
            title: title,
            brief: brief,
            must: [..._mustCriteria],
            nice: [..._niceCriteria]
        };
        _formDirty = false;
        updateSaveButton();
        
        // Feedback
        const btnSave = document.getElementById('btn-save-search');
        const prevText = btnSave.textContent;
        btnSave.textContent = '✓ Sauvegardé';
        setTimeout(() => btnSave.textContent = prevText, 1500);
    }

    async function activateJob(jobId) {
        const jobs = _allJobs.map(j => ({
            ...j, 
            active: (j.id === jobId)
        }));
        await chrome.storage.local.set({ pawz_jobs: jobs });
    }

    async function deleteJob(jobId) {
        const jobs = _allJobs.filter(j => j.id !== jobId);
        const candidates = _allCandidates.filter(c => c.job_id !== jobId);
        await chrome.storage.local.set({ pawz_jobs: jobs, pawz_candidates: candidates });
    }

    // ===================================
    // ANALYSIS VIEW HELPERS
    // ===================================
    function updateActiveBanner(activeJob) {
        const banner = document.getElementById('active-job-banner');
        if (activeJob) {
            banner.classList.remove('hidden');
            document.getElementById('banner-job-title').textContent = activeJob.title;
        } else {
            banner.classList.add('hidden');
        }
    }

    // ===================================
    // CANDIDATES LIST (Main View)
    // ===================================
    // ===================================
    // CANDIDATES LIST (Main View)
    // ===================================
    async function renderCandidatesList() {
        const container = document.getElementById('candidates-list');
        const countPending = document.getElementById('count-pending');
        const countDone = document.getElementById('count-done');
        
        container.innerHTML = '';
        
        // Show ALL candidates (Global View)
        const candidates = _allCandidates;
        
        const pending = candidates.filter(c => ['pending','processing'].includes(c.status)).length;
        const done = candidates.filter(c => c.status === 'completed').length;
        if (countPending) countPending.textContent = pending;
        if (countDone) countDone.textContent = done;
        
        if (candidates.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Aucune analyse.</p><small>Activez une recherche et capturez des profils !</small></div>';
            return;
        }

        // Sort by most recent
        const sorted = [...candidates].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        sorted.forEach(c => {
            const card = document.createElement('div');
            card.className = `candidate-card status-${c.status}`;
            const name = c.candidate_name || 'Candidat';
            // Find job title
            const job = _allJobs.find(j => j.id === c.job_id);
            const jobTitle = job ? job.title : 'Job inconnu';

            card.innerHTML = `
                <div class="card-left"><div class="avatar">${name.slice(0,2).toUpperCase()}</div></div>
                <div class="card-center">
                    <div class="name">${name}</div>
                    <div class="job-subtitle">${jobTitle}</div>
                    <div class="status-text">${c.status === 'completed' ? (c.score || 0) + '% - ' + (c.verdict || '') : c.status}</div>
                </div>
                <div class="card-right"><button class="action-btn delete" data-id="${c.id}" title="Supprimer">🗑️</button></div>
            `;
            
            // Click -> Open Detail
            card.addEventListener('click', () => openCandidateDetail(c.id));

            // Delete
            card.querySelector('.delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                if(confirm('Supprimer ce candidat ?')) {
                    const cands = _allCandidates.filter(x => x.id !== c.id);
                    await chrome.storage.local.set({ pawz_candidates: cands });
                }
            });
            container.appendChild(card);
        });
    }

    /**
     * Ouvre l'overlay de détail candidat (V1 Style)
     */
    function openCandidateDetail(candidateId) {
        const candidate = _allCandidates.find(c => c.id === candidateId);
        if (!candidate) return;

        const overlay = document.getElementById('detail-overlay');
        
        // Populate
        populateDetailOverlay(candidate);
        
        // Show
        overlay.classList.remove('hidden');
        requestAnimationFrame(() => overlay.classList.add('visible'));
    }

    function populateDetailOverlay(candidate) {
        // 1. Data Preparation
        const score = candidate.score || 0;
        const verdict = candidate.verdict || 'Analysé';
        const name = candidate.candidate_name || 'Candidat';
        const currentJob = candidate.current_position || 'Poste inconnu';
        const initials = name.slice(0, 2).toUpperCase();

        // 2. Populate Header
        document.getElementById('detail-candidate-name').textContent = name;
        document.getElementById('detail-candidate-title').textContent = currentJob;
        document.getElementById('detail-initials').textContent = initials;
        
        document.getElementById('detail-score').textContent = score + '%';
        const verdictEl = document.getElementById('detail-verdict');
        verdictEl.textContent = verdict;
        
        // Verdict styling based on score/status (Simple logic)
        verdictEl.className = 'verdict-badge'; // Reset
        if (score >= 70) verdictEl.classList.add('verdict-match');
        else if (score >= 40) verdictEl.classList.add('verdict-maybe');
        else verdictEl.classList.add('verdict-nomatch');

        // 3. Populate Lists (Access static ULs)
        const strengthsList = document.getElementById('detail-strengths');
        const warningsList = document.getElementById('detail-warnings');
        const summaryText = document.getElementById('detail-summary');

        // Helper
        const fillList = (ul, items) => {
            if (!ul) return;
            ul.innerHTML = '';
            if (!items || items.length === 0) {
                ul.innerHTML = '<li>Aucune donnée.</li>';
                return;
            }
            items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                ul.appendChild(li);
            });
        };

        // Parse JSON if needed
        let strengths = candidate.strengths || [];
        let weaknesses = candidate.weaknesses || [];
        if (typeof strengths === 'string') try { strengths = JSON.parse(strengths); } catch(e) {}
        if (typeof weaknesses === 'string') try { weaknesses = JSON.parse(weaknesses); } catch(e) {}

        fillList(strengthsList, strengths);
        fillList(warningsList, weaknesses);
        
        summaryText.textContent = candidate.summary || "Aucun résumé disponible.";
    }

    function setupAccordionListeners() {
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const accordion = header.parentElement;
                accordion.classList.toggle('open');
                
                // Rotate chevron (optional if CSS handles it via .open)
                // CSS in Step 567 handled rotation using .open class on parent
            });
        });
    }

    // ===================================
    // SETTINGS & API VALIDATION
    // ===================================
    let _settingsOpen = false;

    /**
     * Charge les settings et met à jour l'affichage de l'état API.
     */
    async function loadSettings() {
        const data = await chrome.storage.local.get('pawz_settings');
        const settings = data.pawz_settings || {};
        
        const badge = document.getElementById('api-status');
        const configuredDisplay = document.getElementById('configured-key-display');
        const keyMasked = document.getElementById('key-masked');
        
        if (settings.api_key) {
            // Clé configurée
            if (badge) {
                badge.classList.add('connected');
                badge.textContent = 'Connecté';
            }
            // Garder l'input visible, montrer la clé EN DESSOUS
            if (configuredDisplay) {
                configuredDisplay.classList.remove('hidden');
                const key = settings.api_key;
                const masked = key.substring(0, 6) + '********';
                if (keyMasked) keyMasked.textContent = masked;
            }
        } else {
            // Pas de clé
            if (badge) {
                badge.classList.remove('connected');
                badge.textContent = 'Non connecté';
            }
            // Cacher la clé
            if (configuredDisplay) configuredDisplay.classList.add('hidden');
        }

        // Mettre à jour le modèle sélectionné
        const selectedModel = settings.selected_model || 'gemini-2.0-flash';
        document.querySelectorAll('.model-option').forEach(opt => {
            const isSelected = opt.dataset.model === selectedModel;
            opt.classList.toggle('selected', isSelected);
            const checkIcon = opt.querySelector('.check-icon');
            if (checkIcon) {
                checkIcon.classList.toggle('hidden', !isSelected);
            }
            if (isSelected) {
                const modelText = opt.querySelector('span').textContent;
                const trigger = document.getElementById('current-model-name');
                if (trigger) trigger.textContent = modelText;
            }
        });
    }

    /**
     * Valide une clé API avec un appel test à Gemini.
     * @param {string} apiKey - La clé à tester
     * @returns {Promise<{valid: boolean, error?: string}>}
     */
    async function testApiKey(apiKey) {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        
        try {
            const response = await fetch(testUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Test' }] }],
                    generationConfig: { maxOutputTokens: 10 }
                })
            });

            if (response.ok) {
                return { valid: true };
            }

            // Analyser l'erreur
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || response.statusText;

            if (response.status === 400 && errorMsg.includes('API key not valid')) {
                return { valid: false, error: 'Clé API invalide. Vérifiez votre clé.' };
            } else if (response.status === 403) {
                return { valid: false, error: 'Accès refusé. Vérifiez les permissions de votre clé.' };
            } else if (response.status === 429) {
                // Quota dépassé mais clé valide
                return { valid: true };
            }

            return { valid: false, error: `Erreur (${response.status}): ${errorMsg}` };

        } catch (error) {
            if (error.message.includes('fetch')) {
                return { valid: false, error: 'Erreur réseau. Vérifiez votre connexion.' };
            }
            return { valid: false, error: error.message };
        }
    }

    function openSettings() {
        document.getElementById('settings-overlay').classList.remove('hidden');
        _settingsOpen = true;
        // Reload pour afficher l'état actuel
        loadSettings();
    }

    function closeSettings() {
        document.getElementById('settings-overlay').classList.add('hidden');
        _settingsOpen = false;
    }

    function setupSettingsListeners() {
        document.getElementById('btn-settings').addEventListener('click', openSettings);
        document.getElementById('btn-back-settings')?.addEventListener('click', closeSettings);
        
        // Navigation souris et clavier pour fermer les Settings
        document.addEventListener('mouseup', (e) => {
            if (e.button === 3 && _settingsOpen) {
                e.preventDefault();
                closeSettings();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && _settingsOpen) {
                const tag = document.activeElement?.tagName;
                if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
                    e.preventDefault();
                    closeSettings();
                }
            }
        });

        // --- Bouton VALIDER ---
        document.getElementById('btn-save-api')?.addEventListener('click', async () => {
            const input = document.getElementById('api-key-input');
            const btn = document.getElementById('btn-save-api');
            const errorMsg = document.getElementById('api-error-msg');
            const key = input.value.trim();

            // Cacher l'erreur précédente
            if (errorMsg) errorMsg.classList.add('hidden');

            if (!key) {
                if (errorMsg) {
                    errorMsg.textContent = 'Veuillez entrer une clé API.';
                    errorMsg.classList.remove('hidden');
                }
                return;
            }

            // Mode chargement
            btn.classList.add('loading');
            btn.textContent = 'Validation...';

            // Tester la clé
            const result = await testApiKey(key);

            if (result.valid) {
                // Sauvegarder la clé
                const data = await chrome.storage.local.get('pawz_settings');
                const settings = data.pawz_settings || {};
                settings.api_key = key;
                if (!settings.selected_model) settings.selected_model = 'gemini-2.0-flash';
                await chrome.storage.local.set({ pawz_settings: settings });
                
                input.value = '';
                await loadSettings();
            } else {
                // Afficher l'erreur
                if (errorMsg) {
                    errorMsg.textContent = result.error || 'Clé API invalide';
                    errorMsg.classList.remove('hidden');
                }
            }

            // Reset bouton
            btn.classList.remove('loading');
            btn.textContent = 'Valider';
        });

        // --- Toggle Modèle ---
        document.getElementById('model-trigger')?.addEventListener('click', () => {
            const dropdown = document.getElementById('model-list-dropdown');
            const arrow = document.querySelector('.expand-arrow');
            dropdown.classList.toggle('hidden');
            arrow.classList.toggle('open');
        });

        // --- Sélection Modèle ---
        document.querySelectorAll('.model-option').forEach(option => {
            option.addEventListener('click', async () => {
                const model = option.dataset.model;
                
                // Mettre à jour le storage
                const data = await chrome.storage.local.get('pawz_settings');
                const settings = data.pawz_settings || {};
                settings.selected_model = model;
                await chrome.storage.local.set({ pawz_settings: settings });

                // Mettre à jour l'UI
                document.querySelectorAll('.model-option').forEach(opt => {
                    opt.classList.remove('selected');
                    opt.querySelector('.check-icon')?.classList.add('hidden');
                });
                option.classList.add('selected');
                option.querySelector('.check-icon')?.classList.remove('hidden');

                // Mettre à jour le texte du trigger
                const modelText = option.querySelector('span').textContent;
                document.getElementById('current-model-name').textContent = modelText;

                // Fermer le dropdown
                document.getElementById('model-list-dropdown').classList.add('hidden');
                document.querySelector('.expand-arrow').classList.remove('open');

                console.log('[Settings] Modèle sélectionné:', model);
            });
        });

        // --- Toggle Gemini Card (réduire/ouvrir) ---
        document.getElementById('toggle-gemini-card')?.addEventListener('click', () => {
            const content = document.getElementById('gemini-card-content');
            const chevron = document.getElementById('gemini-chevron');
            const isHidden = content.classList.toggle('hidden');
            // Si contenu visible, chevron pointe vers le haut (open)
            chevron.classList.toggle('open', !isHidden);
        });

        // --- Supprimer la clé API ---
        document.getElementById('btn-remove-api')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!confirm('Supprimer la clé API ?')) return;
            await chrome.storage.local.set({ pawz_settings: {} });
            await loadSettings();
        });

        // --- Retour Overlay Détail ---
        document.getElementById('btn-close-detail')?.addEventListener('click', () => {
            const overlay = document.getElementById('detail-overlay');
            overlay.classList.remove('visible');
            setTimeout(() => overlay.classList.add('hidden'), 300);
        });
    }

    function showApiFeedback(message, type) {
        const feedbackEl = document.getElementById('api-key-feedback');
        if (feedbackEl) {
            feedbackEl.textContent = message;
            feedbackEl.className = `api-key-feedback ${type}`;
            feedbackEl.classList.remove('hidden');
        }
    }

})();
