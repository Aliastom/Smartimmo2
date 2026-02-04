# Diagnostic Dexie + fake-indexeddb — Analyse technique

## Problème

Les tests Vitest échouent avec :
```
TypeError: Cannot read properties of undefined (reading 'prototype')
❯ Version.stores node_modules/dexie/src/classes/version/version.ts:58:60
```

## Analyse du code Dexie compilé

### 1. Structure du module Dexie

Dexie est enveloppé dans une IIFE (ligne 14-18 de `dexie.js`) :
```javascript
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Dexie = factory());
})(this, (function () { 'use strict';
    // ... code Dexie ...
}));
```

En Node.js/ESM, `this` est `undefined`, donc `global` devient `globalThis || global || self`.

### 2. `_global` et `domDeps`

- Ligne 52 : `_global = typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : global;`
- Lignes 5014-5023 : `domDeps` est initialisé **au moment de l'évaluation du module** :
  ```javascript
  var domDeps;
  try {
      domDeps = {
          indexedDB: _global.indexedDB || _global.mozIndexedDB || _global.webkitIndexedDB || _global.msIndexedDB,
          IDBKeyRange: _global.IDBKeyRange || _global.webkitIDBKeyRange
      };
  } catch (e) {
      domDeps = { indexedDB: null, IDBKeyRange: null };
  }
  ```
- Ligne 5102 : `Dexie.dependencies = domDeps;`

### 3. `idbReady()` — Référence lexicale directe

Lignes 3712-3724 :
```javascript
function idbReady() {
    var isSafari = !navigator.userAgentData &&
        /Safari\//.test(navigator.userAgent) &&
        !/Chrom(e|ium)\//.test(navigator.userAgent);
    if (!isSafari || !indexedDB.databases)  // ⚠️ ICI : indexedDB est une référence lexicale directe
        return Promise.resolve();
    // ...
}
```

**Problème** : `idbReady()` utilise directement `indexedDB` (pas `_global.indexedDB`). Cette référence est capturée au moment de l'évaluation du module Dexie. En Node.js, `indexedDB` n'existe pas comme variable globale, donc `indexedDB` est `undefined` dans cette closure.

### 4. `getDbNamesTable()` — Instance Dexie interne

Lignes 3667-3678 :
```javascript
function getDbNamesTable(indexedDB, IDBKeyRange) {
    var dbNamesDB = indexedDB["_dbNamesDB"];
    if (!dbNamesDB) {
        dbNamesDB = indexedDB["_dbNamesDB"] = new Dexie$1(DBNAMES_DB, {
            addons: [],
            indexedDB: indexedDB,
            IDBKeyRange: IDBKeyRange,
        });
        dbNamesDB.version(1).stores({ dbnames: "name" });  // ⚠️ ICI : peut déclencher l'erreur
    }
    return dbNamesDB.table("dbnames");
}
```

Cette fonction crée une instance Dexie interne qui appelle `version(1).stores()`, ce qui peut déclencher l'erreur si l'instance interne utilise une référence `indexedDB` incorrecte.

### 5. `Version.prototype.stores()` — Point d'erreur

Lignes 3628-3646 :
```javascript
Version.prototype.stores = function (stores) {
    var db = this.db;
    this._cfg.storesSource = this._cfg.storesSource ?
        extend(this._cfg.storesSource, stores) :
        stores;
    var versions = db._versions;
    var storesSpec = {};
    var dbschema = {};
    versions.forEach(function (version) {
        extend(storesSpec, version._cfg.storesSource);
        dbschema = (version._cfg.dbschema = {});
        version._parseStoresSpec(storesSpec, dbschema);  // ⚠️ ICI : peut déclencher l'erreur
    });
    // ...
};
```

L'erreur se produit dans `Version.stores()` ligne 58:60 du source TypeScript, mais le code compilé ne montre pas d'accès direct à `indexedDB.prototype` dans cette fonction.

## Hypothèse

L'erreur vient probablement de :
1. `getDbNamesTable()` qui crée une instance Dexie interne avec une référence `indexedDB` non patchée
2. OU d'un accès indirect à `indexedDB.prototype` via une closure interne de Dexie qui utilise une référence capturée avant que le setup ne soit appliqué

## Solution proposée

Créer une variable globale `indexedDB` accessible directement dans la closure de `idbReady()`. En Node.js/ESM, on ne peut pas créer une vraie variable globale avec `var indexedDB`, mais on peut utiliser `global.indexedDB` qui sera accessible comme variable globale dans certains contextes.

Cependant, le problème est que `idbReady()` capture `indexedDB` depuis le scope global au moment de l'évaluation du module Dexie. Si `indexedDB` n'existe pas à ce moment-là, `idbReady()` va échouer.

**Solution** : Utiliser `global.indexedDB` qui sera accessible comme variable globale en Node.js et s'assurer que c'est fait AVANT tout import Dexie (déjà fait dans `setup.ts`).

Mais le problème persiste, ce qui suggère que la référence utilisée par Dexie n'est pas celle qu'on patche.

## Conclusion

Le problème est que `idbReady()` utilise directement `indexedDB` depuis sa closure lexicale, et cette référence est `undefined` en Node.js. Même si on force `global.indexedDB`, la closure de `idbReady()` a déjà capturé `undefined` au moment de l'évaluation du module Dexie.

**Solution finale** : Il faut patcher Dexie directement pour que `idbReady()` utilise `_global.indexedDB` au lieu de `indexedDB`, OU utiliser un wrapper qui intercepte l'accès à `indexedDB` dans la closure de `idbReady()`.

Mais comme on ne peut pas modifier Dexie, la seule solution est de s'assurer que `indexedDB` existe comme variable globale AVANT l'évaluation du module Dexie, ce qui est déjà fait dans `setup.ts`.

Le problème persiste, ce qui suggère que la référence utilisée par Dexie n'est pas celle qu'on patche, ou qu'il y a une autre référence `indexedDB` dans une closure interne qui n'est pas patchée.
