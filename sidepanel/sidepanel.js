/**
 * PAWZ V2 - Sidepanel Logic -- REFACTORED PHASE 2.1
 * UI Façade : Navigation Master-Detail (Jobs) + Analyse
 */

(function() {
    'use strict';

    // ===================================
    // STATE
    // ===================================
    let _activeJobId = null;
    let _editingJobId = null; // Job en cours d'édition (Peut être différent de l'actif)
    
    // UI State
    let _searchViewMode = 'LIST'; // 'LIST' | 'EDIT'
    
    // Form Data Cache
    let _mustCriteria = [];
    let _niceCriteria = [];

    // ===================================
    // INIT
    // ===================================
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('[Sidepanel] Init Phase 2.1 UI Facade...');
        
        await loadSettings();
        await refreshAll();

        setupTabsListeners();
        setupSettingsListeners();
        setupJobManagerListeners(); // Nouvelle logique navigation
        
        console.log('[Sidepanel] Ready.');
    });

    // ===================================
    // REACTIVITY
    // ===================================
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;

        if (changes.pawz_jobs) {
            refreshAll();
        }
        if (changes.pawz_candidates) {
            renderCandidatesList();
        }
        if (changes.pawz_settings) {
            loadSettings();
        }
    });

    async function refreshAll() {
        const data = await chrome.storage.local.get('pawz_jobs');
        const jobs = data.pawz_jobs || [];
        const activeJob = jobs.find(j => j.active);
        _activeJobId = activeJob ? activeJob.id : null;
        
        // Rafraîchir la vue en cours
        if (_searchViewMode === 'LIST') {
            renderJobsList(jobs);
        } else {
            // Si on édite un job, on met à jour le formulaire au cas où
            // Sauf si c'est un nouveau job pas encore sauvé
            if (_editingJobId && _editingJobId !== 'new') {
                const jobToEdit = jobs.find(j => j.id === _editingJobId);
                if (jobToEdit) fillJobForm(jobToEdit);
            }
        }

        renderCandidatesList(); // Toujours rafraîchir l'analyse en arrière-plan
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
    // JOB MANAGER LOGIC (NOUVEAU)
    // ===================================
    
    function setupJobManagerListeners() {
        // Bouton "+ Nouveau" (Liste)
        document.getElementById('btn-create-job').addEventListener('click', () => {
            openJobEditor('new');
        });

        // Bouton "Retour" (Edit)
        document.getElementById('btn-back-jobs').addEventListener('click', () => {
            switchSearchView('LIST');
        });

        // Bouton "Activer" (Edit)
        const btnActivate = document.getElementById('btn-activate-job');
        if (btnActivate) {
            btnActivate.addEventListener('click', async () => {
                if (_editingJobId && _editingJobId !== 'new') {
                    await activateJob(_editingJobId);
                    btnActivate.classList.add('active');
                    btnActivate.textContent = 'Actif';
                }
            });
        }

        // Logic d'édition du formulaire (Tags, Save)
        setupFormListeners();
    }

    // --- NAVIGATION HELPERS ---
    function switchSearchView(mode) {
        _searchViewMode = mode;
        const listView = document.getElementById('jobs-list-view');
        const editView = document.getElementById('job-edit-view');

        if (mode === 'LIST') {
            listView.classList.remove('hidden');
            editView.classList.add('hidden');
            // Re-render list to be fresh
            chrome.storage.local.get('pawz_jobs').then(d => renderJobsList(d.pawz_jobs || []));
        } else {
            listView.classList.add('hidden');
            editView.classList.remove('hidden');
        }
    }

    function openJobEditor(jobId) {
        _editingJobId = jobId;
        switchSearchView('EDIT');
        
        // Reset Form
        document.getElementById('job-title-input').value = '';
        document.getElementById('brief-text').value = '';
        _mustCriteria = [];
        _niceCriteria = [];
        
        const btnActivate = document.getElementById('btn-activate-job');
        btnActivate.classList.remove('active');
        btnActivate.textContent = 'Activer ce mandat';

        if (jobId === 'new') {
            document.getElementById('job-title-input').value = '';
            document.getElementById('job-title-input').placeholder = 'Titre du nouveau poste...';
            btnActivate.style.display = 'none'; // Pas d'activation avant save
            renderTags();
        } else {
            // Load Job Data
            chrome.storage.local.get('pawz_jobs').then(data => {
                const job = (data.pawz_jobs || []).find(j => j.id === jobId);
                if (job) fillJobForm(job);
            });
            btnActivate.style.display = 'block';
        }
    }

    function fillJobForm(job) {
        document.getElementById('job-title-input').value = job.title;
        document.getElementById('brief-text').value = job.raw_brief || '';
        _mustCriteria = job.criteria?.must_have || [];
        _niceCriteria = job.criteria?.nice_to_have || [];
        renderTags();

        const btnActivate = document.getElementById('btn-activate-job');
        if (job.active) {
            btnActivate.classList.add('active');
            btnActivate.textContent = 'Actif en cours';
        } else {
            btnActivate.classList.remove('active');
            btnActivate.textContent = 'Activer ce mandat';
        }
    }

    // --- RENDER JOBS LIST ---
    function renderJobsList(jobs) {
        const container = document.getElementById('jobs-container');
        container.innerHTML = '';

        if (jobs.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="margin-top:20px">
                    <p>Aucun mandat.</p>
                    <small>Créez votre première recherche ci-dessus.</small>
                </div>`;
            return;
        }

        // Tri: Actif d'abord, puis récents
        const sortedJobs = [...jobs].sort((a, b) => {
            if (a.active) return -1;
            if (b.active) return 1;
            return b.created_at - a.created_at;
        });

        sortedJobs.forEach(job => {
            const card = document.createElement('div');
            card.className = `job-card ${job.active ? 'is-active' : ''}`;
            
            const dateStr = new Date(job.created_at).toLocaleDateString('fr-FR', {
                day: '2-digit', month: '2-digit'
            });

            card.innerHTML = `
                <div class="job-card-header">
                    <span class="job-title">${job.title}</span>
                    <div class="job-status ${job.active ? 'active-badge' : 'inactive-badge'}">
                        ${job.active ? 'Actif' : 'Inactif'}
                    </div>
                </div>
                <div class="job-stats">
                    <span>📅 ${dateStr}</span>
                     <!-- TODO: Ajouter nombre de candidats via une jointure simple si besoin -->
                </div>
            `;
            
            // Interaction: Open Detail
            card.addEventListener('click', () => {
                 openJobEditor(job.id);
            });

            container.appendChild(card);
        });
    }

    // --- FORM LOGIC (Copied & Adapted) ---
    function setupFormListeners() {
        const mustInput = document.getElementById('must-input');
        const niceInput = document.getElementById('nice-input');
        const btnAddMust = document.getElementById('btn-add-must');
        const btnAddNice = document.getElementById('btn-add-nice');
        const btnSave = document.getElementById('btn-save-search');

        // Tags Logic
        const addMust = () => addTag(mustInput, _mustCriteria, 'must');
        const addNice = () => addTag(niceInput, _niceCriteria, 'nice');

        if (btnAddMust) btnAddMust.addEventListener('click', addMust);
        if (mustInput) mustInput.addEventListener('keypress', e => { if (e.key === 'Enter') addMust(); });
        if (btnAddNice) btnAddNice.addEventListener('click', addNice);
        if (niceInput) niceInput.addEventListener('keypress', e => { if (e.key === 'Enter') addNice(); });

        // Save Logic
        if (btnSave) {
            btnSave.addEventListener('click', async () => {
                 await saveCurrentJob();
            });
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
            });
        });
    }

    async function saveCurrentJob() {
        const title = document.getElementById('job-title-input').value.trim() || 'Nouveau Poste';
        const brief = document.getElementById('brief-text').value;

        const data = await chrome.storage.local.get('pawz_jobs');
        let jobs = data.pawz_jobs || [];

        if (_editingJobId === 'new') {
            // Create
            const newId = 'job_' + Date.now();
            const newJob = {
                id: newId,
                title: title,
                raw_brief: brief,
                criteria: { must_have: [..._mustCriteria], nice_to_have: [..._niceCriteria] },
                created_at: Date.now(),
                active: jobs.length === 0 // Actif si premier
            };
            jobs.push(newJob);
            _editingJobId = newId; 
        } else {
            // Update
            const idx = jobs.findIndex(j => j.id === _editingJobId);
            if (idx !== -1) {
                jobs[idx].title = title;
                jobs[idx].raw_brief = brief;
                jobs[idx].criteria = { must_have: [..._mustCriteria], nice_to_have: [..._niceCriteria] };
            }
        }

        await chrome.storage.local.set({ pawz_jobs: jobs });
        
        // UI Feedback
        const btnSave = document.getElementById('btn-save-search');
        const prevText = btnSave.textContent;
        btnSave.textContent = '✓ Sauvegardé';
        setTimeout(() => btnSave.textContent = prevText, 1500);
        
        // Show Activate button if it was hidden
        document.getElementById('btn-activate-job').style.display = 'block';
    }

    async function activateJob(jobId) {
        const data = await chrome.storage.local.get('pawz_jobs');
        const jobs = (data.pawz_jobs || []).map(j => ({
            ...j, 
            active: (j.id === jobId)
        }));
        await chrome.storage.local.set({ pawz_jobs: jobs });
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
    // CANDIDATES LIST (Legacy kept logic)
    // ===================================
    async function renderCandidatesList() {
        // (Logique existante de tri et rendu...)
        // Simplifié ici par soucis de place, mais même logique qu'avant
        const data = await chrome.storage.local.get(['pawz_candidates', 'pawz_jobs']);
        const allCandidates = data.pawz_candidates || [];
        const activeJobId = _activeJobId;
        const container = document.getElementById('candidates-list');
        const countPending = document.getElementById('count-pending');
        const countDone = document.getElementById('count-done');
        
        container.innerHTML = '';
        
        if (!activeJobId) {
            container.innerHTML = '<div class="empty-state"><p>Aucun job actif.</p></div>';
            return;
        }
        
        const candidates = allCandidates.filter(c => c.job_id === activeJobId);
        // Stats
        if (countPending) countPending.innerText = candidates.filter(c => ['pending','processing'].includes(c.status)).length;
        if (countDone) countDone.innerText = candidates.filter(c => c.status === 'completed').length;
        
        if (candidates.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Liste vide.</p><small>Analysez des profils !</small></div>';
            return;
        }

        candidates.forEach(c => {
             // Utilisation d'un helper simple pour recréer la carte
             const card = document.createElement('div');
             card.className = `candidate-card status-${c.status}`;
             card.innerHTML = `<div class="card-left"><div class="avatar">${(c.candidate_name||"C").slice(0,2)}</div></div>
                               <div class="card-center"><div class="name">${c.candidate_name}</div></div>`;
             container.appendChild(card);
        });
    }

    // ===================================
    // SETTINGS (Simple Facade)
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
        // Toggle Settings Overlay logic...
        document.getElementById('btn-settings').addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.remove('hidden');
        });
        document.getElementById('btn-close-settings').addEventListener('click', () => {
            document.getElementById('settings-overlay').classList.add('hidden');
        });
        document.getElementById('btn-save-api').addEventListener('click', async () => {
             const key = document.getElementById('api-key-input').value;
             if(key) {
                 await chrome.storage.local.set({ pawz_settings: { api_key: key }});
                 alert('Clé enregistrée !');
             }
        });
    }

})();
