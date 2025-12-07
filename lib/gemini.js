/**
 * PAWZ V2 - Client API Gemini
 * @module lib/gemini
 * 
 * Gère les appels à l'API Google Generative AI pour l'analyse de candidats.
 * Supporte le mode texte et PDF (multimodal).
 */

const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Modèles Gemini disponibles (API REST v1beta)
const AVAILABLE_MODELS = {
    FAST: 'gemini-2.5-flash',           // Modèle rapide (stable) - DÉFAUT
    PRO: 'gemini-2.5-pro'               // Modèle Pro (stable)
};

/**
 * Configuration de génération pour des réponses JSON stables.
 * Temperature basse = moins d'hallucinations créatives.
 */
const GENERATION_CONFIG = {
    temperature: 0.2,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json'
};

/**
 * Désactivation des filtres de sécurité.
 * Un CV peut contenir des termes sensibles légitimes.
 */
const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
];

/**
 * Prompt système pour l'analyse de candidat - Version "GATEKEEPER".
 * @param {Object} job - Contexte du poste
 * @param {Object} [weights] - Poids des critères (AI Tuning)
 * @returns {string} Prompt formaté
 */
function buildCandidatePrompt(job, weights) {
    const mustList = job.criteria?.must_have?.join(', ') || 'Non spécifié';
    const niceList = job.criteria?.nice_to_have?.join(', ') || 'Aucun';

    // Default weights (Fallback Tech Rec) - Protection contre undefined
    const defaults = {
        mastery: 10, experience: 7, degree: 2, sector: 3, 
        stability: 5, mission_match: 8, exigence: 8, coherence: 8, deduction: 5
    };
    
    // Fusionner avec les defaults pour garantir que toutes les valeurs existent
    const w = {
        mastery: Number(weights?.mastery) || defaults.mastery,
        experience: Number(weights?.experience) || defaults.experience,
        degree: Number(weights?.degree) || defaults.degree,
        sector: Number(weights?.sector) || defaults.sector,
        stability: Number(weights?.stability) || defaults.stability,
        mission_match: Number(weights?.mission_match) || defaults.mission_match,
        exigence: Number(weights?.exigence) || defaults.exigence,
        coherence: Number(weights?.coherence) || defaults.coherence,
        deduction: Number(weights?.deduction) || defaults.deduction
    };
    
    console.log('[Gemini] Poids utilisés:', w);
    
    const strictMode = w.exigence >= 8;

    return `⚠️ CONTEXTE TECHNIQUE - EXTRACTION WEB :
Ce texte est une extraction brute d'une page web (LinkedIn, Indeed, CV en ligne).
IGNORE : menus, publicités, "Autres profils similaires", footer, cookies.
FOCUS : Le PROFIL PRINCIPAL au centre de la page. Le nom est souvent le premier après le bruit.

═══════════════════════════════════════════════════════════════
🎯 TU ES "PAWZ" - LE GATEKEEPER IMPITOYABLE
═══════════════════════════════════════════════════════════════

Ta mission n'est PAS de résumer un CV.
Ta mission est de DÉCIDER si ce candidat mérite un appel téléphonique.
Tu fais gagner du temps au recruteur. Un mauvais profil validé = 30min perdues.

📋 POSTE À POURVOIR :
• Titre : ${job.title || 'Non spécifié'}
• Contexte : ${job.raw_brief || 'Pas de description'}
• MUST-HAVE (Éliminatoires) : ${mustList}
• NICE-TO-HAVE (Bonus) : ${niceList}

═══════════════════════════════════════════════════════════════
⚖️ TES CONSIGNES DE RÉGLAGE (Respecte-les STRICTEMENT)
═══════════════════════════════════════════════════════════════

Le recruteur a paramétré son niveau d'exigence (1=souple, 10=intransigeant) :

| Critère                        | Poids | Interprétation |
|-------------------------------|-------|----------------|
| 🔧 Maîtrise Tech Stack        | ${w.mastery}/10  | ${w.mastery >= 8 ? "BLOQUANT si absent" : w.mastery >= 5 ? "Important" : "Secondaire"} |
| 📅 Années d'Expérience        | ${w.experience}/10  | ${w.experience >= 8 ? "Séniorité exigée" : w.experience >= 5 ? "Expérience valorisée" : "Junior accepté"} |
| 🎓 Niveau de Diplôme          | ${w.degree}/10  | ${w.degree >= 8 ? "ÉLIMINATOIRE si absent" : w.degree >= 5 ? "Préféré" : "Non requis"} |
| 🏢 Connaissance Secteur       | ${w.sector}/10  | ${w.sector >= 8 ? "Secteur identique exigé" : w.sector >= 5 ? "Secteur proche préféré" : "Tout secteur OK"} |
| 📊 Stabilité Parcours         | ${w.stability}/10  | ${w.stability >= 8 ? "Zéro job-hopping" : w.stability >= 5 ? "Parcours cohérent" : "Mobilité tolérée"} |
| 🎯 Match Missions Passées     | ${w.mission_match}/10  | ${w.mission_match >= 8 ? "Missions identiques requises" : w.mission_match >= 5 ? "Missions similaires" : "Transferable skills OK"} |
| ⚡ Sévérité Globale           | ${w.exigence}/10  | ${strictMode ? "MODE STRICT ACTIVÉ" : "Mode standard"} |
| 🔍 Vigilance Incohérences     | ${w.coherence}/10  | ${w.coherence >= 8 ? "Traque active" : w.coherence >= 5 ? "Attention normale" : "Bienveillant"} |
| 🧠 Capacité de Déduction      | ${w.deduction}/10  | ${w.deduction >= 7 ? "Déduis largement (Python → Data Science probable)" : w.deduction <= 3 ? "AUCUNE déduction, que du factuel" : "Déductions légères"} |

═══════════════════════════════════════════════════════════════
📊 CALCUL DU SCORE (Algorithme)
═══════════════════════════════════════════════════════════════

1. Pour chaque critère, évalue le candidat sur 100.
2. Multiplie par le poids normalisé (poids/10).
3. Somme pondérée = Score final.

ÉCHELLE DE DÉCISION ${strictMode ? "(MODE STRICT)" : "(MODE STANDARD)"} :
• 0-49  → ❌ "À ÉCARTER" - Ne perdez pas votre temps
• 50-64 → ⚠️ "PROFIL FAIBLE" - Seulement si pénurie de candidats
• 65-79 → 🤔 "À ÉTUDIER" - Potentiel mais des réserves
• 80-89 → ✅ "BON PROFIL" - Mérite un appel
• 90-100 → 🌟 "TOP PROFIL" - Priorité absolue

═══════════════════════════════════════════════════════════════
✍️ STYLE DE RÉDACTION
═══════════════════════════════════════════════════════════════

❌ NE FAIS PAS :
- "Ce profil est intéressant..." (mou)
- "Il pourrait convenir..." (indécis)
- Lister le CV sans analyse

✅ FAIS :
- "À CONTACTER D'URGENCE : 8 ans d'XP exact match sur React/Node"
- "À ÉCARTER : Aucune expérience B2B, que du B2C"
- Donner une OPINION TRANCHÉE

POINTS FORTS : Courts (max 10 mots), percutants, avec émoji.
POINTS DE VIGILANCE : Ce qui pourrait faire capoter l'entretien.

RÉSUMÉ DÉTAILLÉ (OBLIGATOIRE - Structure en 3 parties) :

👤 DÉCISION : Une phrase qui dit CLAIREMENT "Appelez-le" ou "Passez votre chemin" et pourquoi.

📜 PARCOURS (Expérience par expérience, de la plus récente à la plus ancienne) :
Pour chaque poste significatif, indique :
- Entreprise + Durée + Titre
- Ce qu'il y faisait concrètement (1 ligne)
- Ce que ça apporte pour le poste actuel

🔎 ANALYSE APPROFONDIE :
- Développe les points forts (pourquoi c'est un atout ICI)
- Développe les vigilances (pourquoi c'est un risque ICI)
- Donne ton avis final argumenté

═══════════════════════════════════════════════════════════════
📤 FORMAT JSON STRICT
═══════════════════════════════════════════════════════════════

{
  "candidate_name": "Prénom Nom (JAMAIS 'Inconnu' si visible)",
  "candidate_title": "Poste actuel ou dernier poste",
  "score": 75,
  "verdict": "À ÉTUDIER - Bon tech mais manque de séniorité",
  "analysis": {
    "summary": "👤 DÉCISION : [Appeler/Écarter] car...\\n\\n📜 PARCOURS :\\n• [Entreprise 1] (2022-2024) - [Titre] : [Description courte + apport]\\n• [Entreprise 2] (2020-2022) - [Titre] : [Description courte + apport]\\n\\n🔎 ANALYSE :\\n[Développement des forces]\\n[Développement des risques]\\n[Avis final]",
    "strengths": ["🔧 8 ans React/Node exact match", "🚀 Lead Tech chez scale-up", "💡 Certifié AWS"],
    "warnings": ["⚠️ Aucune XP B2B (que B2C)", "📅 Job-hopping (3 postes en 2 ans)"]
  }
}`;
}

export const GeminiClient = {
    /**
     * Récupère la clé API depuis le stockage local.
     */
    async getApiKey() {
        const data = await chrome.storage.local.get('pawz_settings');
        if (!data.pawz_settings?.api_key) {
            throw { type: 'AUTH_ERROR', message: 'Clé API manquante', retryable: false };
        }
        return data.pawz_settings.api_key;
    },

    /**
     * Récupère le modèle sélectionné (ou défaut).
     */
    async getModelId() {
        const data = await chrome.storage.local.get('pawz_settings');
        const selectedModel = data.pawz_settings?.selected_model || 'fast';
        
        // Mapper le choix utilisateur vers le nom de modèle API
        if (selectedModel === 'pro' || selectedModel.includes('pro')) {
            return AVAILABLE_MODELS.PRO;
        }
        return AVAILABLE_MODELS.FAST;
    },

    /**
     * Analyse un candidat via l'API.
     * @param {Object} payload - Données du candidat { type: 'text'|'base64', content: string }
     * @param {Object} job - Contexte du poste
     * @param {Object} [tuningWeights] - Poids de réglage (Optionnel)
     * @returns {Promise<Object>} Résultat structuré
     */
    async analyzeCandidate(payload, job, tuningWeights) {
        const apiKey = await this.getApiKey();
        const modelId = await this.getModelId();
        const systemPrompt = buildCandidatePrompt(job, tuningWeights);

        // Construire le body de la requête
        const requestBody = {
            contents: [{
                parts: []
            }],
            generationConfig: GENERATION_CONFIG,
            safetySettings: SAFETY_SETTINGS
        };

        // Ajouter le prompt système
        requestBody.contents[0].parts.push({
            text: systemPrompt
        });

        // Ajouter le contenu du candidat selon le type
        if (payload.type === 'base64') {
            // Mode PDF multimodal
            requestBody.contents[0].parts.push({
                text: '\n\nPROFIL DU CANDIDAT :\n(Voir le document PDF ci-joint)'
            });
            requestBody.contents[0].parts.push({
                inlineData: {
                    mimeType: 'application/pdf',
                    data: payload.content
                }
            });
        } else {
            // Mode texte
            requestBody.contents[0].parts.push({
                text: `\n\nPROFIL DU CANDIDAT :\n${payload.content}`
            });
        }

        const url = `${API_BASE_URL}/${modelId}:generateContent?key=${apiKey}`;

        console.log(`[Gemini] Appel API - Modèle: ${modelId}, Type: ${payload.type}`);
        console.log(`[Gemini] URL: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);

        // Timeout de 120 secondes pour éviter les blocages (Pro est plus lent)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.error('[Gemini] Timeout après 120s');
            controller.abort();
        }, 120000);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            // Gérer les erreurs HTTP
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error?.message || response.statusText;
                
                // Classifier l'erreur
                if (response.status === 429) {
                    throw { type: 'RATE_LIMIT', message: 'Quota API dépassé', retryable: true };
                } else if (response.status >= 500) {
                    throw { type: 'SERVER_ERROR', message: `Erreur serveur: ${errorMsg}`, retryable: true };
                } else if (response.status === 400) {
                    throw { type: 'BAD_REQUEST', message: `Requête invalide: ${errorMsg}`, retryable: false };
                } else if (response.status === 401 || response.status === 403) {
                    throw { type: 'AUTH_ERROR', message: 'Clé API invalide ou expirée', retryable: false };
                }
                
                throw { type: 'UNKNOWN', message: `Erreur ${response.status}: ${errorMsg}`, retryable: false };
            }

            const data = await response.json();

            // Vérifier le finishReason (Safety Filter)
            const candidate = data.candidates?.[0];
            if (!candidate) {
                throw { type: 'EMPTY_RESPONSE', message: 'Aucune réponse de l\'IA', retryable: false };
            }

            if (candidate.finishReason === 'SAFETY') {
                console.warn('[Gemini] Contenu bloqué par le filtre de sécurité');
                return {
                    candidate_name: 'Inconnu',
                    candidate_title: 'Non analysé',
                    score: 0,
                    verdict: 'Bloqué par Sécurité',
                    analysis: {
                        summary: 'Le contenu a été bloqué par les filtres de sécurité de Google.',
                        strengths: [],
                        warnings: ['Analyse impossible - Contenu refusé par l\'API']
                    }
                };
            }

            // Extraire le texte de la réponse
            const rawText = candidate.content?.parts?.[0]?.text;
            if (!rawText) {
                throw { type: 'PARSE_ERROR', message: 'Pas de texte dans la réponse', retryable: false };
            }

            // Parser et valider le JSON
            const parsed = cleanAndParseJSON(rawText);
            const validated = validateAnalysisResult(parsed);

            console.log(`[Gemini] Analyse terminée - Score: ${validated.score}, Verdict: ${validated.verdict}`);
            return validated;

        } catch (error) {
            clearTimeout(timeoutId); // Nettoyer le timeout en cas d'erreur
            
            // Re-throw les erreurs déjà formatées
            if (error.type) {
                throw error;
            }
            
            // Timeout (AbortError)
            if (error.name === 'AbortError') {
                console.error('[Gemini] Requête annulée (timeout 120s)');
                throw { type: 'TIMEOUT', message: 'L\'analyse a pris trop de temps (120s)', retryable: true };
            }
            
            // Erreur réseau ou autre
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw { type: 'NETWORK_ERROR', message: 'Erreur réseau - Vérifiez votre connexion', retryable: true };
            }
            
            console.error('[Gemini] Erreur inattendue:', error);
            throw { type: 'UNKNOWN', message: error.message, retryable: false };
        }
    },

    /**
     * Parse une fiche de poste brute en critères structurés.
     * @param {string} rawJobDescription - Description du poste en texte
     * @returns {Promise<Object>} Critères structurés
     */
    async parseJobDescription(rawJobDescription) {
        const apiKey = await this.getApiKey();
        const modelId = await this.getModelId();

        const systemPrompt = `RÔLE :
Tu es un Expert en Recrutement Technique. Ta mission est de structurer une Fiche de Poste brute.

INSTRUCTION :
Analyse le texte fourni. Extrais les critères clés et sépare-les strictement en deux catégories.
Ignore le blabla corporate ("Leader mondial de...", "Babyfoot..."). Concentre-toi sur le besoin opérationnel.

RÈGLES D'EXTRACTION :
1. "must_have" : Les compétences BLOQUANTES. Si le candidat ne l'a pas, il est rejeté.
2. "nice_to_have" : Les compétences BONUS.
3. Les critères doivent être courts (max 5 mots).

FORMAT DE SORTIE (JSON) :
{
  "job_title": "Titre normalisé du poste",
  "summary": "Résumé du poste en 1 phrase percutante.",
  "criteria": {
    "must_have": ["Critère 1", "Critère 2"],
    "nice_to_have": ["Bonus 1", "Bonus 2"]
  }
}

FICHE DE POSTE À ANALYSER :
${rawJobDescription}`;

        const url = `${API_BASE_URL}/${modelId}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: GENERATION_CONFIG,
                safetySettings: SAFETY_SETTINGS
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || 'Erreur parsing job');
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        return cleanAndParseJSON(rawText);
    },

    /**
     * Analyse approfondie d'une fiche de poste pour le Sourcing Helper.
     * UTILISE TOUJOURS LE MODÈLE PRO pour une analyse de qualité.
     * @param {Object} job - La fiche de poste avec title, raw_brief, criteria
     * @returns {Promise<Object>} Analyse complète pour le sourcing
     */
    async analyzeJobForSourcing(job) {
        const apiKey = await this.getApiKey();
        // TOUJOURS utiliser le modèle Pro pour cette analyse
        const modelId = AVAILABLE_MODELS.PRO;

        const mustList = job.criteria?.must_have?.join(', ') || 'Non spécifié';
        const niceList = job.criteria?.nice_to_have?.join(', ') || 'Non spécifié';

        const systemPrompt = `═══════════════════════════════════════════════════════════════
🎯 TU ES UN EXPERT SOURCING / TALENT ACQUISITION
═══════════════════════════════════════════════════════════════

Ta mission : Aider un recruteur à COMPRENDRE ce qu'il cherche avant de partir en chasse.
Tu dois transformer une fiche de poste technique en guide de sourcing actionnable.

📋 FICHE DE POSTE À ANALYSER :
• Titre : ${job.title || 'Non spécifié'}
• Description : ${job.raw_brief || 'Non fournie'}
• Critères MUST : ${mustList}
• Critères NICE : ${niceList}

═══════════════════════════════════════════════════════════════
📤 FORMAT JSON STRICT À RETOURNER
═══════════════════════════════════════════════════════════════

{
  "keywords": {
    "job_titles": ["Titre exact", "Variante 1", "Variante 2", "Titre anglais"],
    "hard_skills": ["Compétence technique 1", "Outil 1", "Framework 1"],
    "soft_skills": ["Soft skill 1", "Soft skill 2"],
    "certifications": ["Certification 1", "Certification 2"],
    "boolean_query": "Exemple de requête booléenne LinkedIn : (\\"titre1\\" OR \\"titre2\\") AND (skill1 OR skill2)"
  },
  "job_summary": {
    "one_liner": "Le poste en 1 phrase simple (comme si tu l'expliquais à ta grand-mère)",
    "mission": "La mission principale en 2-3 phrases",
    "context": "Contexte business : pourquoi ce poste existe, quel problème il résout"
  },
  "stack_analysis": [
    {
      "name": "Nom de l'outil/techno",
      "emoji": "🔧",
      "definition": "Explication simple en 1 phrase (pour un non-tech)",
      "usage_here": "À quoi ça sert PRÉCISÉMENT dans ce poste",
      "alternatives": ["Alternative 1", "Alternative 2"]
    }
  ],
  "sourcing_tips": {
    "where_to_find": ["LinkedIn", "GitHub", "Meetups spécialisés"],
    "green_flags": ["Bon signal 1", "Bon signal 2"],
    "red_flags": ["Signal d'alerte 1", "Signal 2"]
  }
}

═══════════════════════════════════════════════════════════════
📝 CONSIGNES DE RÉDACTION
═══════════════════════════════════════════════════════════════

1. MOTS-CLÉS : Sois EXHAUSTIF. Pense à toutes les variantes (français/anglais, abréviations, synonymes).
   Ex: "Product Owner" → aussi "PO", "Product Manager", "Chef de Produit"

2. RÉSUMÉ MÉTIER : Vulgarise ! Pas de jargon. Un stagiaire RH doit comprendre.

3. STACK ANALYSIS : Pour CHAQUE techno/outil mentionné, explique :
   - C'est quoi (définition simple)
   - À quoi ça sert ICI (dans le contexte de ce poste)
   - Les alternatives (pour élargir la recherche)
   - Utilise un emoji pertinent pour chaque item

4. TIPS : Donne des conseils CONCRETS de sourcing.`;

        const url = `${API_BASE_URL}/${modelId}:generateContent?key=${apiKey}`;

        console.log(`[Gemini] Analyse Sourcing - Modèle: ${modelId} (forcé PRO)`);

        // Timeout de 120 secondes
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt }] }],
                    generationConfig: GENERATION_CONFIG,
                    safetySettings: SAFETY_SETTINGS
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || 'Erreur analyse sourcing');
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!rawText) {
                throw new Error('Pas de réponse de l\'IA');
            }

            const parsed = cleanAndParseJSON(rawText);
            console.log('[Gemini] Analyse Sourcing terminée avec succès');
            return parsed;

        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Timeout: L\'analyse a pris trop de temps');
            }
            throw error;
        }
    }
};

// --- Helpers ---

/**
 * Nettoie le Markdown (```json ... ```) et parse le JSON.
 */
function cleanAndParseJSON(text) {
    let cleanText = text.replace(/```json\n?|```/g, '').trim();
    // Parfois Gemini ajoute du texte avant/après
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanText = cleanText.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleanText);
}

/**
 * Valide et normalise le résultat de l'analyse
 */
function validateAnalysisResult(res) {
    return {
        candidate_name: res.candidate_name || "Candidat Inconnu",
        candidate_title: res.candidate_title || "Titre Inconnu",
        score: typeof res.score === 'number' ? res.score : 0,
        verdict: res.verdict || "À évaluer",
        analysis: {
            summary: res.analysis?.summary || "",
            strengths: Array.isArray(res.analysis?.strengths) ? res.analysis.strengths : [],
            warnings: Array.isArray(res.analysis?.warnings) ? res.analysis.warnings : []
        }
    };
}
