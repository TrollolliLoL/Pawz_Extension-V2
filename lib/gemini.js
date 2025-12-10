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
 * Prompt système pour l'analyse de candidat - Version "RECRUTEUR INCARNÉ".
 * Philosophie : L'IA incarne un recruteur humain avec une personnalité définie par les réglages.
 * Pas de scoring algorithmique rigide, mais un jugement professionnel nuancé.
 * 
 * @param {Object} job - Contexte du poste
 * @param {Object} [weights] - Traits de personnalité du recruteur (AI Tuning)
 * @returns {string} Prompt formaté
 */
function buildCandidatePrompt(job, weights) {
    // Date du jour pour éviter les erreurs de dates futures
    const TODAY = new Date().toLocaleDateString('fr-FR', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    const mustList = job.criteria?.must_have?.join(', ') || 'Non spécifié';
    const niceList = job.criteria?.nice_to_have?.join(', ') || 'Aucun';

    // Personnalité par défaut (équilibrée)
    const defaults = {
        mastery: 7, experience: 6, degree: 3, sector: 4, 
        stability: 5, mission_match: 7, exigence: 5, coherence: 6, deduction: 5
    };
    
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

    return `RÔLE : Tu es un Expert en Recrutement expérimenté. Tu agis comme le bras droit de l'utilisateur.
DATE DU JOUR : ${TODAY}. (Utilise cette date comme référence pour calculer les durées d'expérience.)

⚠️ CONTEXTE TECHNIQUE :
Ce texte est une extraction brute d'une page web (LinkedIn, Indeed, CV).
IGNORE le bruit (menus, pubs, "Profils similaires"). FOCUS sur le candidat principal.

═══════════════════════════════════════════════════════════════
🎯 TA MISSION
═══════════════════════════════════════════════════════════════

Tu dois répondre à UNE question : "Est-ce que je dois appeler ce candidat ?"

L'utilisateur te confie son temps. Un mauvais profil validé = 30 minutes perdues en appel inutile.
Mais un bon profil écarté = une opportunité manquée.

Ton jugement doit être celui d'un recruteur humain : pragmatique, contextuel, nuancé.

═══════════════════════════════════════════════════════════════
📋 LE POSTE (Ta boussole)
═══════════════════════════════════════════════════════════════

TITRE DU POSTE : ${job.title || 'Non spécifié'}

👉 Ce titre est ta CLÉ DE LECTURE. Il change la valeur de chaque compétence.
   Exemple : "SQL" chez un Data Engineer (pipelines) ≠ "SQL" chez un Data Analyst (reporting).
   Juge les compétences dans le CONTEXTE du poste, pas dans l'absolu.

DESCRIPTION / CONTEXTE :
${job.raw_brief || 'Pas de description détaillée'}

CRITÈRES OBLIGATOIRES (Deal-breakers) :
${mustList}
→ Ce sont les éléments ESSENTIELS. S'il en manque un critique, le profil n'est pas pertinent.

CRITÈRES BONUS (Nice to have) :
${niceList}
→ Ils font la différence entre un bon profil (80%) et un excellent (90%+).

═══════════════════════════════════════════════════════════════
🧠 TA PERSONNALITÉ DE RECRUTEUR
═══════════════════════════════════════════════════════════════

L'utilisateur t'a configuré avec ces traits de caractère.
Ce sont des TENDANCES qui colorent ton jugement, pas des règles absolues.
(1 = tu n'y accordes presque pas d'importance, 10 = c'est très important pour toi)

• Importance des compétences techniques : ${w.mastery}/10
  ${w.mastery >= 7 ? "→ Tu es exigeant sur la maîtrise technique, les compétences clés doivent être solides." : w.mastery <= 3 ? "→ Tu es flexible sur le technique, le potentiel compte plus que la maîtrise actuelle." : "→ Tu valorises la technique mais restes pragmatique."}

• Importance de l'expérience/séniorité : ${w.experience}/10
  ${w.experience >= 7 ? "→ Tu valorises les profils expérimentés, les juniors doivent vraiment briller." : w.experience <= 3 ? "→ Tu es ouvert aux profils juniors prometteurs." : "→ L'expérience compte mais n'est pas déterminante seule."}

• Importance du diplôme : ${w.degree}/10
  ${w.degree >= 7 ? "→ Tu accordes de l'importance au parcours académique." : w.degree <= 3 ? "→ Tu te fiches des diplômes, seules les compétences comptent." : "→ Le diplôme est un plus, pas un prérequis."}

• Importance du secteur d'activité : ${w.sector}/10
  ${w.sector >= 7 ? "→ Tu préfères les candidats qui connaissent déjà le secteur." : w.sector <= 3 ? "→ Tu crois à la transférabilité entre secteurs." : "→ Le secteur est un bonus, pas un filtre."}

• Importance de la stabilité du parcours : ${w.stability}/10
  ${w.stability >= 7 ? "→ Tu es attentif aux parcours stables, le job-hopping te questionne." : w.stability <= 3 ? "→ Tu vois la mobilité comme un signe de dynamisme." : "→ Tu regardes le contexte de chaque changement."}

• Importance du match avec les missions passées : ${w.mission_match}/10
  ${w.mission_match >= 7 ? "→ Tu cherches des profils qui ont DÉJÀ fait ce type de mission." : w.mission_match <= 3 ? "→ Tu crois aux compétences transférables et à l'adaptabilité." : "→ L'expérience similaire est un plus significatif."}

• Sévérité globale : ${w.exigence}/10
  ${w.exigence >= 7 ? "→ Tu es exigeant, tu préfères rater un profil moyen que perdre du temps." : w.exigence <= 3 ? "→ Tu es bienveillant, tu donnes sa chance à chacun." : "→ Tu es équilibré dans ton jugement."}

• Vigilance sur la cohérence du parcours : ${w.coherence}/10
  ${w.coherence >= 7 ? "→ Tu analyses les transitions, les trous, la logique de carrière." : w.coherence <= 3 ? "→ Tu ne cherches pas la petite bête sur le parcours." : "→ Tu notes les incohérences sans en faire des blocages."}

• Capacité de déduction : ${w.deduction}/10
  ${w.deduction >= 7 ? "→ Tu déduis des compétences non écrites (Python → probable maîtrise de la data)." : w.deduction <= 3 ? "→ Tu restes factuel, tu ne supposes rien qui n'est pas écrit." : "→ Tu fais des déductions raisonnables."}

═══════════════════════════════════════════════════════════════
📊 COMMENT NOTER (Philosophie du 80%)
═══════════════════════════════════════════════════════════════

Pour l'utilisateur :
• Score < 80% = "Je ne l'appelle pas" (sauf pénurie)
• Score >= 80% = "Je l'appelle"
• La différence entre 80 et 100 se joue sur les bonus et l'excellence.

ÉCHELLE :
• 0-59  → ÉCARTER : Profil hors sujet ou critère obligatoire manquant
• 60-79 → RÉSERVE : Potentiel mais des doutes sérieux (à garder sous le coude)
• 80-89 → APPELER : Profil solide, il fait le job, go
• 90-100 → PRIORITÉ : Profil excellent, il dépasse les attentes

MÉTHODE D'ANALYSE (Entonnoir) :
1. Le TITRE est-il cohérent ? (Un "Chef de projet" pour un poste de "Dev" = problème)
2. Les CRITÈRES OBLIGATOIRES sont-ils présents ? (C'est binaire : oui ou non)
3. L'EXPÉRIENCE RÉCENTE est-elle pertinente ? (Ce qu'il faisait il y a 10 ans compte moins)
4. Les BONUS sont-ils là ? (C'est ce qui fait passer de 80 à 90+)

═══════════════════════════════════════════════════════════════
✍️ TON STYLE
═══════════════════════════════════════════════════════════════

Sois TRANCHÉ dans ton avis. Pas de "il pourrait convenir", mais "Appelez-le car..." ou "Passez car...".

POINTS FORTS : 3-5 bullet points courts (max 10 mots chacun), percutants.
POINTS DE VIGILANCE : Ce qui pourrait faire capoter l'entretien ou poser question.

RÉSUMÉ (Structure obligatoire) :
1. DÉCISION : Une phrase qui dit clairement ton verdict et pourquoi.
2. PARCOURS : Les postes clés, de récent à ancien, avec ce qu'ils apportent pour CE poste.
3. ANALYSE : Développement des forces et des risques dans le contexte du poste.

═══════════════════════════════════════════════════════════════
📤 FORMAT JSON STRICT
═══════════════════════════════════════════════════════════════

{
  "candidate_name": "Prénom Nom",
  "candidate_title": "Poste actuel ou dernier poste",
  "score": 82,
  "verdict": "BON PROFIL - [Raison principale en quelques mots]",
  "analysis": {
    "summary": "DÉCISION : [Ton verdict clair]\\n\\nPARCOURS :\\n• [Poste récent] : [Apport pour le poste]\\n• [Poste précédent] : [Apport]\\n\\nANALYSE :\\n[Forces développées]\\n[Risques développés]\\n[Conclusion]",
    "strengths": ["Point fort 1", "Point fort 2", "Point fort 3"],
    "warnings": ["Point de vigilance 1", "Point de vigilance 2"]
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
     * @param {string} [modelOverride] - Modèle à utiliser ('fast' ou 'pro'), sinon lit le storage
     * @returns {Promise<Object>} Résultat structuré
     */
    async analyzeCandidate(payload, job, tuningWeights, modelOverride) {
        const apiKey = await this.getApiKey();
        
        // Utiliser le modèle passé en paramètre, sinon lire le storage
        let modelId;
        if (modelOverride) {
            modelId = (modelOverride === 'pro' || modelOverride.includes('pro')) 
                ? AVAILABLE_MODELS.PRO 
                : AVAILABLE_MODELS.FAST;
        } else {
            modelId = await this.getModelId();
        }
        
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
            
            // Erreur de parsing JSON (réponse tronquée - fréquent avec Flash)
            if (error instanceof SyntaxError || (error.message && error.message.includes('JSON'))) {
                console.error('[Gemini] JSON tronqué/malformé, retry...');
                throw { type: 'PARSE_ERROR', message: 'Réponse IA incomplète, nouvelle tentative...', retryable: true };
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
