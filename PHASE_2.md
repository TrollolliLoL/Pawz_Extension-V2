# PHASE 2 : INTELLIGENCE & FLUX DE DONNÉES

**Objectif :** Connecter la Pastille, le Stockage et l'IA. C'est le cœur du système "Fire & Forget".

---

### 🔧 AGENT 1 (BACKEND CORE)

**Responsabilité :** Logique serveur, API, Base de données.

- [ ] **[GEMINI]** Implémenter `/lib/gemini.js`
  - Client API `fetch` vers Google Generative AI.
  - Gestion du `API_KEY` depuis `chrome.storage`.
  - Fonction `generateContent` avec gestion des erreurs (Retry).
- [ ] **[PARSER]** Implémenter `/lib/parser.js`

  - Fonction `cleanHTML(rawString)` pour supprimer navigation, footer, scripts.
  - Objectif : Réduire la consommation de tokens.

- [ ] **[QUEUE]** Finaliser `/background/queue_manager.js`

  - Boucle de traitement `processQueue()`.
  - Lecture `IndexedDB` -> Appel `Gemini` -> Écriture `Storage`.
  - Gestion des statuts : `PENDING` -> `PROCESSING` -> `COMPLETED`/`FAILED`.

- [ ] **[CONNEXION]** Mettre à jour `/background/background.js`
  - Écouter `chrome.runtime.onMessage` pour l'action `ADD_CANDIDATE`.
  - Stocker le Payload dans `IndexedDB` et la métadonnée dans `Storage`.

---

### 🎨 AGENT 2 (FRONTEND UX)

**Responsabilité :** Interface, Capture, Design.

- [ ] **[CAPTURE]** Mettre à jour `/content/content.js`

  - Fonction `extractProfile()` : Détection automatique (LinkedIn vs Web).
  - Envoi du message au background au clic sur la pastille.

- [ ] **[FEEDBACK]** Implémenter `/content/trigger_ui.js`

  - Gestion du clic.
  - Animation immédiate "Check Vert" ✅ (Rassurer l'utilisateur).
  - Gestion de l'erreur (Shake ❌) si aucun Job actif.

- [ ] **[DASHBOARD]** Mettre à jour `/sidepanel/sidepanel.js`

  - Fonction `renderDashboard()` : Lire `chrome.storage.local`.
  - Afficher dynamiquement les cartes candidats (plus de HTML statique).
  - Gérer l'état vide (Empty State).

- [ ] **[JOB]** Mettre à jour `/sidepanel/sidepanel.js`
  - Gérer le menu déroulant "Poste".
  - Création d'un nouveau poste (Simple prompt ou modal).
  - Changement de contexte (filtrer la liste par Job ID).
