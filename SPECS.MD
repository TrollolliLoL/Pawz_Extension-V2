# 🛑 MASTER PROMPT & DIRECTIVES (PAWZ V2)

Tu es mon **Lead Developer Senior**, expert en Extensions Chrome (Manifest V3), JavaScript Natif et Intégration IA.
Ce document est ta **Bible**. Il contient les règles absolues, l'architecture technique et la référence visuelle.

---

## 1. LES COMMANDEMENTS ABSOLUS (RÈGLES D'OR)

1.  **Architecture "Zéro Build" (KISS) :**

    - **INTERDICTION** d'utiliser Webpack, Vite, NPM, React, Vue ou TypeScript compilé.
    - Code en **Vanilla JS (ES Modules)** uniquement.
    - CSS natif avec variables (`:root`).
    - Le code doit être lisible et exécutable directement par le navigateur.

2.  **Respect du Manifest V3 & Service Worker :**

    - Le `background.js` est un Service Worker éphémère. Il ne doit **JAMAIS** utiliser de variables globales persistantes (elles sont effacées quand le worker s'endort).
    - Toute persistance passe par `chrome.storage.local` (Métadonnées) ou `IndexedDB` (Fichiers lourds/PDF).
    - Utilise une architecture **Event-Driven** (Réactive aux événements `onChanged`).

3.  **Design System & UI :**

    - **Identité Visuelle :** Respecte scrupuleusement le "Golden Master" (Section 3 ci-dessous) pour les couleurs, arrondis et typographies.
    - **Logos :**
      - Dans le Side Panel (`sidepanel.html`) : Utilise `assets/logo.svg` (Couleur).
      - Dans la Pastille (`content.js`) : Utilise `assets/logo-blanc.svg` (Blanc sur fond bleu).
    - **Composants :** Réutilise les classes CSS existantes (`.btn-main`, `.accordion`, `.skill-tag`) du code V1 fourni en contexte.

4.  **Langue & Pédagogie :**

    - Tu dois **TOUJOURS** me répondre en **FRANÇAIS**.
    - Avant chaque action, explique-moi : "Voici ce que je vais faire (Quoi) et pourquoi (Pourquoi)".
    - Pas de jargon inutile.

5.  **Méthodologie par Phases (TICKETING) :**

    - **Ne commence jamais à coder tout le projet d'un coup.**
    - Au début, analyse tout et propose un **Plan d'Action**.
    - Crée un fichier `DEV_BOOK.md` à la racine pour noter tes choix techniques et l'avancement.
    - **Validation Explicite :** Avance fichier par fichier. Attends mon "OK" entre chaque étape critique.

6.  **Sécurité & Robustesse :**
    - Ne laisse jamais de clé API traîner dans le code (utilise `chrome.storage`).
    - Gère toujours les erreurs (ex: si l'IA ne répond pas, l'extension ne doit pas planter).

---

## 2. ARCHITECTURE TECHNIQUE CIBLE

### STRUCTURE DES FICHIERS

````text
/root
  ├── manifest.json            # Config V3
  ├── /assets                  # Images
  ├── /lib                     # Helpers partagés
  │     ├── db.js              # Wrapper IndexedDB (Payloads lourds)
  │     ├── gemini.js          # Client API Gemini
  │     ├── parser.js          # Nettoyage HTML
  │     └── utils.js           # UUID, Dates...
  ├── /background              # Le Cerveau (Service Worker)
  │     ├── background.js      # Orchestrateur
  │     ├── queue_manager.js   # Logique de file d'attente
  │     └── migration.js       # Script V1 -> V2
  ├── /content                 # Le Capteur
  │     ├── content.js         # Injection & Scraping
  │     ├── trigger.css        # Style Pastille
  │     └── trigger_ui.js      # Logique Pastille
  └── /sidepanel               # La Vitrine
        ├── sidepanel.html     # Structure Master-Detail
        ├── sidepanel.js       # Logique Réactive
        └── styles.css         # CSS Global (Hérité V1)
3. GOLDEN MASTER (RÉFÉRENCE VISUELLE V2)
Utilise ce code comme source de vérité pour le style des nouveaux éléments V2.
A. COULEURS & TYPO
Bleu Marine (Dominante) : #1E40AF
Orange (Action/Must) : #F97316
Vert (Succès/Nice) : #10B981
Fond App : #F0F2F5
Police : 'Inter', sans-serif.
B. LA CARTE CANDIDAT (LISTE)
Nouveau composant pour le Dashboard V2.
code
Html
<div class="candidate-card status-completed">
    <div class="card-left">
        <div class="avatar">JD</div>
    </div>
    <div class="card-center">
        <div class="name">Jean Dupont</div>
        <div class="status-text">85% - Profil Pertinent</div>
    </div>
    <div class="card-right">
        <!-- Boutons d'action rapides -->
        <button class="action-btn" title="Voir détail">👁️</button>
        <button class="action-btn delete" title="Supprimer">🗑️</button>
    </div>
</div>
C. LA PASTILLE (TRIGGER)
Code CSS exact pour le bouton flottant.
code
CSS
.pawz-trigger-icon-only {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(160deg, #00509d 0%, #003f7f 100%);
    border: 2px solid #003566;
    box-shadow:
        0 10px 25px rgba(0, 45, 90, 0.4),
        inset 0 3px 5px rgba(255, 255, 255, 0.25),
        inset 0 -3px 5px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    z-index: 2147483647;
}
.pawz-trigger-icon-only:hover {
    transform: scale(1.1);
    box-shadow: 0 15px 30px rgba(0, 45, 90, 0.5);
}
.trigger-icon-img {
    width: 50px;
    height: 50px;
    object-fit: contain;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
}

📂 MODULE 1 : VISION, PÉRIMÈTRE & USER STORIES
1.1 Le Concept (Elevator Pitch)
Pawz V2 est un "Copilote de Sourcing Asynchrone" conçu pour les recruteurs à haut volume.
Contrairement à la V1 (outil d'analyse synchrone "un par un" bloquant l'utilisateur), la V2 est un outil de productivité de masse "Fire & Forget".
Il permet au recruteur de constituer une file d'attente (Queue) de candidats depuis n'importe quelle source (LinkedIn, Apec, PDF local) en un clic, et de laisser l'IA travailler en arrière-plan sans jamais bloquer sa navigation.
1.2 La Psychologie de l'Utilisateur (Recruteur)
Son comportement (Le "Sprint") : Il ouvre rapidement 10, 20 ou 30 onglets de profils potentiels à la suite.
Son problème (La Friction) : Il perd un temps précieux à attendre qu'un outil d'analyse se charge pour chaque profil, ou à lire en diagonale pour vérifier des "Hard Skills".
Son besoin V2 (La Fluidité) : Il veut cliquer sur un bouton "Ajouter" et fermer l'onglet immédiatement. Il veut "dépiler" les résultats plus tard, une fois sa session de sourcing terminée.
1.3 Le Workflow Cible (Parcours Utilisateur)
🟢 Scénario A : Le "Sourcing Rapide" (Capture)
C'est l'action principale. Elle doit être instantanée (< 200ms).
Navigation : Le recruteur est sur une page de profil (ex: LinkedIn) ou un PDF.
Trigger : Il voit la Pastille Pawz (bouton flottant rond) en bas à droite de la page.
Action : Il clique sur la Pastille.
Feedback Immédiat :
La pastille NE DOIT PAS ouvrir de panneau latéral (pour ne pas masquer le CV).
La pastille joue une micro-animation (ex: transformation en "Check Vert" ✅ ou petit mouvement vers le haut).
Une notification discrète peut apparaître : "Candidat ajouté à la file".
Continuité : Le recruteur ferme l'onglet ou passe au suivant.
Arrière-plan : L'extension capture les données, les stocke, et le Service Worker lance l'analyse IA sans intervention humaine.
🔵 Scénario B : La "Revue de Détail" (Consommation)
C'est le moment où le recruteur analyse les résultats.
Ouverture : Le recruteur clique sur l'icône de l'extension ou utilise un raccourci pour ouvrir le Side Panel (Panneau Latéral Natif Chrome).
Vue Liste (Dashboard) : Il voit une liste de cartes correspondant aux profils sourcés.
Il voit les statuts en temps réel : ⏳ En cours, ✅ Terminé (avec Score), ❌ Erreur.
Navigation : Il clique sur une carte.
Vue Détail : Un panneau glisse (Slide-in) par la droite avec l'analyse complète (Points forts, Vigilance, Résumé).
Décision : Il peut supprimer le candidat ou passer au suivant via des boutons de navigation.
🟠 Scénario C : Le "Cold Start" (Premier Lancement)
Cas limite où l'utilisateur n'a pas encore configuré de poste.
Action : L'utilisateur clique sur la Pastille sur un profil LinkedIn.
Blocage : L'ajout est refusé.
Feedback :
La pastille secoue (animation "Shake" d'erreur).
Le Side Panel s'ouvre automatiquement.
Un message s'affiche : "Veuillez d'abord sélectionner ou créer une Fiche de Poste pour commencer l'analyse."
1.4 Périmètre des Sources & Stratégies d'Extraction
L'outil se veut "Agnostique" (fonctionne partout), mais adapte sa stratégie de capture selon la source :
Type de Source	Exemple	Stratégie Technique (Content Script)
LinkedIn	linkedin.com/in/*	Raw Text (Ctrl+A). On extrait document.body.innerText brut sans aucun nettoyage DOM pour éviter les systèmes anti-scraping. C'est l'IA qui fera le tri.
Web Structuré	Apec, Indeed, CVthèques	Smart Cleaning. On clone le DOM, on supprime les menus/pubs/footers, et on extrait le texte utile avant l'envoi pour économiser des tokens.
PDF Web	url.com/cv.pdf ou Visionneuse	Fetch Blob. Le script détecte l'URL, la télécharge en blob et la convertit en Base64.
PDF Local	file:///C:/cv.pdf	Native Access. Utilise l'API Chrome pour lire le fichier local (nécessite permission explicite de l'utilisateur).
1.5 Les Règles d'Or Fonctionnelles (Directives pour le Dev)
Zéro Blocage UI : L'utilisateur ne doit JAMAIS attendre devant une barre de chargement lors de la capture. L'interface de capture (Pastille) est totalement découplée du moteur d'analyse.
Persistance Absolue : Si l'utilisateur ferme Chrome alors que 10 analyses sont en cours ("Processing"), l'extension doit reprendre le travail exactement là où elle s'est arrêtée au prochain lancement. Aucune perte de donnée n'est tolérée.
Contexte Unique (Job-Centric) : Une analyse est toujours liée à une Fiche de Poste (Job) active au moment du clic.
Si je change de Job actif (ex: je passe de "Dev React" à "Sales"), les candidats ajoutés ensuite seront liés à "Sales".
Les anciens candidats restent liés à "Dev React" dans l'historique.


🏗️ MODULE 2 : ARCHITECTURE TECHNIQUE & FLUX DE DONNÉES
2.1 Stack & Contraintes ("Zéro Build")
Nous refusons toute complexité inutile. Le code doit être lisible, modulaire et exécutable directement par le navigateur.
Langage : JavaScript ES2022+ (Vanilla).
Système de Modules : ES Modules natifs (import ... from ...).
Note : Le fichier background.js doit être déclaré comme type: "module" dans le manifest.
Framework CSS : Aucun. CSS natif avec Variables (:root) pour le theming.
Build Tools : Aucun (Pas de Webpack, Vite, NPM, TypeScript compilé).
Persistance : Architecture "Offline-First" via chrome.storage.local et IndexedDB.
2.2 Structure des Fichiers (Arborescence Cible)
Cette structure sépare clairement les responsabilités pour éviter le code spaghetti.
code
Text
/root
  ├── manifest.json            # Configuration MV3
  ├── /assets                  # Icônes, Images
  ├── /lib                     # Bibliothèques partagées (Helpers)
  │     ├── db.js              # Wrapper pour IndexedDB (Payloads lourds)
  │     ├── gemini.js          # Client API Google Gemini
  │     ├── parser.js          # Logique de nettoyage HTML (Content Script)
  │     └── utils.js           # Helpers (UUID, Date format...)
  ├── /background              # Le "Cerveau" (Service Worker)
  │     ├── background.js      # Point d'entrée
  │     ├── queue_manager.js   # Gestion de la file d'attente & Watchdog
  │     └── storage_sync.js    # Gestion des événements Storage
  ├── /content                 # Les "Capteurs" (Pages Web)
  │     ├── content.js         # Script injecté
  │     ├── trigger.css        # Style de la pastille
  │     └── trigger_ui.js      # Logique UI de la pastille
  └── /sidepanel               # La "Vitrine" (UI Principale)
        ├── sidepanel.html
        ├── sidepanel.js
        ├── components.js      # Composants Web simples (Card, List)
        └── styles.css
2.3 Anatomie des Composants (Rôles & Responsabilités)
A. Le Service Worker (/background) - "Le Chef d'Orchestre"
Composant invisible qui tourne en fond. Il est le seul maître en écriture sur les statuts d'analyse.
Rôle 1 : Queue Manager. Il gère la file d'attente. Il surveille les items PENDING, respecte les quotas de l'API Gemini, et passe les items en PROCESSING puis COMPLETED ou FAILED.
Rôle 2 : Proxy API. Il effectue les appels fetch vers Gemini pour éviter les problèmes de CORS (Cross-Origin Resource Sharing) qui bloqueraient les Content Scripts.
Rôle 3 : Watchdog. Via chrome.alarms, il se réveille périodiquement (toutes les minutes) pour vérifier que la file d'attente n'est pas bloquée (ex: un item coincé en "Processing" depuis 5 minutes à cause d'un crash navigateur).
B. Le Content Script (/content) - "Le Capteur"
Script injecté dans la page visitée (LinkedIn, Apec, PDF Viewer).
Isolation : Utilise le Shadow DOM pour injecter la Pastille sans que le CSS de la page (ex: LinkedIn) ne casse le design du bouton.
Intelligence d'Extraction :
LinkedIn : Capture brute (document.body.innerText). Pas de nettoyage DOM (trop risqué).
Autres Sites : Nettoyage intelligent (suppression nav, footer, pubs) via parser.js avant envoi.
PDF : Détection de l'URL, envoi de la demande de téléchargement au Background.
C. Le Side Panel (/sidepanel) - "La Vitrine Réactive"
Interface utilisateur principale.
Passivité : Il ne fait aucun calcul complexe. Il est purement réactif.
Reactive UI : Il écoute l'événement chrome.storage.onChanged. Dès que le Background met à jour un statut ou un résultat, le Side Panel se redessine automatiquement. C'est ce qui donne l'effet "Temps Réel".
2.4 Stratégie de Données (Stockage Hybride)
C'est le point critique pour la performance (V2). Nous séparons les métadonnées (légères) du contenu (lourd).
1. chrome.storage.local (Métadonnées & UI)
Utilisé pour tout ce qui doit déclencher une mise à jour de l'interface (Réactivité).
Contenu : Liste des Jobs, Liste des Candidats (ID, Nom, Score, Statut, Date), Paramètres.
Limite : 5Mo (ou plus avec permission, mais lent si surchargé).
Avantage : Déclenche l'événement onChanged écouté par le Side Panel.
2. IndexedDB (Payloads & Fichiers)
Utilisé pour stocker le contenu brut à analyser.
Contenu : Le texte complet de la page web, ou la chaîne Base64 du PDF (qui peut faire 2, 5 ou 10 Mo).
Avantage : Asynchrone, supporte des centaines de méga-octets, ne ralentit pas le navigateur.
Cycle de vie :
Création : Au clic sur la pastille.
Lecture : Par le Service Worker au moment de l'analyse.
Suppression (Flush) : Immédiatement après l'analyse réussie (pour libérer l'espace).
2.5 Flux de Données (Data Flow) : Scénario "Capture Web"
Voici la séquence exacte des événements pour une capture :
USER ACTION : Clic sur la Pastille (Content Script).
EXTRACTION (Content) : Le script extrait le texte (Raw ou Cleaned).
MESSAGE (Content -> Background) :
Envoi d'un message runtime.sendMessage({ action: 'ADD_CANDIDATE', payload: ... }).
PERSISTANCE (Background) :
Sauvegarde du contenu brut (texte/base64) dans IndexedDB (Clé : payload_<UUID>).
Création de l'objet "Candidat" (ID, Nom temporaire, JobID, Status: PENDING) dans chrome.storage.local.
FEEDBACK (Side Panel) :
Le storage.onChanged se déclenche.
Le Side Panel (s'il est ouvert) affiche instantanément une nouvelle carte "En attente...".
PROCESSING (Service Worker Loop) :
Le Worker détecte un item PENDING.
Il récupère le payload depuis IndexedDB.
Il appelle l'API Gemini.
Il reçoit le JSON.
COMPLETION (Background) :
Mise à jour de l'objet Candidat dans chrome.storage.local (Status: COMPLETED, Score: 85, Résumé...).
Nettoyage : Suppression du payload dans IndexedDB.
UPDATE (Side Panel) :
Le storage.onChanged se déclenche.
La carte passe au vert, affiche le score et le résumé.
2.6 Communication Inter-Modules
Pour éviter les "Race Conditions" (conflits), nous respectons ces règles strictes :
Content Script -> Background : Toujours via chrome.runtime.sendMessage. Le Content Script n'écrit jamais directement dans la DB.
Side Panel -> Background : Via chrome.runtime.sendMessage pour les actions (ex: "Delete Candidate", "Prioritize Candidate"). Le Side Panel ne modifie pas la queue lui-même.
Background -> Side Panel : Jamais de communication directe. Le Background met à jour le Storage, et le Side Panel réagit. C'est le pattern "Single Source of Truth".




💾 MODULE 3 : MODÈLE DE DONNÉES & STATE MANAGEMENT
3.1 Stratégie de Stockage Hybride ("Light UI, Heavy Backend")
Pour résoudre le problème de performance lié aux PDF (Base64) sans bloquer le thread principal, nous divisons le stockage en deux couches distinctes.
Couche	Technologie	Rôle	Contenu	Persistance
Couche Chaude (UI)	chrome.storage.local	Métadonnées & Affichage. C'est la source de vérité pour le Side Panel. Rapide, synchronisé, déclenche les événements onChanged.	ID, Nom, Statut, Score, Résumé, ID du Job.	Permanente
Couche Froide (Data)	IndexedDB	Payloads Lourds. Stockage de masse asynchrone pour les fichiers bruts en attente d'analyse.	Texte brut du profil, Chaîne Base64 du PDF.	Temporaire (Supprimé après analyse)
3.2 Schéma chrome.storage.local (JSON Strict)
C'est la base de données NoSQL principale. Elle contient 3 collections (Arrays d'objets).
A. pawz_jobs (Les Fiches de Poste)
Permet de gérer le multi-contexte (ex: "Dev React" vs "Sales Manager").
code
JSON
[
  {
    "id": "job_1715420000_abc", // Timestamp + Random Suffix
    "title": "Senior Frontend Dev",
    "raw_brief": "Texte complet de la fiche de poste collé par l'user...",
    "criteria": {
      "must_have": ["React", "TypeScript", "5 ans exp"],
      "nice_to_have": ["Next.js", "Anglais"]
    },
    "created_at": 1715420000,
    "active": true // Un seul job peut être active:true à la fois
  }
]
B. pawz_candidates (La File Unifiée)
Contient UNIQUEMENT les métadonnées légères. Pas de gros texte ici.
code
JSON
[
  {
    "id": "cand_987654321", // UUID v4
    "job_id": "job_1715420000_abc", // Clé étrangère vers le Job
    "source_url": "https://www.linkedin.com/in/jean-dupont/",
    "source_type": "linkedin_web", // "linkedin_web", "pdf_local", "generic_web"

    // État du candidat
    "status": "pending", // "pending", "processing", "completed", "failed"
    "priority": "normal", // "normal" ou "high" (si user clique sur "Prioriser")

    // Données affichées dans l'UI (Remplies APRES analyse)
    "candidate_name": "Jean Dupont", // "Inconnu" tant que pas analysé
    "candidate_title": "Développeur Fullstack",
    "score": 85, // 0 à 100
    "verdict": "Profil Pertinent",

    // Résultat détaillé de l'IA (Texte seulement, reste léger)
    "analysis": {
      "summary": "Candidat solide avec 6 ans d'XP...",
      "strengths": ["Expert React", "Bonne communication"],
      "warnings": ["Pas d'expérience en Management"]
    },

    "error_msg": null, // Si status === 'failed'
    "timestamp_added": 1715420050,
    "timestamp_processed": 1715420060
  }
]
C. pawz_settings (Configuration)
code
JSON
{
  "api_key": "AIzaSy...",
  "model_id": "gemini-2.5-flash",
  "parsing_strategy": "hybrid" // Réservé pour évolutions futures
}
3.3 Schéma IndexedDB (Base : pawz_db)
Nous utiliserons une seule "Store" (Table) nommée payloads.
L'accès à IndexedDB étant verbeux en JS Vanilla, nous créerons un helper lib/db.js.
Structure de l'objet Payload :
code
JavaScript
{
  "id": "cand_987654321", // MÊME UUID que dans chrome.storage
  "type": "base64",       // "text" ou "base64"
  "content": "JVBERi0xLjQKJ...", // Le contenu lourd (peut faire 10 Mo)
  "created_at": 1715420050
}
3.4 Cycle de Vie de la Donnée (State Machine)
Le champ status dans pawz_candidates pilote toute la logique.
État : PENDING (En attente)
Déclencheur : User clique sur la pastille.
Action :
Payload sauvegardé dans IndexedDB.
Métadonnées sauvegardées dans Storage.
UI : Carte grise "En attente...".
État : PROCESSING (En cours)
Déclencheur : Le Service Worker prend le ticket (FIFO ou Priorité).
Action :
Lecture du payload depuis IndexedDB.
Envoi à l'API Gemini.
UI : Carte avec Spinner de chargement ⏳.
État : COMPLETED (Succès)
Déclencheur : Réponse 200 OK de Gemini avec JSON valide.
Action :
Mise à jour des métadonnées (Score, Nom, Analyse) dans Storage.
FLUSH (Important) : Suppression du payload dans IndexedDB pour libérer la mémoire.
UI : Carte colorée (Vert/Orange/Rouge selon score) + Bouton "Voir détail".
État : FAILED (Erreur)
Déclencheur : Erreur API (400, 500) ou JSON invalide.
Action :
Mise à jour error_msg dans Storage.
Décision V2 : On garde le payload dans IndexedDB pendant 24h (pour permettre un bouton "Réessayer"), puis nettoyage automatique.
UI : Carte Rouge ❌ avec message d'erreur.
3.5 Interface Helper (lib/db.js)
Pour simplifier la vie du développeur (et de l'agent IA), voici la signature des méthodes attendues pour interagir avec IndexedDB.
code
JavaScript
// lib/db.js

export const db = {
  // Initialise la DB (Ouvre la connexion, crée le store si inexistant)
  init: async () => { ... },

  // Sauvegarde un payload lourd
  savePayload: async (id, type, content) => { ... },

  // Récupère un payload pour l'analyse
  getPayload: async (id) => { ... },

  // Supprime un payload (Flush)
  deletePayload: async (id) => { ... },

  // Nettoyage complet (ex: désinstallation ou reset)
  clearAll: async () => { ... }
};
3.6 Règles de Gestion & Sécurité
Intégrité Référentielle : Si un candidat est supprimé de chrome.storage (Action "Poubelle"), son payload correspondant dans IndexedDB DOIT être supprimé immédiatement.
Quota : Si IndexedDB dépasse une certaine taille (ex: 500 Mo, peu probable mais possible), le système doit alerter l'utilisateur ou purger les vieux items FAILED.
Migration V1 : Au premier lancement, le script de migration ne touche pas à IndexedDB (car la V1 n'avait pas de PDF stockés), il migre juste les textes V1 vers le format JSON V2 dans chrome.storage.



⚙️ MODULE 4 : LOGIQUE CORE & QUEUE SYSTEM (LE MOTEUR)
4.1 Architecture "Event-Driven" (Réactive)
En Manifest V3, le Service Worker (background.js) est éphémère. Il s'endort après quelques secondes d'inactivité. Nous ne pouvons PAS utiliser de setInterval ou de boucle infinie while(true).
Nous utilisons une architecture réactive basée sur les événements :
Le Déclencheur Principal : chrome.storage.onChanged.
Dès que le Content Script ajoute un candidat (Status: PENDING) dans le storage, cet événement réveille instantanément le Service Worker.
Le Worker lance alors la fonction maîtresse : processQueue().
Le Filet de Sécurité (Watchdog) : chrome.alarms.
Une alarme récurrente (toutes les 1 minute) est configurée.
Rôle : Vérifier s'il reste des items PENDING qui n'ont pas été traités (cas où le navigateur a tué le worker en plein milieu d'une opération ou bug réseau). Si oui, elle relance processQueue().
4.2 Algorithme du "Worker Pool" (Gestion de la Concurrence)
L'objectif est de traiter jusqu'à 3 analyses en parallèle (pour Gemini Flash) afin d'aller vite, tout en gardant une marge de sécurité.
Logique de la fonction processQueue() :
Lecture de l'état : Récupérer toute la liste pawz_candidates depuis chrome.storage.local.
Inventaire :
processingItems = Items dont le status est PROCESSING.
pendingItems = Items dont le status est PENDING.
Calcul de Capacité :
MAX_CONCURRENT = 3 (Configurable).
slotsAvailable = MAX_CONCURRENT - processingItems.length.
Condition d'Arrêt :
Si slotsAvailable <= 0 : On arrête (le pool est plein).
Si pendingItems.length === 0 : On arrête (rien à faire).
Sélection (Tri Intelligent) :
On trie pendingItems par ordre de priorité :
priority === 'high' (Items priorisés par l'utilisateur).
timestamp_added croissant (FIFO - Premier arrivé, premier servi).
Lancement (Batch) :
On prend les X premiers items (où X = slotsAvailable).
Pour chaque item :
On passe son status à PROCESSING immédiatement dans le Storage (pour éviter qu'une autre exécution parallèle ne le prenne).
On lance la fonction asynchrone analyzeCandidate(item) sans attendre (no await) pour ne pas bloquer la boucle.
4.3 Pipeline de Traitement (Le Tunnel d'Analyse)
Voici le détail séquentiel de la fonction analyzeCandidate(candidate) :
Récupération du Payload (IndexedDB) :
Appel à db.getPayload(candidate.id).
Erreur critique : Si le payload est introuvable (nettoyage agressif ou bug), on marque le candidat en FAILED (Msg: "Données sources perdues") et on arrête.
Récupération du Contexte (Storage) :
On récupère le Job associé via candidate.job_id dans pawz_jobs.
Cela nous donne le Brief, les Must Have et Nice Have.
Appel IA (Gemini Client) :
Construction du Prompt (voir Module 5).
Appel API (fetch vers Google).
Note : Si le payload est un PDF (Base64), on utilise le mode Multimodal de Gemini.
Parsing & Validation :
On reçoit le texte de l'IA.
On tente de le parser en JSON (JSON.parse).
On vérifie que les champs obligatoires (score, verdict) sont là.
Finalisation (Succès) :
Mise à jour Storage : On met à jour l'objet candidat :
status: "COMPLETED"
score: 85
analysis: { ...JSON complet... }
Flush (Nettoyage) : Appel à db.deletePayload(candidate.id) pour vider IndexedDB. C'est impératif.
4.4 Gestion des Erreurs & Retry
L'API peut échouer. Le système doit être résilient.
A. Erreurs Fatales (Pas de Retry)
Types : 400 Bad Request (Requête invalide), JSON Parsing Error (L'IA a halluciné le format), Payload Missing.
Action : Status passe à FAILED. Message d'erreur affiché en rouge. Le payload est supprimé d'IndexedDB (inutile de garder un truc cassé).
B. Erreurs Temporaires (Retry Automatique)
Types : 429 Too Many Requests (Quota dépassé), 500 Server Error, Network Error (Coupure Wifi).
Action :
On ne passe PAS en FAILED.
On repasse le status en PENDING.
On incrémente un compteur interne (ex: retry_count).
Si retry_count > 3 -> Passage en FAILED.
Backoff : On planifie une alarme chrome.alarms dans 1 minute pour réessayer.
4.5 Interactions Utilisateur (Interruptions)
L'utilisateur peut intervenir sur la file depuis le Side Panel. Le Background doit gérer ces cas limites.
A. Suppression ("Poubelle") pendant l'analyse
Scénario : L'item est en PROCESSING (requête partie chez Google). L'utilisateur clique sur "Supprimer".
Action Immédiate : Le Side Panel supprime l'item du Storage via un message.
Conséquence Background :
La requête Gemini revient 5 secondes plus tard avec le résultat.
Au moment de sauvegarder (analyzeCandidate étape 5), le code vérifie : Est-ce que cet ID existe toujours dans pawz_candidates ?
Réponse : Non.
Action : On jette le résultat à la poubelle silencieusement. On s'assure juste de bien faire le db.deletePayload(id) pour ne pas laisser de déchet dans IndexedDB.
B. Priorisation ("Jump Queue")
Scénario : L'item est 15ème dans la file. L'utilisateur clique sur "Prioriser" (Flèche Haut).
Action Immédiate : Le Side Panel met à jour le champ priority: 'high' dans le Storage.
Conséquence Background :
L'événement onChanged se déclenche.
processQueue() est relancé.
Grâce à l'étape de tri (4.2 point 5), cet item passe en tête de liste pour le prochain slot libre.








🧠 MODULE 5 : INTELLIGENCE ARTIFICIELLE & PROMPT ENGINEERING
5.1 Configuration du Client Gemini
Nous utilisons l'API Google Generative AI (generativelanguage.googleapis.com).
L'objectif est d'obtenir des réponses déterministes (toujours le même résultat pour le même CV) et au format JSON Strict.
A. Modèles & Rôles
Le système supporte deux modes configurables dans pawz_settings :
Mode "Rapide" (Défaut) : gemini-1.5-flash (ou gemini-2.0-flash-exp selon dispo).
Usage : 90% des cas. Rapide (< 2s), pas cher, contexte large.
Mode "Expert" (Thinking) : gemini-1.5-pro.
Usage : Pour les profils exécutifs complexes ou les PDF très lourds. Plus lent, raisonnement plus nuancé.
B. Hyperparamètres (Configuration Fetch)
Pour garantir la stabilité du JSON :
code
JavaScript
const GENERATION_CONFIG = {
  temperature: 0.2,        // Très bas pour éviter les hallucinations créatives
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 8192,
  responseMimeType: "application/json" // FORCE la sortie JSON native
};

const SAFETY_SETTINGS = [
  // On désactive les filtres car un CV peut contenir des termes sensibles légitimes
  // (ex: "Membre de l'association Women in Tech", "Nationalité", etc.)
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];
5.2 Feature A : Le "Job Parser" (Analyseur de Fiche de Poste)
Fonction : Transformer un texte en vrac (copié-collé d'un mail ou d'un site carrière) en critères structurés pour le matching.
Prompt Système (Job Parser)
code
Text
RÔLE :
Tu es un Expert en Recrutement Technique. Ta mission est de structurer une Fiche de Poste brute.

INSTRUCTION :
Analyse le texte fourni. Extrais les critères clés et sépare-les strictement en deux catégories.
Ignore le blabla corporate ("Leader mondial de...", "Babyfoot..."). Concentre-toi sur le besoin opérationnel.

RÈGLES D'EXTRACTION :
1. "must_criteria" : Les compétences BLOQUANTES (ex: "Anglais Courant", "5 ans d'XP", "Maîtrise React"). Si le candidat ne l'a pas, il est rejeté.
2. "nice_criteria" : Les compétences BONUS (ex: "Connaissance de Docker", "Expérience en Start-up").
3. Les critères doivent être courts (max 5 mots).

FORMAT DE SORTIE (JSON) :
{
  "job_title": "Titre normalisé du poste (ex: Senior Backend Engineer)",
  "summary": "Résumé du poste en 1 phrase percutante.",
  "criteria": {
    "must_have": ["Critère 1", "Critère 2"...],
    "nice_to_have": ["Bonus 1", "Bonus 2"...]
  }
}
5.3 Feature B : L'Analyseur de Candidat (Le Cœur)
Fonction : Comparer un profil (Texte ou PDF) avec le Job analysé précédemment.
Gestion Multimodale (Input)
Le prompt est dynamique.
Cas Texte (Web) : On injecte le texte nettoyé directement dans le prompt.
Cas PDF (Base64) : On envoie le prompt textuel + un objet inlineData contenant le Base64 du PDF (Mime: application/pdf). Gemini "lit" le PDF visuellement.
Prompt Système (Candidate Analyzer)
code
Text
RÔLE :
Tu es "Pawz", un Recruteur Senior impartial et factuel.

CONTEXTE DU POSTE (JOB) :
[TITRE] : {{job_title}}
[RESUME] : {{job_summary}}
[CRITÈRES IMPÉRATIFS (MUST)] : {{must_list}}
[CRITÈRES BONUS (NICE)] : {{nice_list}}

PROFIL DU CANDIDAT :
{{candidate_content_placeholder}}
(Note technique : Si PDF, ce placeholder est vide et le contenu est dans l'attachment).

RÈGLES DE SCORING "HUMAIN" (CRITIQUE) :
1. CUMUL D'EXPÉRIENCE : Ne regarde pas juste le dernier poste. Additionne toutes les expériences pertinentes.
   (Ex: 2 ans "Dev Front" + 3 ans "Lead Tech" = 5 ans d'expérience Technique).
2. DIPLÔME VS RÉALITÉ : L'expérience pratique prévaut sur le diplôme, sauf si le diplôme est un MUST explicite (ex: Médecin, Avocat).
3. SOFT SKILLS : Déduis-les du parcours (ex: "Team Lead" = Management, "Freelance" = Autonomie).

ÉCHELLE DE NOTATION :
- 0-59 (Non pertinent) : Manque un MUST critique.
- 60-79 (Potentiel) : A les bases, mais manque de séniorité ou de stack exacte.
- 80-94 (Pertinent) : Fit solide. Coche tous les MUST.
- 95-100 (Jackpot) : Fit parfait + NICE + Parcours d'excellence.

FORMAT DE SORTIE (JSON) :
{
  "candidate_name": "Prénom Nom (ou 'Inconnu')",
  "candidate_title": "Titre actuel détecté",
  "score": 85, (Entier 0-100)
  "verdict": "Court verdict (ex: Profil Pertinent)",
  "analysis": {
    "summary": "Paragraphe de synthèse (3 lignes max). Commence par expliquer le score.",
    "strengths": ["Point fort 1", "Point fort 2 (ex: 7 ans d'XP cumulée)"],
    "warnings": ["Point de vigilance 1", "Point de vigilance 2"]
  }
}
5.4 Stratégie d'Optimisation des Coûts (Token Diet)
Gemini facture au "Token" (environ 4 caractères). Pour éviter de payer pour du bruit :
Nettoyage HTML (Web Scraper) :
Avant d'envoyer un profil Web (Apec, Indeed...), le Content Script exécute un parser.js.
Suppression : <nav>, <footer>, <script>, <style>, <svg>, et les blocs de pubs connus.
Objectif : Réduire la taille du payload de 50% à 70%.
Truncate (Coupe-Circuit) :
Si le texte nettoyé dépasse 25 000 caractères (environ 6k tokens, énorme pour un CV), on coupe la fin.
Pourquoi ? Les infos clés (Expérience, Compétences) sont généralement au début ou au milieu. La fin contient souvent des mentions légales ou du footer inutile.
PDF Natif :
On n'essaie pas d'extraire le texte du PDF en JS (trop verbeux et perte de structure). On laisse Gemini lire le binaire. C'est plus coûteux en tokens qu'un texte pur, mais le résultat est bien meilleur sur les CVs complexes (colonnes, graphiques).
5.5 Gestion des Erreurs IA (Hallucinations & Format)
Même avec responseMimeType: "application/json", l'IA peut parfois échouer.
Le "JSON Cleaner" :
Gemini entoure souvent sa réponse de balises Markdown : ```json { ... } ```.
Le code doit utiliser une Regex pour extraire uniquement ce qui se trouve entre les accolades { et } avant de parser.
Validation de Schéma :
Après le JSON.parse(), on vérifie la présence des clés vitales : score, verdict, candidate_name.
Si une clé manque, on considère l'analyse comme FAILED (ou on met des valeurs par défaut "Non détecté").
Refus de Sécurité (Safety Filter) :
Si l'API renvoie une erreur finishReason: "SAFETY", on ne plante pas.
On crée un résultat artificiel : Score 0, Verdict "Bloqué par Sécurité", et on affiche l'erreur à l'utilisateur.






🎨 MODULE 6 : UI/UX DU SIDE PANEL (LA VITRINE)
6.1 Philosophie & Structure Globale
L'interface bascule d'une "Vue Unique" (V1) à une architecture Master-Detail (Liste -> Détail).
Elle est hébergée dans sidepanel.html et doit être 100% Réactive : elle ne stocke aucun état local, elle ne fait que refléter chrome.storage.local.
Layout Général (Grid CSS)
L'écran est divisé en 3 zones fixes :
Header (Fixe, 60px) : Navigation et Contexte.
Main Content (Scrollable, Auto) : La zone dynamique (Liste ou Settings).
Detail Overlay (Slide-in) : Le panneau d'analyse qui glisse par-dessus la liste.
Design System (Héritage V1)
On conserve l'identité pour ne pas perdre les utilisateurs actuels.
Couleurs : Marine #1E40AF (Dominante), Orange #F97316 (Action/Must), Vert #10B981 (Nice/Validé).
Typographie : Inter (Google Fonts).
Composants : Boutons arrondis (8px), Cartes avec ombre légère via CSS box-shadow.
6.2 Composant A : Le Header Contextuel
C'est le poste de pilotage. Il permet de changer de contexte (Job) sans recharger l'extension.
Éléments HTML :
code
Html
<header class="w-header">
    <div class="brand-area">
        <img src="../assets/logo.svg" class="logo-icon">
        <!-- Sélecteur de Job (NOUVEAU) -->
        <select id="job-selector" class="job-dropdown">
             <option value="" disabled>Chargement...</option>
             <!-- Options injectées dynamiquement : "Dev React", "Sales"... -->
             <option value="new">+ Nouveau Poste</option>
        </select>
    </div>
    <div class="actions-area">
        <button id="btn-settings" class="icon-btn">⚙️</button>
    </div>
</header>
Logique JS (sidepanel.js) :
Au chargement, lire pawz_jobs dans le Storage.
Remplir le <select>.
Sélectionner l'option où active === true.
Event : Au changement (change), mettre à jour active: true sur le nouveau job dans le Storage. Cela déclenchera automatiquement le rafraîchissement de la liste des candidats.
6.3 Composant B : La "Queue Dashboard" (Vue Liste)
C'est l'écran par défaut. Il remplace la vue d'accueil de la V1.
Structure HTML :
code
Html
<main id="view-dashboard" class="w-body">
    <!-- Zone de Filtres / Stats Rapides -->
    <div class="queue-stats">
        <span id="count-pending">⏳ 0</span>
        <span id="count-done">✅ 0</span>
    </div>

    <!-- Conteneur de la liste -->
    <div id="candidates-list" class="candidates-container">
        <!-- Template vide (Empty State) -->
        <div class="empty-state">
            <p>Aucun candidat pour ce poste.</p>
            <small>Cliquez sur la pastille Pawz sur LinkedIn pour ajouter des profils.</small>
        </div>

        <!-- Les cartes sont injectées ici par JS -->
    </div>
</main>
La Carte Candidat (Item de Liste) :
Elle doit gérer 4 états visuels distincts basés sur le champ status.
State PENDING (Gris) :
Affichage : "En attente..."
Actions : Bouton "Poubelle" (Supprimer), Bouton "Flèche Haut" (Prioriser - priority: 'high').
State PROCESSING (Bleu/Animé) :
Affichage : Spinner CSS rotatif.
Actions : Aucune (ou Annuler).
State COMPLETED (Coloré) :
Affichage : Badge Score (ex: "85%"), Nom du candidat.
Couleur de bordure : Vert (>80), Orange (60-79), Rouge (<60).
Actions : Clic sur la carte entière ouvre le Détail.
State FAILED (Rouge) :
Affichage : Icône ⚠️ + "Erreur".
Actions : Bouton "Retry" (Relancer) ou "Poubelle".
6.4 Composant C : Le "Detail Overlay" (Vue Analyse)
Au clic sur un candidat terminé, ce panneau glisse depuis la droite (CSS transform: translateX(0)). Il réutilise le code HTML des accordéons de la V1.
Structure HTML :
code
Html
<div id="detail-overlay" class="detail-panel hidden">
    <!-- Navigation Rapide (NOUVEAU) -->
    <div class="detail-nav">
        <button id="btn-close-detail">← Retour</button>
        <div class="nav-arrows">
            <button id="btn-prev-candidate" title="Précédent">⬆</button>
            <button id="btn-next-candidate" title="Suivant">⬇</button>
        </div>
    </div>

    <!-- Contenu Analyse (Récupéré de la V1) -->
    <div class="analysis-content">
        <div class="score-header">
            <h1 id="detail-score">85%</h1>
            <span id="detail-verdict">Profil Pertinent</span>
        </div>

        <!-- Accordéons -->
        <div class="accordion open">
            <div class="accordion-header">✅ Points Forts</div>
            <ul id="detail-strengths" class="list-check"></ul>
        </div>
        <div class="accordion">
            <div class="accordion-header">⚠️ Vigilance</div>
            <ul id="detail-warnings" class="list-warn"></ul>
        </div>
        <div class="accordion">
            <div class="accordion-header">🤖 Résumé</div>
            <p id="detail-summary"></p>
        </div>
    </div>

    <!-- Actions Footer -->
    <div class="detail-footer">
        <a id="btn-open-linkedin" href="#" target="_blank" class="btn-secondary">Voir Profil</a>
        <button id="btn-delete-current" class="btn-danger">Rejeter</button>
    </div>
</div>
Logique de Navigation ("Dépilage") :
Les boutons Précédent/Suivant sont essentiels pour la productivité.
Logique : Ils parcourent le tableau candidates filtré par le Job actuel.
UX : Transition instantanée (remplacement des données DOM) sans fermer l'overlay.
6.5 Logique Réactive (Le Moteur JS)
Le fichier sidepanel.js doit suivre ce pattern strict :
code
JavaScript
// 1. Écouteur Global
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        // Si les candidats ou le job actif changent, on redessine
        if (changes.pawz_candidates || changes.pawz_jobs) {
            renderDashboard();
        }
    }
});

// 2. Fonction de Rendu (Idempotente)
async function renderDashboard() {
    // A. Récupérer TOUTES les données
    const data = await chrome.storage.local.get(['pawz_candidates', 'pawz_jobs']);
    const activeJob = data.pawz_jobs.find(j => j.active);

    if (!activeJob) {
        showEmptyState("Sélectionnez un poste.");
        return;
    }

    // B. Filtrer les candidats pour ce Job
    const jobCandidates = data.pawz_candidates.filter(c => c.job_id === activeJob.id);

    // C. Trier (Processing > Pending > Completed date desc)
    const sorted = sortCandidates(jobCandidates);

    // D. Générer le HTML (Virtual DOM simplifié : on vide et on remplit)
    const listContainer = document.getElementById('candidates-list');
    listContainer.innerHTML = '';

    sorted.forEach(candidate => {
        const card = createCandidateCard(candidate); // Crée l'élément DOM avec events
        listContainer.appendChild(card);
    });

    // E. Mettre à jour les compteurs
    updateStats(sorted);
}
6.6 Gestion des Assets (Images)
Attention : Dans un Side Panel, les chemins relatifs peuvent être piégeux.
Utiliser chrome.runtime.getURL('assets/logo.svg') pour les images dynamiques.
Pour le HTML statique, /assets/logo.svg fonctionne généralement si la racine est bien définie.



🛡️ MODULE 7 : STRATÉGIE DE MIGRATION & SÉCURITÉ
7.1 Script de Migration (V1 -> V2)
Lors de la mise à jour, le modèle de données change radicalement (de "Données Plates" à "Relationnel").
Nous devons exécuter un script une seule fois au démarrage (onInstalled) pour transformer les données existantes.
Logique du Script (background/migration.js) :
Déclencheur : chrome.runtime.onInstalled (Raison : update ou install).
Vérification : On regarde si la clé V1 pawz_search_criteria existe dans chrome.storage.local.
Transformation (Mapping) :
Clé API : On déplace pawz_gemini_key (V1) vers pawz_settings.api_key (V2).
Job : On prend l'objet pawz_search_criteria (Brief + Must + Nice) et on crée un Premier Job V2 :
title: "Mon Poste (Importé)"
raw_brief: Contenu de l'ancien champ brief.
criteria: Contenu des anciens champs mustCriteria et niceCriteria.
active: true.
Nettoyage : Une fois la migration réussie, on supprime les clés V1 (pawz_search_criteria, pawz_gemini_key) pour éviter que le script ne se relance.
Résultat UX : L'utilisateur met à jour l'extension, ouvre le Side Panel, et retrouve sa configuration prête à l'emploi sous forme d'un Job actif. Il ne perd rien.
7.2 Sécurité & Permissions (Manifest V3)
Google est très strict. Chaque permission doit être justifiée.
Permission	Justification Critique
sidePanel	Cœur V2. Remplace l'injection DOM pour l'affichage des résultats.
storage	Stockage des données candidats et jobs.
unlimitedStorage	Vital. Permet de dépasser la limite de 5Mo pour IndexedDB (stockage des PDF). Sans ça, l'app plante au 2ème PDF.
scripting	Injection de la Pastille (Trigger) et du CSS associé.
activeTab	Lecture du contenu de l'onglet actif au moment du clic.
alarms	Watchdog. Permet au Service Worker de se réveiller périodiquement pour débloquer la file d'attente (Retry).
Host Permissions (<all_urls>) :
Indispensable car Pawz est un outil de sourcing "Agnostique". L'utilisateur doit pouvoir sourcer depuis LinkedIn, Apec, un site carrière obscur ou une visionneuse PDF locale.
7.3 Le Fichier manifest.json (Définitif)
Voici le code exact à utiliser à la racine du projet.
code
JSON
{
  "manifest_version": 3,
  "name": "Pawz - Assistant Recruteur AI",
  "version": "2.0.0",
  "description": "Copilote de sourcing asynchrone. Analysez des CVs en masse avec l'IA.",
  "icons": {
    "16": "assets/icon16.png",
    "48": "assets/icon48.png",
    "128": "assets/icon128.png"
  },

  "background": {
    "service_worker": "background/background.js",
    "type": "module"
  },

  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"
  },

  "action": {
    "default_title": "Ouvrir Pawz"
    // Note: Au clic sur l'icône extension, le Side Panel s'ouvre par défaut
    // grâce au comportement natif de Chrome si "side_panel" est défini.
  },

  "permissions": [
    "sidePanel",
    "storage",
    "unlimitedStorage",
    "scripting",
    "activeTab",
    "alarms"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "web_accessible_resources": [
    {
      "resources": [
        "assets/logo.svg",
        "assets/icon48.png",
        "content/trigger.css"
      ],
      "matches": ["<all_urls>"]
    }
  ],

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
7.4 Gestion des PDF Locaux (Point de Friction UX)
Chrome bloque par défaut l'accès aux URLs file:// pour les extensions. C'est une sécurité navigateur qu'on ne peut pas contourner par code.
La Stratégie UX :
Détection : Au démarrage du Side Panel, on appelle chrome.extension.isAllowedFileSchemeAccess().
Feedback :
Si false : On affiche une bannière d'alerte orange en haut du Dashboard : "Pour analyser vos PDF locaux, veuillez activer l'accès aux fichiers."
Le bouton pointe vers chrome://extensions/?id=ID_EXTENSION.
Fallback : Si l'utilisateur tente d'ajouter un PDF local sans cette permission, la capture échouera. On doit catcher l'erreur et afficher une notification explicite : "Permission manquante : Activez l'accès aux fichiers dans les réglages Chrome."




````
