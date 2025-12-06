# 📋 PLAN DE BATAILLE PAWZ V2

Ce document centralise les tickets pour les Agents 1 (Backend) et 2 (Frontend).
**Règle d'Or** : Ne pas cocher une case si le code n'est pas testé et valide.

---

## 🚀 PHASE 1 : FONDATIONS (LE SQUELETTE)

**Objectif** : Avoir une extension qui s'installe, une base de données qui fonctionne, et une communication basique entre les composants.

### 🔧 BACKEND CORE (Agent 1)

- [ ] **[DB]** Implémenter `/lib/db.js` (Wrapper IndexedDB pour stocker les payloads lourds)
- [ ] **[UTILS]** Implémenter `/lib/utils.js` (Générateur UUID, Helpers de date)
- [ ] **[STORAGE]** Implémenter la structure de données initiale dans `chrome.storage.local` (Jobs, Candidates)
- [ ] **[WORKER]** Configurer `/background/background.js` (Listeners d'installation et logiques de base)
- [ ] **[MIGRATION]** Coder `/background/migration.js` (Script unique V1 -> V2)

### 🎨 FRONTEND CORE (Agent 2)

- [x] **[PANEL]** Adapter `/sidepanel/sidepanel.html` (Structure Master-Detail V2, nettoyage du HTML V1)
- [x] **[STYLE]** Nettoyer `/sidepanel/styles.css` (Intégrer les variables CSS du Golden Master, supprimer CSS obsolète)
- [x] **[LOGIC]** Implémenter `/sidepanel/sidepanel.js` (Boucle de rendu réactive `storage.onChanged`)
- [x] **[INJECT]** Implémenter `/content/content.js` (Injection Shadow DOM de la pastille)
- [x] **[UI]** Créer `/content/trigger.css` (Style "Golden Master" de la pastille flottante)

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
