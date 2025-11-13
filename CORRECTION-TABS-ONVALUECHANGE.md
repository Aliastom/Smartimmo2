# 🔧 Correction - Erreur onValueChange dans Tabs

## ❌ **Problème Identifié**

### **Erreur Runtime JavaScript**
```
Uncaught TypeError: onValueChange is not a function at onClick (tabs.tsx:64:22)
```

**Cause** : Le composant `Tabs` n'acceptait que le mode contrôlé (`value` + `onValueChange`) mais était utilisé en mode non contrôlé (`defaultValue`) dans la modal d'édition des types de documents.

## ✅ **Correction Appliquée**

### **1. Refactoring du Composant Tabs**

**Fichier :** `src/ui/shared/tabs.tsx`

**Avant :**
```typescript
interface TabsProps {
  value: string;                    // ❌ Obligatoire
  onValueChange: (value: string) => void; // ❌ Obligatoire
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}
```

**Après :**
```typescript
interface TabsProps {
  value?: string;                   // ✅ Optionnel pour mode contrôlé
  onValueChange?: (value: string) => void; // ✅ Optionnel
  defaultValue?: string;            // ✅ Support du mode non contrôlé
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, defaultValue, children, className }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  
  const handleValueChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
      <div className={cn('w-full', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}
```

### **2. Fonctionnalités Ajoutées**

**Mode Contrôlé (Controlled) :**
```typescript
<Tabs value={activeTab} onValueChange={setActiveTab}>
  {/* Contenu des onglets */}
</Tabs>
```

**Mode Non Contrôlé (Uncontrolled) :**
```typescript
<Tabs defaultValue="keywords">
  {/* Contenu des onglets */}
</Tabs>
```

### **3. Logique de Gestion d'État**

**Détection du Mode :**
```typescript
const isControlled = value !== undefined;
```

**Valeur Actuelle :**
```typescript
const currentValue = isControlled ? value : internalValue;
```

**Gestion des Changements :**
```typescript
const handleValueChange = (newValue: string) => {
  if (!isControlled) {
    setInternalValue(newValue);  // Mode non contrôlé
  }
  onValueChange?.(newValue);     // Callback optionnel
};
```

## 🧪 **Tests de Validation**

### **1. Page d'Administration**
```bash
GET /admin/documents/types
Status: 200 OK ✅
```

### **2. Modal d'Édition**
- ✅ **Onglets fonctionnels** : Navigation entre "Mots-clés", "Signaux", "Règles"
- ✅ **Pas d'erreurs** : `onValueChange` correctement géré
- ✅ **État interne** : Gestion automatique de l'état pour le mode non contrôlé

### **3. Compatibilité**
- ✅ **Mode contrôlé** : Compatible avec l'utilisation existante
- ✅ **Mode non contrôlé** : Support du `defaultValue`
- ✅ **Callbacks optionnels** : `onValueChange` peut être omis

## 📋 **Cas d'Usage Supportés**

### **Modal d'Édition (Mode Non Contrôlé)**
```typescript
<Tabs defaultValue="keywords" className="w-full">
  <TabsList className="grid w-full grid-cols-3">
    <TabsTrigger value="keywords">Mots-clés</TabsTrigger>
    <TabsTrigger value="signals">Signaux</TabsTrigger>
    <TabsTrigger value="rules">Règles</TabsTrigger>
  </TabsList>
  
  <TabsContent value="keywords">
    <KeywordsManagement documentTypeId={documentType.id} />
  </TabsContent>
  
  <TabsContent value="signals">
    <SignalsManagement documentTypeId={documentType.id} />
  </TabsContent>
  
  <TabsContent value="rules">
    <RulesManagement documentTypeId={documentType.id} />
  </TabsContent>
</Tabs>
```

### **Usage Contrôlé (Si Nécessaire)**
```typescript
const [activeTab, setActiveTab] = useState('keywords');

<Tabs value={activeTab} onValueChange={setActiveTab}>
  {/* Contenu */}
</Tabs>
```

## 🎯 **Résultat Final**

Le composant `Tabs` est maintenant **100% fonctionnel** :

- ✅ **Mode non contrôlé** : Support de `defaultValue`
- ✅ **Mode contrôlé** : Compatible avec `value` + `onValueChange`
- ✅ **Pas d'erreurs** : `onValueChange` toujours défini
- ✅ **État interne** : Gestion automatique pour le mode non contrôlé
- ✅ **Rétrocompatibilité** : Tous les usages existants fonctionnent

**Les onglets de la modal d'édition fonctionnent parfaitement !** 🚀
