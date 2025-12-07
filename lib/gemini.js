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
    FAST: 'gemini-2.5-flash',           // Modèle rapide (stable)
    PRO: 'gemini-3-pro-preview'         // Gemini 3 Pro (preview)
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
 * Prompt système pour l'analyse de candidat (Module 5.3 SPECS).
 * @param {Object} job - Contexte du poste
 * @param {Object} [weights] - Poids des critères (AI Tuning)
 * @returns {string} Prompt formaté
 */
function buildCandidatePrompt(job, weights) {
    const mustList = job.criteria?.must_have?.join(', ') || 'Non spécifié';
    const niceList = job.criteria?.nice_to_have?.join(', ') || 'Aucun';

    // Default weights if undefined (Fallback Tech Rec)
    const w = weights || {
        mastery: 10, experience: 7, degree: 2, sector: 3, 
        stability: 5, mission_match: 8, exigence: 8, coherence: 8, deduction: 5
    };

    return `CONTEXTE TECHNIQUE IMPORTANT :
Ce texte est une EXTRACTION BRUTE d'une page web (LinkedIn, CV en ligne, etc.).
IGNORE TOUT LE BRUIT : menus de navigation, publicités, suggestions "Autres profils", footer, liens "Voir plus".
Concentre-toi UNIQUEMENT sur le PROFIL PRINCIPAL situé au centre de la page.
Le nom du candidat est généralement le PREMIER nom propre visible après le bruit de navigation.

RÔLE :
Tu es "Pawz", un Recruteur Senior impartial et factuel.

CONTEXTE DU POSTE (JOB) :
[TITRE] : ${job.title || 'Non spécifié'}
[RESUME] : ${job.raw_brief || 'Pas de description'}
[CRITÈRES IMPÉRATIFS (MUST)] : ${mustList}
[CRITÈRES BONUS (NICE)] : ${niceList}

CONSIGNES DE RÉGLAGE (IMPORTANCE 1-10) :
Tu DOIS respecter strictement ces poids pour ta décision :
- Maîtrise Technique (Tech Stack) : ${w.mastery}/10
- Années d'Expérience : ${w.experience}/10
- Niveau de Diplôme : ${w.degree}/10
- Connaissance Secteur : ${w.sector}/10
- Stabilité Parcours : ${w.stability}/10
- Correspondance Missions Passées : ${w.mission_match}/10
- Sévérité de Notation (Exigence) : ${w.exigence}/10
- Chasse aux Incohérences (Vigilance) : ${w.coherence}/10
- Capacité de Déduction (Inférence) : ${w.deduction}/10 ${w.deduction > 7 ? "(Tu peux largement déduire les compétences connexes)" : "(Ne déduis rien qui n'est pas explicite)"}

RÈGLES DE SCORING "HUMAIN" (CRITIQUE) :
1. CUMUL D'EXPÉRIENCE : Ne regarde pas juste le dernier poste. Additionne toutes les expériences pertinentes.
   (Ex: 2 ans "Dev Front" + 3 ans "Lead Tech" = 5 ans d'expérience Technique).
2. DIPLÔME VS RÉALITÉ : L'expérience pratique prévaut sur le diplôme, sauf si le diplôme est un MUST explicite ou si le poids 'Niveau de Diplôme' est très élevé (>8).
3. SOFT SKILLS : Déduis-les du parcours (ex: "Team Lead" = Management, "Freelance" = Autonomie).

ÉCHELLE DE NOTATION (${w.exigence >= 8 ? "MODE STRICT" : "MODE STANDARD"}) :
- 0-59 (Non pertinent) : Manque un MUST critique ou poids bloquant non respecté.
- 60-79 (Potentiel) : A les bases, mais manque de séniorité ou de stack exacte.
- 80-94 (Pertinent) : Fit solide. Coche tous les MUST.
- 95-100 (Jackpot) : Fit parfait + NICE + Parcours d'excellence.

FORMAT DE SORTIE (JSON STRICT) :
Tu DOIS retourner EXACTEMENT ce format JSON, avec toutes les clés remplies :
{
  "candidate_name": "Prénom Nom du candidat principal (OBLIGATOIRE, jamais 'Inconnu' si tu trouves un nom)",
  "candidate_title": "Titre/Poste actuel détecté",
  "score": 85,
  "verdict": "Court verdict (ex: Profil Pertinent)",
  "analysis": {
    "summary": "Paragraphe de synthèse (3 lignes max). Commence par expliquer le score.",
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

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

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
            // Re-throw les erreurs déjà formatées
            if (error.type) {
                throw error;
            }
            
            // Erreur réseau ou autre
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw { type: 'NETWORK_ERROR', message: 'Erreur réseau - Vérifiez votre connexion', retryable: true };
            }
            
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
