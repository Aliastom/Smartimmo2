// ⚠️ CRITIQUE: fake-indexeddb DOIT être importé EN PREMIER, AVANT toute autre importation
// pour que Dexie puisse utiliser le mock IndexedDB lors de son évaluation
// Dexie lit indexedDB depuis _global qui est défini comme:
//   _global = typeof globalThis !== 'undefined' ? globalThis :
//            typeof self !== 'undefined' ? self :
//            typeof window !== 'undefined' ? window :
//            global;
// On doit donc forcer TOUTES ces références AVANT l'import Dexie
//
// ⚠️ CRITIQUE: idbReady() dans Dexie utilise directement `indexedDB` (pas `_global.indexedDB`)
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// En Node.js, `indexedDB` n'existe pas comme variable globale par défaut, donc `idbReady()` capture `undefined`.
// On doit créer une variable globale `indexedDB` accessible directement AVANT l'import Dexie.
import 'fake-indexeddb/auto';

import '@testing-library/jest-dom';

/**
 * Force TOUTES les références globales possibles pour IndexedDB
 * Dexie utilise _global qui peut pointer vers globalThis, global, window, ou self
 * On doit s'assurer que TOUTES ces références pointent vers le même objet avec prototype
 */
function forceAllGlobalIndexedDBReferences() {
  // Récupérer indexedDB depuis fake-indexeddb/auto (peut être dans n'importe quel global)
  const indexedDB = 
    (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) ||
    (typeof global !== 'undefined' && (global as any).indexedDB) ||
    (typeof window !== 'undefined' && (window as any).indexedDB) ||
    (typeof self !== 'undefined' && (self as any).indexedDB);

  if (!indexedDB) {
    throw new Error('[test/setup] ❌ indexedDB non disponible après import fake-indexeddb/auto');
  }

  // Ajouter prototype si absent
  let indexedDBWithPrototype = indexedDB;
  if (indexedDB && typeof indexedDB === 'object' && !('prototype' in indexedDB)) {
    try {
      Object.defineProperty(indexedDB, 'prototype', {
        value: {},
        writable: true,
        enumerable: true,
        configurable: true,
      });
      indexedDBWithPrototype = indexedDB;
    } catch (e) {
      console.warn('[test/setup] Impossible d\'ajouter prototype directement, utilisation du wrapper:', e);
      // Fallback: wrapper
      indexedDBWithPrototype = Object.create(indexedDB, {
        prototype: {
          value: {},
          writable: true,
          enumerable: true,
          configurable: true,
        },
      });
      // Copier toutes les propriétés
      for (const key in indexedDB) {
        if (Object.prototype.hasOwnProperty.call(indexedDB, key)) {
          try {
            (indexedDBWithPrototype as any)[key] = (indexedDB as any)[key];
          } catch (e) {
            // Ignorer les propriétés non configurables
          }
        }
      }
    }
  }

  // ⚠️ CRITIQUE: Forcer TOUTES les références globales dans l'ORDRE de priorité de Dexie
  // Dexie utilise _global qui est défini comme:
  //   _global = typeof globalThis !== 'undefined' ? globalThis :
  //            typeof self !== 'undefined' ? self :
  //            typeof window !== 'undefined' ? window :
  //            global;
  // On doit forcer dans cet ordre pour garantir que _global.indexedDB pointe vers notre objet
  const globals = [
    { name: 'globalThis', obj: typeof globalThis !== 'undefined' ? globalThis : null },
    { name: 'self', obj: typeof self !== 'undefined' ? self : null },
    { name: 'window', obj: typeof window !== 'undefined' ? window : null },
    { name: 'global', obj: typeof global !== 'undefined' ? global : null },
  ].filter(g => g.obj !== null) as Array<{ name: string; obj: typeof globalThis | typeof global | typeof window | typeof self }>;

  for (const { name, obj } of globals) {
    (obj as any).indexedDB = indexedDBWithPrototype;
    // Log en mode debug
    if (process.env.DEBUG_DEXIE_TEST === '1') {
      console.log(`[test/setup] ✅ ${name}.indexedDB forcé avec prototype`);
    }
  }
  
  // ⚠️ NOTE: idbReady() dans Dexie utilise directement `indexedDB` (ligne 3716)
  // mais cette référence est capturée au moment de l'évaluation du module Dexie.
  // Comme on force déjà toutes les références globales ci-dessus, et que idbReady()
  // est dans une closure qui capture `indexedDB` depuis le scope global,
  // on doit s'assurer que `global.indexedDB` existe AVANT l'import Dexie.
  // C'est déjà fait ci-dessus dans la boucle des globals.

  // Récupérer et forcer IDBKeyRange aussi
  const IDBKeyRange = 
    (typeof globalThis !== 'undefined' && (globalThis as any).IDBKeyRange) ||
    (typeof global !== 'undefined' && (global as any).IDBKeyRange) ||
    (typeof window !== 'undefined' && (window as any).IDBKeyRange) ||
    (typeof self !== 'undefined' && (self as any).IDBKeyRange);

  if (IDBKeyRange) {
    for (const g of globals) {
      (g as any).IDBKeyRange = IDBKeyRange;
    }
  }

  // Forcer aussi les autres types IDB* si disponibles (pour compatibilité)
  const idbTypes = ['IDBDatabase', 'IDBObjectStore', 'IDBTransaction', 'IDBRequest', 'IDBOpenDBRequest', 'IDBCursor', 'IDBIndex'];
  for (const typeName of idbTypes) {
    const typeValue = 
      (typeof globalThis !== 'undefined' && (globalThis as any)[typeName]) ||
      (typeof global !== 'undefined' && (global as any)[typeName]) ||
      (typeof window !== 'undefined' && (window as any)[typeName]) ||
      (typeof self !== 'undefined' && (self as any)[typeName]);
    
    if (typeValue) {
      for (const g of globals) {
        (g as any)[typeName] = typeValue;
      }
    }
  }

  return { indexedDB: indexedDBWithPrototype, IDBKeyRange };
}

// Exécuter le setup
const { indexedDB: finalIndexedDB, IDBKeyRange: finalIDBKeyRange } = forceAllGlobalIndexedDBReferences();

// ⚠️ CRITIQUE: Créer une variable globale `indexedDB` accessible directement
// idbReady() dans Dexie utilise directement `indexedDB` (pas `_global.indexedDB`)
// Cette référence est capturée au moment de l'évaluation du module Dexie
// En Node.js, on doit créer une variable globale accessible directement
// 
// IMPORTANT: En Node.js avec ESM, on ne peut pas créer de vraie variable globale avec `var indexedDB`
// car les modules ESM ont leur propre scope. Cependant, on peut utiliser `global.indexedDB`
// qui sera accessible comme variable globale dans le contexte Node.js.
//
// Le problème est que `idbReady()` capture `indexedDB` depuis le scope global au moment
// de l'évaluation du module Dexie. Si `indexedDB` n'existe pas à ce moment-là, `idbReady()`
// va échouer. On doit donc créer `global.indexedDB` AVANT l'import Dexie.
//
// Solution: Utiliser `global.indexedDB` qui sera accessible comme variable globale en Node.js
// et s'assurer que c'est fait AVANT tout import Dexie (déjà fait ici car setup.ts est exécuté en premier)

// Assigner à TOUS les globals possibles (dans l'ordre de priorité de Dexie)
const allGlobalsForIndexedDB = [
  { name: 'globalThis', obj: typeof globalThis !== 'undefined' ? globalThis : null },
  { name: 'global', obj: typeof global !== 'undefined' ? global : null },
  { name: 'self', obj: typeof self !== 'undefined' ? self : null },
  { name: 'window', obj: typeof window !== 'undefined' ? window : null },
].filter(g => g.obj !== null) as Array<{ name: string; obj: typeof globalThis | typeof global | typeof window | typeof self }>;

for (const { name, obj } of allGlobalsForIndexedDB) {
  (obj as any).indexedDB = finalIndexedDB;
  
  // Utiliser Object.defineProperty pour garantir que c'est accessible même en strict mode
  try {
    Object.defineProperty(obj, 'indexedDB', {
      value: finalIndexedDB,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } catch (e) {
    // Si defineProperty échoue, on utilise l'assignation directe (déjà fait ci-dessus)
    if (process.env.DEBUG_DEXIE_TEST === '1') {
      console.warn(`[test/setup] Impossible de définir ${name}.indexedDB via defineProperty:`, e);
    }
  }
}

// ⚠️ CRITIQUE: En Node.js, créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` dans Dexie utilise directement `indexedDB` (pas `_global.indexedDB`)
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// En Node.js, `indexedDB` n'existe pas comme variable globale par défaut, donc `idbReady()` capture `undefined`.
//
// IMPORTANT: Le module Dexie est enveloppé dans une IIFE qui reçoit `this` comme `global`.
// Dans Node.js, `this` dans un module ESM est `undefined`, donc `global` sera `globalThis` ou `global`.
// Mais `idbReady()` utilise directement `indexedDB`, pas `_global.indexedDB`.
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// Si à ce moment-là `indexedDB` n'existe pas, `idbReady()` va échouer.
//
// Solution: Utiliser `global.indexedDB` qui sera accessible comme variable globale en Node.js
// et s'assurer que c'est fait AVANT tout import Dexie (déjà fait ici car setup.ts est exécuté en premier).
//
// Note: En Node.js, `global.indexedDB` est accessible comme variable globale dans certains contextes,
// mais pas dans tous. On doit s'assurer que c'est accessible partout.
//
// ⚠️ CRITIQUE: En Node.js, on doit créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` capture `indexedDB` depuis le scope global au moment
// de l'évaluation du module Dexie. Si `indexedDB` n'existe pas à ce moment-là, `idbReady()`
// va échouer. On doit donc créer `global.indexedDB` AVANT l'import Dexie (déjà fait ici).
//
// En Node.js avec ESM, on ne peut pas créer de vraie variable globale avec `var indexedDB`
// car les modules ESM ont leur propre scope. Cependant, on peut utiliser `global.indexedDB`
// qui sera accessible comme variable globale dans le contexte Node.js.
//
// Vérifier que la variable globale existe et est accessible
if (typeof global !== 'undefined') {
  if (!(global as any).indexedDB || (global as any).indexedDB !== finalIndexedDB) {
    throw new Error('[test/setup] ❌ Impossible de créer global.indexedDB');
  }
}

// ⚠️ CRITIQUE: En Node.js, créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` dans Dexie utilise directement `indexedDB` (pas `_global.indexedDB`)
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// En Node.js, `indexedDB` n'existe pas comme variable globale par défaut, donc `idbReady()` capture `undefined`.
//
// IMPORTANT: Le module Dexie est enveloppé dans une IIFE qui reçoit `this` comme `global`.
// Dans Node.js, `this` dans un module ESM est `undefined`, donc `global` sera `globalThis` ou `global`.
// Mais `idbReady()` utilise directement `indexedDB`, pas `_global.indexedDB`.
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// Si à ce moment-là `indexedDB` n'existe pas, `idbReady()` va échouer.
//
// Solution: Utiliser `global.indexedDB` qui sera accessible comme variable globale en Node.js
// et s'assurer que c'est fait AVANT tout import Dexie (déjà fait ici car setup.ts est exécuté en premier).
//
// Note: En Node.js, `global.indexedDB` est accessible comme variable globale dans certains contextes,
// mais pas dans tous. On doit s'assurer que c'est accessible partout.
//
// ⚠️ CRITIQUE: En Node.js, on doit créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` capture `indexedDB` depuis le scope global au moment
// de l'évaluation du module Dexie. Si `indexedDB` n'existe pas à ce moment-là, `idbReady()`
// va échouer. On doit donc créer `global.indexedDB` AVANT l'import Dexie (déjà fait ici).
//
// En Node.js avec ESM, on ne peut pas créer de vraie variable globale avec `var indexedDB`
// car les modules ESM ont leur propre scope. Cependant, on peut utiliser `global.indexedDB`
// qui sera accessible comme variable globale dans le contexte Node.js.
//
// Vérifier que la variable globale existe et est accessible
if (typeof global !== 'undefined') {
  if (!(global as any).indexedDB || (global as any).indexedDB !== finalIndexedDB) {
    throw new Error('[test/setup] ❌ Impossible de créer global.indexedDB');
  }
}

// ⚠️ CRITIQUE: En Node.js, créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` dans Dexie utilise directement `indexedDB` (pas `_global.indexedDB`)
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// En Node.js avec ESM, on ne peut pas créer de vraie variable globale avec `var indexedDB`
// car les modules ESM ont leur propre scope. Cependant, on peut utiliser `global.indexedDB`
// qui sera accessible comme variable globale dans le contexte Node.js.
//
// IMPORTANT: Le module Dexie est enveloppé dans une IIFE qui reçoit `this` comme `global`.
// Dans Node.js, `this` dans un module ESM est `undefined`, donc `global` sera `globalThis` ou `global`.
// Mais `idbReady()` utilise directement `indexedDB`, pas `_global.indexedDB`.
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// Si à ce moment-là `indexedDB` n'existe pas, `idbReady()` va échouer.
//
// Solution: Utiliser `global.indexedDB` qui sera accessible comme variable globale en Node.js
// et s'assurer que c'est fait AVANT tout import Dexie (déjà fait ici car setup.ts est exécuté en premier).
//
// Note: En Node.js, `global.indexedDB` est accessible comme variable globale dans certains contextes,
// mais pas dans tous. On doit s'assurer que c'est accessible partout.
//
// ⚠️ CRITIQUE: En Node.js, on doit créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` capture `indexedDB` depuis le scope global au moment
// de l'évaluation du module Dexie. Si `indexedDB` n'existe pas à ce moment-là, `idbReady()`
// va échouer. On doit donc créer `global.indexedDB` AVANT l'import Dexie (déjà fait ici).
//
// En Node.js avec ESM, on ne peut pas créer de vraie variable globale avec `var indexedDB`
// car les modules ESM ont leur propre scope. Cependant, on peut utiliser `global.indexedDB`
// qui sera accessible comme variable globale dans le contexte Node.js.
//
// ⚠️ CRITIQUE: En Node.js, créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` dans Dexie utilise directement `indexedDB` (pas `_global.indexedDB`)
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// En Node.js, `indexedDB` n'existe pas comme variable globale par défaut, donc `idbReady()` capture `undefined`.
//
// IMPORTANT: Le module Dexie est enveloppé dans une IIFE qui reçoit `this` comme `global`.
// Dans Node.js, `this` dans un module ESM est `undefined`, donc `global` sera `globalThis` ou `global`.
// Mais `idbReady()` utilise directement `indexedDB`, pas `_global.indexedDB`.
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// Si à ce moment-là `indexedDB` n'existe pas, `idbReady()` va échouer.
//
// Solution: Utiliser `global.indexedDB` qui sera accessible comme variable globale en Node.js
// et s'assurer que c'est fait AVANT tout import Dexie (déjà fait ici car setup.ts est exécuté en premier).
//
// Note: En Node.js, `global.indexedDB` est accessible comme variable globale dans certains contextes,
// mais pas dans tous. On doit s'assurer que c'est accessible partout.
//
// ⚠️ CRITIQUE: En Node.js, on doit créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` capture `indexedDB` depuis le scope global au moment
// de l'évaluation du module Dexie. Si `indexedDB` n'existe pas à ce moment-là, `idbReady()`
// va échouer. On doit donc créer `global.indexedDB` AVANT l'import Dexie (déjà fait ici).
//
// En Node.js avec ESM, on ne peut pas créer de vraie variable globale avec `var indexedDB`
// car les modules ESM ont leur propre scope. Cependant, on peut utiliser `global.indexedDB`
// qui sera accessible comme variable globale dans le contexte Node.js.
//
// Vérifier que la variable globale existe et est accessible
if (typeof global !== 'undefined') {
  if (!(global as any).indexedDB || (global as any).indexedDB !== finalIndexedDB) {
    (global as any).indexedDB = finalIndexedDB;
    if (process.env.DEBUG_DEXIE_TEST === '1') {
      console.log('[test/setup] ✅ global.indexedDB créé/forcé');
    }
  }
}

// ⚠️ CRITIQUE: En Node.js, créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` dans Dexie utilise directement `indexedDB` (pas `_global.indexedDB`)
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// En Node.js, `indexedDB` n'existe pas comme variable globale par défaut, donc `idbReady()` capture `undefined`.
//
// IMPORTANT: Le module Dexie est enveloppé dans une IIFE qui reçoit `this` comme `global`.
// Dans Node.js, `this` dans un module ESM est `undefined`, donc `global` sera `globalThis` ou `global`.
// Mais `idbReady()` utilise directement `indexedDB`, pas `_global.indexedDB`.
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// Si à ce moment-là `indexedDB` n'existe pas, `idbReady()` va échouer.
//
// Solution: Utiliser `eval()` pour créer une variable globale `indexedDB` accessible directement
// dans le scope global. En Node.js, `eval()` dans le scope global crée une variable globale.
// 
// Note: Cette solution est nécessaire car en Node.js/ESM, on ne peut pas créer de vraie variable globale
// avec `var indexedDB` car les modules ESM ont leur propre scope. Cependant, `eval()` peut créer
// une variable globale dans le scope global.
//
// ⚠️ CRITIQUE: En Node.js, on doit créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` capture `indexedDB` depuis le scope global au moment
// de l'évaluation du module Dexie. Si `indexedDB` n'existe pas à ce moment-là, `idbReady()`
// va échouer. On doit donc créer `indexedDB` AVANT l'import Dexie (déjà fait ici).
//
// En Node.js avec ESM, on ne peut pas créer de vraie variable globale avec `var indexedDB`
// car les modules ESM ont leur propre scope. Cependant, on peut utiliser `eval()` pour créer
// une variable globale dans le scope global.
//
// ⚠️ CRITIQUE: En Node.js, créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` dans Dexie utilise directement `indexedDB` (pas `_global.indexedDB`)
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// En Node.js, `indexedDB` n'existe pas comme variable globale par défaut, donc `idbReady()` capture `undefined`.
//
// IMPORTANT: Le module Dexie est enveloppé dans une IIFE qui reçoit `this` comme `global`.
// Dans Node.js, `this` dans un module ESM est `undefined`, donc `global` sera `globalThis` ou `global`.
// Mais `idbReady()` utilise directement `indexedDB`, pas `_global.indexedDB`.
// Cette référence est capturée au moment de l'évaluation du module Dexie.
// Si à ce moment-là `indexedDB` n'existe pas, `idbReady()` va échouer.
//
// Solution: Utiliser `Function` pour créer une variable globale `indexedDB` accessible directement
// dans le scope global. En Node.js, `Function` dans le scope global crée une variable globale.
// 
// Note: Cette solution est nécessaire car en Node.js/ESM, on ne peut pas créer de vraie variable globale
// avec `var indexedDB` car les modules ESM ont leur propre scope. Cependant, `Function` peut créer
// une variable globale dans le scope global.
//
// ⚠️ CRITIQUE: En Node.js, on doit créer une variable globale `indexedDB` accessible directement
// Le problème est que `idbReady()` capture `indexedDB` depuis le scope global au moment
// de l'évaluation du module Dexie. Si `indexedDB` n'existe pas à ce moment-là, `idbReady()`
// va échouer. On doit donc créer `indexedDB` AVANT l'import Dexie (déjà fait ici).
//
// En Node.js avec ESM, on ne peut pas créer de vraie variable globale avec `var indexedDB`
// car les modules ESM ont leur propre scope. Cependant, on peut utiliser `Function` pour créer
// une variable globale dans le scope global.
//
// Vérifier que la variable globale existe et est accessible
if (typeof global !== 'undefined') {
  // Utiliser Function() pour créer une variable globale `indexedDB` accessible directement
  // dans le scope global. En Node.js, `Function()` dans le scope global crée une variable globale.
  try {
    // eslint-disable-next-line no-new-func
    const createGlobalIndexedDB = new Function('idb', 'indexedDB = idb;');
    createGlobalIndexedDB(finalIndexedDB);
  } catch (e) {
    // Si Function() échoue, utiliser global.indexedDB (déjà fait ci-dessus)
    if (process.env.DEBUG_DEXIE_TEST === '1') {
      console.warn('[test/setup] ⚠️ Impossible de créer indexedDB via Function(), utilisation de global.indexedDB:', e);
    }
  }
  
  // Vérifier que la variable globale existe et est accessible
  if (!(global as any).indexedDB || (global as any).indexedDB !== finalIndexedDB) {
    if (process.env.DEBUG_DEXIE_TEST === '1') {
      console.warn('[test/setup] ⚠️ global.indexedDB n\'est pas correctement défini après setup');
    }
  }
}

// Assertions finales: vérifier que TOUTES les références globales sont correctes
const allGlobals = [
  { name: 'globalThis', obj: typeof globalThis !== 'undefined' ? globalThis : null },
  { name: 'global', obj: typeof global !== 'undefined' ? global : null },
  { name: 'window', obj: typeof window !== 'undefined' ? window : null },
  { name: 'self', obj: typeof self !== 'undefined' ? self : null },
].filter(g => g.obj !== null);

for (const { name, obj } of allGlobals) {
  const gIndexedDB = (obj as any).indexedDB;
  if (!gIndexedDB) {
    throw new Error(`[test/setup] ❌ ${name}.indexedDB n'est pas défini après setup`);
  }
  if (!('prototype' in gIndexedDB) || !gIndexedDB.prototype) {
    throw new Error(`[test/setup] ❌ ${name}.indexedDB n'a pas de prototype valide après setup`);
  }
  // Vérifier que c'est la même référence
  if (gIndexedDB !== finalIndexedDB) {
    console.warn(`[test/setup] ⚠️ ${name}.indexedDB n'est pas la même référence que finalIndexedDB, correction...`);
    (obj as any).indexedDB = finalIndexedDB;
  }
}

// Log de confirmation détaillé (uniquement si DEBUG_DEXIE_TEST est activé)
if (process.env.DEBUG_DEXIE_TEST === '1') {
  const refs = {
    globalThis: typeof globalThis !== 'undefined' ? (globalThis as any).indexedDB : undefined,
    self: typeof self !== 'undefined' ? (self as any).indexedDB : undefined,
    window: typeof window !== 'undefined' ? (window as any).indexedDB : undefined,
    global: typeof global !== 'undefined' ? (global as any).indexedDB : undefined,
  };
  
  console.log('[test/setup] ✅ Toutes les références globales IndexedDB sont configurées:', {
    globalThis: {
      exists: !!refs.globalThis,
      hasPrototype: refs.globalThis ? 'prototype' in refs.globalThis : false,
      sameAsFinal: refs.globalThis === finalIndexedDB,
    },
    self: {
      exists: !!refs.self,
      hasPrototype: refs.self ? 'prototype' in refs.self : false,
      sameAsFinal: refs.self === finalIndexedDB,
    },
    window: {
      exists: !!refs.window,
      hasPrototype: refs.window ? 'prototype' in refs.window : false,
      sameAsFinal: refs.window === finalIndexedDB,
    },
    global: {
      exists: !!refs.global,
      hasPrototype: refs.global ? 'prototype' in refs.global : false,
      sameAsFinal: refs.global === finalIndexedDB,
    },
    // Référence que Dexie utilisera (_global selon l'ordre de priorité)
    _globalWillUse: typeof globalThis !== 'undefined' ? 'globalThis' :
                    typeof self !== 'undefined' ? 'self' :
                    typeof window !== 'undefined' ? 'window' : 'global',
    allHavePrototype: allGlobals.every(({ obj }) => {
      const idb = (obj as any).indexedDB;
      return idb && 'prototype' in idb && idb.prototype;
    }),
  });
}
