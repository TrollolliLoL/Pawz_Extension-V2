/**
 * PAWZ V2 - Client API Gemini
 * @module lib/gemini
 * 
 * Gère les appels à l'API Google Generative AI pour l'analyse de candidats.
 * Supporte le mode texte et PDF (multimodal).
 */

const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

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
 * @returns {string} Prompt formaté
 */
function buildCandidatePrompt(job) {
    const mustList = job.criteria?.must_have?.join(', ') || 'Non spécifié';
    const niceList = job.criteria?.nice_to_have?.join(', ') || 'Aucun';

    return `RÔLE :
Tu es "Pawz", un Recruteur Senior impartial et factuel.

CONTEXTE DU POSTE (JOB) :
[TITRE] : ${job.title || 'Non spécifié'}
[RESUME] : ${job.raw_brief || 'Pas de description'}
[CRITÈRES IMPÉRATIFS (MUST)] : ${mustList}
[CRITÈRES BONUS (NICE)] : ${niceList}

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
  "score": 85,
  "verdict": "Court verdict (ex: Profil Pertinent)",
  "analysis": {
    "summary": "Paragraphe de synthèse (3 lignes max). Commence par expliquer le score.",
    "strengths": ["Point fort 1", "Point fort 2"],
    "warnings": ["Point de vigilance 1", "Point de vigilance 2"]
  }
}`;
}

/**
 * Nettoie la réponse JSON de Gemini.
 * Gère le cas où la réponse est entourée de balises markdown.
 * @param {string} rawResponse - Réponse brute de l'API
 * @returns {Object} JSON parsé
 */
function cleanAndParseJSON(rawResponse) {
    if (!rawResponse) {
        throw new Error('Réponse vide de l\'API');
    }

    let jsonString = rawResponse.trim();

    // Supprimer les balises markdown ```json ... ```
    const jsonMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
        jsonString = jsonMatch[1].trim();
    }

    // Chercher l'objet JSON entre { et }
    const startIdx = jsonString.indexOf('{');
    const endIdx = jsonString.lastIndexOf('}');
    
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonString = jsonString.substring(startIdx, endIdx + 1);
    }

    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('[Gemini] Échec parsing JSON:', error);
        console.error('[Gemini] Contenu reçu:', jsonString.substring(0, 500));
        throw new Error(`Format JSON invalide: ${error.message}`);
    }
}

/**
 * Valide que le JSON contient les champs obligatoires.
 * @param {Object} result - Résultat de l'analyse
 * @returns {Object} Résultat validé avec valeurs par défaut si nécessaire
 */
function validateAnalysisResult(result) {
    return {
        candidate_name: result.candidate_name || 'Inconnu',
        candidate_title: result.candidate_title || 'Non détecté',
        score: typeof result.score === 'number' ? result.score : 0,
        verdict: result.verdict || 'Analyse incomplète',
        analysis: {
            summary: result.analysis?.summary || 'Résumé non disponible',
            strengths: Array.isArray(result.analysis?.strengths) ? result.analysis.strengths : [],
            warnings: Array.isArray(result.analysis?.warnings) ? result.analysis.warnings : []
        }
    };
}

/**
 * Client Gemini pour l'analyse de candidats.
 */
export const GeminiClient = {
    /**
     * Récupère la clé API depuis le storage.
     * @returns {Promise<string>} Clé API
     */
    async getApiKey() {
        const data = await chrome.storage.local.get('pawz_settings');
        const apiKey = data.pawz_settings?.api_key;
        
        if (!apiKey) {
            throw new Error('Clé API Gemini non configurée. Veuillez la définir dans les paramètres.');
        }
        
        return apiKey;
    },

    /**
     * Récupère le modèle IA configuré.
     * @returns {Promise<string>} ID du modèle
     */
    async getModelId() {
        const data = await chrome.storage.local.get('pawz_settings');
        return data.pawz_settings?.model_id || 'gemini-2.5-flash';
    },

    /**
     * Analyse un candidat avec l'IA Gemini.
     * @param {Object} payload - Payload du candidat { type, content }
     * @param {Object} job - Contexte du poste
     * @returns {Promise<Object>} Résultat de l'analyse
     */
    async analyzeCandidate(payload, job) {
        const apiKey = await this.getApiKey();
        const modelId = await this.getModelId();
        const systemPrompt = buildCandidatePrompt(job);

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
