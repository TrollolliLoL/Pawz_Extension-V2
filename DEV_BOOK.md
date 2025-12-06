# 📘 ORBITAL STATION - PAWZ V2 DEV BOOK

> Journal de bord de l'Architecte et Documentation Technique

## 📅 STATUS DU PROJET

- **Date de début** : 06/12/2025
- **Phase Actuelle** : PHASE 2 - INTELLIGENCE & FLUX DE DONNÉES
- **Version** : 2.0.0 (Manifest V3)

---

## 🏗️ INFRASTRUCTURE & CHOIX TECHNIQUES (ZÉRO BUILD)

Ce projet respecte strictement l'architecture "Zéro Build" imposée.

- **Runtime** : Chrome Extension Manifest V3.
- **JS** : ES Modules natifs (`import ... from ...`). Aucun bundler.
- **CSS** : Natif + Variables CSS (`:root`).
- **Persistence** :
  - `chrome.storage.local` : Métadonnées, UI State (Réactivité).
  - `IndexedDB` : Payloads lourds (PDFs Base64, Textes complets).

---

## 👥 RÔLES DES AGENTS (PROTOCOL)

- **Agent 1 (Backend Core)** : Responsable du "Cerveau". Service Worker, IndexedDB, Gemini API, Queue Manager.
- **Agent 2 (Frontend UX)** : Responsable de la "Vitrine". Side Panel, Content Scripts, Design System, Animations.
- **Agent 3 (Architecte)** : Supervision, Cohérence, Fichiers de configuration, Build manuel si nécessaire.

---

## 📝 LOG DES DÉCISIONS

### [06/12/2025] Initialisation

- Création de la structure de fichiers standardisée (lib, background, content, sidepanel).
- Migration des assets V1 (styles.css, sidepanel.html) depuis le dossier `CONTEXT`.
- Création des placeholders pour donner un cadre de travail aux Agents 1 et 2.
- Définition du `manifest.json` strict selon Module 7.3.
- **[Validation Phase 1]** : Side Panel fonctionnel, Pastille injectée.

### [06/12/2025] Lancement Phase 2

- Création du plan détaillé `PHASE_2.md`.
- Objectif : Connecter le backend (Gemini/Queue) et le Frontend dynamique.

### [06/12/2025] Phase 2 Backend (Agent 1) ✅

Implémentation complète du backend "Intelligence" :

**`lib/db.js`** - Wrapper IndexedDB

- Singleton pattern avec `getDB()`
- Méthodes : `init`, `savePayload`, `getPayload`, `deletePayload`, `clearAll`
- Gestion d'erreurs try/catch robuste

**`lib/utils.js`** - Helpers partagés

- `generateUUID()` : UUID v4 via crypto.randomUUID avec fallback
- `timestamp()` : Timestamp Unix en secondes
- `formatDate()` : Formatage FR

**`lib/parser.js`** - Nettoyage HTML

- `cleanHtml()` : Supprime scripts, styles, nav, footer, pubs
- `truncateText()` : Coupe à 25k caractères proprement
- Objectif : Réduire les tokens Gemini de 50-70%

**`lib/gemini.js`** - Client API Gemini

- `GeminiClient.analyzeCandidate()` : Analyse multimodale (texte/PDF)
- `GeminiClient.parseJobDescription()` : Parser fiche de poste
- Prompt système exact selon Module 5.3 SPECS
- Classification erreurs : `retryable` vs fatal
- Nettoyage JSON avec regex markdown

**`background/queue_manager.js`** - Gestionnaire de file

- Worker Pool : Max 3 analyses concurrentes
- Tri intelligent : Priorité haute + FIFO
- Watchdog : Alarm toutes les 1 minute
- Retry automatique : 3 tentatives max
- Detection items coincés > 5 minutes
- `addCandidate()` / `removeCandidate()`

**`background/background.js`** - Service Worker

- Messaging : `ADD_CANDIDATE`, `REMOVE`, `PRIORITIZE`, `RETRY`
- `storage.onChanged` réactif pour déclencher `processQueue()`
- Migration V1→V2 intégrée
- Ouverture Side Panel au clic icône

**`background/migration.js`** - Migration V1→V2

- Transformation `pawz_search_criteria` → Job V2
- Migration clé API et favoris
- Nettoyage clés obsolètes

---

## 📚 LEXIQUE & CONVENSIONS

- **Pastille** : Bouton flottant injecté dans la page (Trigger).
- **Payload** : Contenu brut (Texte ou Base64) extrait d'une page.
- **Job** : Une "Fiche de Poste" qui sert de contexte à l'analyse par l'IA.
