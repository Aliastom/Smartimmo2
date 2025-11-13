/**
 * SMARTIMMO - Helper de test pour les toasts
 * Utilisez ce fichier pour tester rapidement le système de toasts en développement
 * 
 * Usage dans la console du navigateur :
 * 1. Ouvrir DevTools (F12)
 * 2. Taper : testToasts()
 * 3. Observer les différentes variantes
 */

import { notify2 } from './notify2';

/**
 * Teste toutes les variantes de toasts
 */
export function testToasts() {
  console.log('🎨 Test des toasts - Variantes');
  
  // Variante Success
  setTimeout(() => {
    notify2.success('Test Success', 'Ceci est un toast de succès');
  }, 500);

  // Variante Error
  setTimeout(() => {
    notify2.error('Test Error', 'Ceci est un toast d\'erreur');
  }, 1500);

  // Variante Info
  setTimeout(() => {
    notify2.info('Test Info', 'Ceci est un toast d\'information');
  }, 2500);

  // Variante Warning
  setTimeout(() => {
    notify2.warning('Test Warning', 'Ceci est un toast d\'avertissement');
  }, 3500);

  console.log('✅ Tous les toasts ont été déclenchés (observer en haut à droite)');
}

/**
 * Teste un stack de plusieurs toasts en même temps
 */
export function testToastStack() {
  console.log('📚 Test du stack de toasts');
  
  notify2.success('Toast 1', 'Premier toast');
  notify2.info('Toast 2', 'Deuxième toast');
  notify2.warning('Toast 3', 'Troisième toast');
  notify2.error('Toast 4', 'Quatrième toast');
  
  console.log('✅ Stack de 4 toasts créé');
}

/**
 * Teste un toast de type promise (loading)
 */
export function testToastPromise() {
  console.log('⏳ Test du toast promise');
  
  const fakeApiCall = new Promise((resolve) => {
    setTimeout(() => resolve({ data: 'success' }), 3000);
  });

  notify2.promise(fakeApiCall, {
    loading: 'Chargement en cours...',
    success: 'Chargement terminé avec succès',
    error: 'Erreur lors du chargement'
  });
  
  console.log('✅ Toast promise déclenché (résout dans 3s)');
}

/**
 * Teste un toast sans description
 */
export function testToastSimple() {
  console.log('📝 Test des toasts simples (sans description)');
  
  notify2.success('Transaction créée');
  setTimeout(() => notify2.error('Échec de la suppression'), 1000);
  setTimeout(() => notify2.info('Chargement des données'), 2000);
  setTimeout(() => notify2.warning('Données non sauvegardées'), 3000);
  
  console.log('✅ 4 toasts simples déclenchés');
}

/**
 * Teste les cas limites (texte long, caractères spéciaux)
 */
export function testToastEdgeCases() {
  console.log('🔍 Test des cas limites');
  
  // Texte long
  notify2.success(
    'Titre très très très très long pour tester le wrapping',
    'Description également très longue qui devrait s\'afficher correctement même si elle fait plusieurs lignes et contient beaucoup de texte pour tester le comportement du toast dans ce cas de figure particulier.'
  );
  
  // Caractères spéciaux
  setTimeout(() => {
    notify2.info(
      'Caractères spéciaux : é à ç è ù ê',
      'Montant : 1 234,56 € - Date : 24/10/2025 - Référence : #REF-2025-001'
    );
  }, 1000);
  
  console.log('✅ Cas limites testés');
}

/**
 * Expose les fonctions de test dans window pour accès depuis la console
 */
if (typeof window !== 'undefined') {
  (window as any).testToasts = testToasts;
  (window as any).testToastStack = testToastStack;
  (window as any).testToastPromise = testToastPromise;
  (window as any).testToastSimple = testToastSimple;
  (window as any).testToastEdgeCases = testToastEdgeCases;
  
  console.log(`
  🎯 SMARTIMMO - Toast Test Helper chargé !
  
  Commandes disponibles dans la console :
  - testToasts()         : Teste toutes les variantes
  - testToastStack()     : Teste le stack (4 toasts)
  - testToastPromise()   : Teste un toast promise (loading)
  - testToastSimple()    : Teste des toasts simples
  - testToastEdgeCases() : Teste les cas limites
  
  Ou directement :
  - notify2.success('Message')
  - notify2.error('Erreur', 'Description')
  `);
}

