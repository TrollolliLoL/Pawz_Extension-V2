# 📋 PLAN DE BATAILLE PAWZ V2

Ce document centralise les tickets pour les Agents 1 (Backend) et 2 (Frontend).
**Règle d'Or** : Ne pas cocher une case si le code n'est pas testé et valide.

---

---

## 🧠 PHASE 2 : INTELLIGENCE (LE CERVEAU)

**Objectif** : Connecter l'IA, gérer la file d'attente et parser les pages web.

### 🔧 BACKEND CORE (Agent 1)

- [ ] **[AI]** Implémenter `/lib/gemini.js` (Client API Google, Gestion des erreurs, Mode Stream/JSON)
- [ ] **[PARSER]** Implémenter `/lib/parser.js` (Nettoyage HTML intelligent pour réduire les tokens)
- [ ] **[QUEUE]** Coder `/background/queue_manager.js` (Logique de file d'attente, Concurrence, Retry)
- [ ] **[WATCHDOG]** Configurer les `chrome.alarms` pour la résilience.

### 🎨 FRONTEND CORE (Agent 2)

- [ ] **[TRIGGER]** Coder `/content/trigger_ui.js` (Interactions clic pastille, Feedback visuel immédiat)
- [ ] **[CAPTURE]** Brancher la logique de capture (Scraping -> Envoi Message -> Background)
- [ ] **[PDF]** Gérer la détection et l'extraction des PDF (Blob -> Base64)

---

## ✨ PHASE 3 : EXPÉRIENCE (LE WOW)

**Objectif** : Rendre l'interface fluide, belle et agréable (Micro-interactions).

### 🎨 FRONTEND CORE (Agent 2)

- [ ] **[DETAILS]** Implémenter la vue "Détail Candidat" (Slide-over, Accordéons animés)
- [ ] **[LIST]** Implémenter la vue "Liste" (Cartes candidats, Badges de score colorés)
- [ ] **[HEADER]** Créer le sélecteur de Job contextuel dans le Header.
- [ ] **[ANIM]** Ajouter les micro-animations (Hover pastille, Apparition cartes, Transitions)

### 🔧 BACKEND CORE (Agent 1)

- [ ] **[SETTINGS]** Gérer la sauvegarde des clés API et préférences utilisateur.
- [ ] **[CLEANUP]** Implémenter la purge automatique des vieux payloads IndexedDB.

---

## ✅ PHASE 4 : FINITIONS & QA

- [ ] **(Tous)** Vérification croisée (Cross-Check).
- [ ] **(Agent 3)** Audit final du code (Suppression logs, commentaires TODO).
- [ ] **(Agent 3)** Packaging et validation finale Manifest V3.
