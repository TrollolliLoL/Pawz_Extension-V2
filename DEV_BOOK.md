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

---

## 📚 LEXIQUE & CONVENSIONS

- **Pastille** : Bouton flottant injecté dans la page (Trigger).
- **Payload** : Contenu brut (Texte ou Base64) extrait d'une page.
- **Job** : Une "Fiche de Poste" qui sert de contexte à l'analyse par l'IA.
