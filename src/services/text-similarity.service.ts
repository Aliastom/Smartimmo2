/**
 * Service de calcul de similarité textuelle
 * Utilise l'algorithme TF-IDF avec similarité cosinus
 */

export class TextSimilarityService {
  /**
   * Calcule la similarité entre deux textes (0-1)
   * Utilise TF-IDF et similarité cosinus
   */
  static calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    // Normalisation
    const normalized1 = this.normalizeText(text1);
    const normalized2 = this.normalizeText(text2);
    
    if (normalized1 === normalized2) return 1.0;
    
    // Tokenisation
    const tokens1 = this.tokenize(normalized1);
    const tokens2 = this.tokenize(normalized2);
    
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    
    // Calcul TF (Term Frequency)
    const tf1 = this.calculateTF(tokens1);
    const tf2 = this.calculateTF(tokens2);
    
    // Union des termes
    const allTerms = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);
    
    // Calcul IDF (Inverse Document Frequency) simplifié
    const idf = this.calculateSimpleIDF(allTerms, [tf1, tf2]);
    
    // Vecteurs TF-IDF
    const vector1 = this.buildTFIDFVector(tf1, idf, allTerms);
    const vector2 = this.buildTFIDFVector(tf2, idf, allTerms);
    
    // Similarité cosinus
    return this.cosineSimilarity(vector1, vector2);
  }
  
  /**
   * Normalise un texte (lowercase, suppression ponctuation, espaces multiples)
   */
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remplacer ponctuation par espaces
      .replace(/\s+/g, ' ')      // Normaliser espaces multiples
      .trim();
  }
  
  /**
   * Tokenise un texte en mots
   */
  private static tokenize(text: string): string[] {
    return text.split(/\s+/).filter(word => word.length > 2); // Mots > 2 caractères
  }
  
  /**
   * Calcule les fréquences des termes (TF)
   */
  private static calculateTF(tokens: string[]): Record<string, number> {
    const tf: Record<string, number> = {};
    const total = tokens.length;
    
    for (const token of tokens) {
      tf[token] = (tf[token] || 0) + 1;
    }
    
    // Normaliser par le nombre total de tokens
    for (const term in tf) {
      tf[term] = tf[term] / total;
    }
    
    return tf;
  }
  
  /**
   * Calcule l'IDF simplifié (pour 2 documents seulement)
   */
  private static calculateSimpleIDF(
    allTerms: Set<string>,
    tfMaps: Record<string, number>[]
  ): Record<string, number> {
    const idf: Record<string, number> = {};
    const numDocs = tfMaps.length;
    
    for (const term of allTerms) {
      let docCount = 0;
      for (const tfMap of tfMaps) {
        if (tfMap[term]) docCount++;
      }
      
      // IDF = log(N / df) où N = nombre de docs, df = nombre de docs contenant le terme
      idf[term] = Math.log((numDocs + 1) / (docCount + 1)) + 1;
    }
    
    return idf;
  }
  
  /**
   * Construit un vecteur TF-IDF
   */
  private static buildTFIDFVector(
    tf: Record<string, number>,
    idf: Record<string, number>,
    allTerms: Set<string>
  ): number[] {
    const vector: number[] = [];
    
    for (const term of allTerms) {
      const tfValue = tf[term] || 0;
      const idfValue = idf[term] || 0;
      vector.push(tfValue * idfValue);
    }
    
    return vector;
  }
  
  /**
   * Calcule la similarité cosinus entre deux vecteurs
   */
  private static cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (magnitude1 * magnitude2);
  }
  
  /**
   * Méthode alternative : Similarité de Jaccard (pour comparaison rapide)
   */
  static jaccardSimilarity(text1: string, text2: string): number {
    const set1 = new Set(this.tokenize(this.normalizeText(text1)));
    const set2 = new Set(this.tokenize(this.normalizeText(text2)));
    
    if (set1.size === 0 && set2.size === 0) return 1.0;
    if (set1.size === 0 || set2.size === 0) return 0;
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Méthode alternative : Distance de Levenshtein normalisée
   */
  static levenshteinSimilarity(text1: string, text2: string): number {
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    
    if (maxLength === 0) return 1.0;
    
    return 1 - (distance / maxLength);
  }
  
  /**
   * Calcule la distance de Levenshtein entre deux chaînes
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];
    
    // Initialisation
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // Calcul
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // Suppression
          matrix[i][j - 1] + 1,      // Insertion
          matrix[i - 1][j - 1] + cost // Substitution
        );
      }
    }
    
    return matrix[len1][len2];
  }
}

