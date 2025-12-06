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
        
        console.log('[Sidepanel] Ready.');
    });

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
            switchSearchView('LIST');
        });

        setupFormListeners();

        // Bouton "Analyser ma fiche de poste"
        const btnUnderstand = document.getElementById('btn-understand');
        if (btnUnderstand) {
            btnUnderstand.addEventListener('click', () => {
                // TODO: Phase 3 - Appeler l'IA
                alert("Cette fonctionnalité sera disponible dans la prochaine mise à jour !");
            });
        }
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

        // Tri: Actif d'abord, puis récents
        const sortedJobs = [..._allJobs].sort((a, b) => {
            if (a.active) return -1;
            if (b.active) return 1;
            return (b.created_at || 0) - (a.created_at || 0);
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
            <div class="job-card-header">
                <span class="job-title">${job.title || 'Sans titre'}</span>
            </div>
            <div class="job-stats-row">
                <span>⏳ ${pendingCount} en attente</span>
                <span>✅ ${doneCount} analysés</span>
            </div>
            <div class="job-actions-row">
                ${job.active 
                    ? `<span class="active-label">✓ Recherche active</span>`
                    : `<button class="btn-activate-card" data-job-id="${job.id}">Activer cette recherche</button>`
                }
                <button class="btn-delete-job" data-job-id="${job.id}" title="Supprimer">🗑️</button>
            </div>
        `;
        
        // Interaction: Clic sur le titre -> Édition
        card.querySelector('.job-title').addEventListener('click', (e) => {
            e.stopPropagation();
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
            `;
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

        const addMust = () => addTag(mustInput, _mustCriteria, 'must');
        const addNice = () => addTag(niceInput, _niceCriteria, 'nice');

        btnAddMust?.addEventListener('click', addMust);
        mustInput?.addEventListener('keypress', e => { if (e.key === 'Enter') addMust(); });
        btnAddNice?.addEventListener('click', addNice);
        niceInput?.addEventListener('keypress', e => { if (e.key === 'Enter') addNice(); });

        btnSave?.addEventListener('click', saveCurrentJob);
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
            });
        });
    }

    async function saveCurrentJob() {
        const title = document.getElementById('job-title-input').value.trim() || 'Nouvelle Recherche';
        const brief = document.getElementById('brief-text').value;

        let jobs = [..._allJobs];

        if (_editingJobId === 'new') {
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
            
            // Après création, on re-ouvre l'éditeur pour montrer les sections extra
            await chrome.storage.local.set({ pawz_jobs: jobs });
            openJobEditor(newId);
        } else {
            const idx = jobs.findIndex(j => j.id === _editingJobId);
            if (idx !== -1) {
                jobs[idx].title = title;
                jobs[idx].raw_brief = brief;
                jobs[idx].criteria = { must_have: [..._mustCriteria], nice_to_have: [..._niceCriteria] };
            }
            await chrome.storage.local.set({ pawz_jobs: jobs });
        }
        
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
    async function renderCandidatesList() {
        const container = document.getElementById('candidates-list');
        const countPending = document.getElementById('count-pending');
        const countDone = document.getElementById('count-done');
        
        container.innerHTML = '';
        
        if (!_activeJobId) {
            container.innerHTML = '<div class="empty-state"><p>Aucune recherche active.</p><small>Activez une recherche dans l\'onglet précédent.</small></div>';
            if (countPending) countPending.textContent = '0';
            if (countDone) countDone.textContent = '0';
            return;
        }
        
        const candidates = _allCandidates.filter(c => c.job_id === _activeJobId);
        
        const pending = candidates.filter(c => ['pending','processing'].includes(c.status)).length;
        const done = candidates.filter(c => c.status === 'completed').length;
        if (countPending) countPending.textContent = pending;
        if (countDone) countDone.textContent = done;
        
        if (candidates.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Liste vide.</p><small>Capturez des profils avec la pastille Pawz !</small></div>';
            return;
        }

        candidates.forEach(c => {
            const card = document.createElement('div');
            card.className = `candidate-card status-${c.status}`;
            const name = c.candidate_name || 'Candidat';
            card.innerHTML = `
                <div class="card-left"><div class="avatar">${name.slice(0,2).toUpperCase()}</div></div>
                <div class="card-center">
                    <div class="name">${name}</div>
                    <div class="status-text">${c.status === 'completed' ? (c.score || 0) + '% - ' + (c.verdict || '') : c.status}</div>
                </div>
                <div class="card-right"><button class="action-btn delete" data-id="${c.id}">🗑️</button></div>
            `;
            card.querySelector('.delete').addEventListener('click', async (e) => {
                e.stopPropagation();
                const cands = _allCandidates.filter(x => x.id !== c.id);
                await chrome.storage.local.set({ pawz_candidates: cands });
            });
            container.appendChild(card);
        });
    }

    // ===================================
    // SETTINGS
    // ===================================
    async function loadSettings() {
        const data = await chrome.storage.local.get('pawz_settings');
        const settings = data.pawz_settings || {};
        const badge = document.getElementById('api-status');
        if (badge) {
            if (settings.api_key) {
                badge.classList.add('connected');
                badge.textContent = 'Connecté';
            } else {
                badge.classList.remove('connected');
                badge.textContent = 'Non Configuré';
            }
        }
    }

    function setupSettingsListeners() {
        document.getElementById('btn-settings').addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.remove('hidden');
        });
        document.getElementById('btn-close-settings').addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.add('hidden');
        });
        document.getElementById('btn-back-settings')?.addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.add('hidden');
        });
        document.getElementById('btn-save-api').addEventListener('click', async () => {
            const key = document.getElementById('api-key-input').value.trim();
            if(key) {
                const data = await chrome.storage.local.get('pawz_settings');
                const settings = data.pawz_settings || {};
                settings.api_key = key;
                await chrome.storage.local.set({ pawz_settings: settings });
                document.getElementById('api-key-input').value = '';
                loadSettings();
                alert('Clé API enregistrée !');
            }
        });
    }

})();
