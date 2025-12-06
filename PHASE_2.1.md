# PHASE 2.1 : REFONTE UI "GESTION DE POSTES"

**Objectif :** Construire l'interface de gestion des recherches (Jobs) selon le nouveau flow Master-Detail.

### 🎨 AGENT 2 (FRONTEND)

**1. HEADER GLOBAL**

- [ ] Nettoyer le Header : Juste le Logo "Pawz." (Bleu/Orange) à gauche + Bouton Settings à droite.
- [ ] Supprimer tout sélecteur de job du header.

**2. VUE "LISTE DES RECHERCHES" (Accueil Onglet Recherche)**

- [ ] Créer le conteneur `view-job-list`.
- [ ] Bouton principal haut : "+ Créer une nouvelle recherche".
- [ ] Liste des cartes :
  - Titre du poste.
  - Bouton d'état :
    - Si inactif : Bouton Vert "Activer".
    - Si actif : Texte Gris/Vert "Recherche active".
  - Icône Corbeille (Supprimer).

**3. VUE "ÉDITION RECHERCHE" (Détail Job)**

- [ ] Créer le conteneur `view-job-edit` (Caché par défaut).
- [ ] Navigation : Bouton "← Retour" en haut.
- [ ] Formulaire :
  - Input Titre du poste.
  - Textarea "Fiche de Poste".
  - Inputs Tags (Must Have / Nice Have).
- [ ] Actions : Boutons "Enregistrer" et "Activer cette recherche".
- [ ] **Carte "Comprendre ma recherche"** : Bloc visuel sous les boutons (Titre + Bouton "Lancer l'analyse" ou Résumé si déjà fait).
- [ ] **Liste des Analyses** : Section en bas affichant les candidats liés à ce job (Aperçu).

**4. LOGIQUE DE NAVIGATION (UI)**

- [ ] Gérer le passage Liste <-> Édition sans recharger.
- [ ] Mémoriser la vue active (si je change d'onglet et que je reviens, je reste sur l'édition).
