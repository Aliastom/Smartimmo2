// Worker OCR dédié pour éviter les problèmes avec Next.js
// Ce worker fonctionne dans un thread séparé

import { createWorker } from 'tesseract.js';

let worker = null;

// Initialiser le worker Tesseract
async function initWorker() {
  if (!worker) {
    console.log('Initialisation du worker OCR...');
    worker = await createWorker('fra+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    console.log('Worker OCR initialisé');
  }
  return worker;
}

// Fonction principale d'extraction
async function extractText(buffer, fileName) {
  try {
    await initWorker();
    
    console.log(`Extraction OCR pour: ${fileName} (${buffer.length} bytes)`);
    
    // Utiliser Tesseract pour extraire le texte
    const { data: { text } } = await worker.recognize(buffer);
    
    const cleanText = text.trim();
    
    console.log(`Texte extrait: ${cleanText.length} caractères`);
    
    return {
      success: true,
      text: cleanText,
      source: 'tesseract',
      length: cleanText.length,
      preview: cleanText.length > 300 ? cleanText.substring(0, 300) + '...' : cleanText
    };
    
  } catch (error) {
    console.error('Erreur OCR:', error);
    return {
      success: false,
      text: '',
      source: 'tesseract',
      length: 0,
      preview: '',
      error: error.message
    };
  }
}

// Nettoyer le worker
async function cleanup() {
  if (worker) {
    await worker.terminate();
    worker = null;
    console.log('Worker OCR nettoyé');
  }
}

// Écouter les messages du thread principal
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'EXTRACT_TEXT':
      const result = await extractText(data.buffer, data.fileName);
      self.postMessage({
        type: 'EXTRACT_RESULT',
        data: result
      });
      break;
      
    case 'CLEANUP':
      await cleanup();
      self.postMessage({
        type: 'CLEANUP_COMPLETE'
      });
      break;
      
    default:
      console.warn('Message non reconnu:', type);
  }
});

console.log('Worker OCR chargé et prêt');
