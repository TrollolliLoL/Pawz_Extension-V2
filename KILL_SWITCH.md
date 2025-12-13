# 🔴 Kill Switch - Mode d'emploi

## 📍 URL du fichier de contrôle
```
https://gist.githubusercontent.com/TrollolliLoL/2d2bf6ad500c5bde53f58c66a3bffddd/raw/gistfile1.txt
```

**⚠️ Important :** L'URL **sans hash** récupère toujours la dernière version du Gist.

---

## ✅ Application ACTIVE (état normal)

**Contenu du Gist :**
```json
{"status": "active", "message": ""}
```

**Comportement :**
- ✅ Toutes les analyses fonctionnent normalement
- ✅ Aucun message d'alerte affiché
- ✅ Extension opérationnelle

---

## 🚨 DÉSACTIVER l'application à distance

### 1. Modifier le Gist GitHub

**Contenu à mettre :**
```json
{"status": "disabled", "message": "Mise à jour requise."}
```

**Personnaliser le message :**
```json
{"status": "disabled", "message": "Maintenance en cours. Retour prévu à 15h."}
```

### 2. Effet immédiat (sous 10 minutes)

**Ce qui se passe :**
- ⛔ **Toutes les analyses sont bloquées** (queue_manager refuse de traiter)
- ⚠️ **Bannière rouge** affichée en haut du Side Panel avec ton message
- 📢 **Console logs** : `⚠️ Kill Switch activé`

**Cache :**
- Vérification toutes les **10 minutes**
- Au démarrage de l'extension
- Avant chaque analyse

---

## 🔄 RÉACTIVER l'application

**Remettre dans le Gist :**
```json
{"status": "active", "message": ""}
```

**Délai :** Maximum 10 minutes (durée du cache)

---

## 🛠️ Fichiers modifiés

| Fichier | Rôle |
|---------|------|
| `lib/utils.js` | Fonction `checkKillSwitch()` avec cache 10 min |
| `background/background.js` | Vérification au démarrage + stockage |
| `background/queue_manager.js` | Blocage des analyses si `status !== 'active'` |
| `sidepanel/sidepanel.js` | Affichage de la bannière d'alerte |

---

## 🧪 Tester le Kill Switch

1. **Modifier le Gist** → `{"status": "disabled", "message": "Test Kill Switch"}`
2. **Recharger l'extension** (chrome://extensions → Recharger)
3. **Ouvrir le Side Panel** → Bannière rouge visible
4. **Essayer d'analyser un CV** → Bloqué dans la queue
5. **Remettre** → `{"status": "active", "message": ""}`
6. **Attendre 10 min OU recharger** → Tout refonctionne

---

## ⚙️ Configuration avancée

**Changer l'URL du Gist :**
Modifier dans `lib/utils.js` ligne 53 :
```javascript
const KILL_SWITCH_URL = 'https://ton-nouveau-gist.com/...';
```

**Changer la durée du cache :**
Modifier dans `lib/utils.js` ligne 55 :
```javascript
const CACHE_DURATION = 30 * 60; // 30 minutes au lieu de 10
```

---

## 🔒 Sécurité

**Fail-Open :** En cas d'erreur réseau ou Gist inaccessible, l'extension **continue de fonctionner** (pas de blocage accidentel).

**Logs :** Tous les événements Kill Switch sont tracés dans la console (`chrome://extensions` → Détails → Inspecter les vues).
