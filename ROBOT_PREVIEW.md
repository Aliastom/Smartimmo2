# 🤖 Preview - Robot Compagnon IA Animé

## 🎨 Aperçu visuel (ASCII Art)

```
       •     •        ← Antennes avec bulles lumineuses animées
       |     |
     ┌─┴─────┴─┐
     │  💚 AI  │      ← LED verte qui pulse en haut
     │         │
     │  ◉   ◉  │      ← Yeux qui clignotent et bougent
     │         │
     │    ◡    │      ← Sourire animé
     │         │
     └─────────┘
    ▌         ▌       ← Capteurs latéraux (oreilles)
```

---

## ✨ Animations en action

### 👀 Yeux
```
Normal:    ◉   ◉
Cligne:    ⚊   ⚊  (150ms, toutes les 3-5s)
Regarde:   ◉   ◉  → ◉   ◉ → ◉   ◉
           \     /    \     /
           Gauche    Droite   Centre
```

### 📡 Antennes
```
Repos:     •     •
           |     |

Animées:   •     •
          /       \    ← Oscillation douce (±5°)
         |         |
```

### 💚 LED Indicateur
```
Pulse:  💚  →  💚  →  💚
        50%    100%    50%  (opacité + taille)
```

### 😊 Sourire
```
Normal:    ◡
Content:   ◡◡
Joyeux:    ⌣
```

---

## 🎬 Séquence d'animation (5 secondes)

```
T=0.0s  :  ◉   ◉  ◡   [Respiration: haut]
T=0.5s  :  ◉   ◉  ◡   [Antenne gauche bouge]
T=1.0s  :  ◉   ◉  ◡   [Respiration: bas]
T=1.5s  :  ◉   ◉  ◡◡  [Sourire s'élargit + LED pulse]
T=2.0s  :  ◉   ◉  ◡   [Respiration: haut + Antenne droite]
T=2.5s  :  ◉   ◉  ◡   
T=3.0s  :  ⚊   ⚊  ◡   [CLIGNEMENT !]
T=3.15s :  ◉   ◉  ◡   [Yeux rouverts]
T=3.5s  :  ◉   ◉  ◡   [Pupilles regardent à gauche]
T=4.0s  :  ◉   ◉  ◡   [Respiration: bas]
T=4.5s  :  ◉   ◉  ◡   [Pupilles regardent à droite]
T=5.0s  :  ◉   ◉  ◡   [Retour au centre → LOOP]
```

---

## 🎨 États visuels

### Normal (Idle)
```
     •     •
     |     |
   ┌─┴─────┴─┐
   │  💚 AI  │
   │         │
   │  ◉   ◉  │  ← Respiration douce
   │         │
   │    ◡    │  ← Sourire léger
   │         │
   └─────────┘
  ▌         ▌
```

### Au survol (Hover)
```
     •     •
    / \   / \     ← Antennes plus animées
   /   \ /   \
  /─────┴─────\
  │  💚 AI  │
  │         │
  │  ◉   ◉  │   ← Légère rotation de la tête
  │         │
  │    ⌣    │   ← Sourire plus large
  │         │
  └─────────┘
 ▌         ▌
    ✨ ✨         ← Effet de brillance
```

### Réfléchit (Thinking)
```
     •     •
     |     |
   ┌─┴─────┴─┐
   │  💚 AI  │
   │         │
   │  ◉   ◉  │   ← Pupilles en haut à gauche
   │         │
   │    ◡    │   ← Bouche neutre
   │  ─ ─ ─  │   ← Lignes de circuit actives
   └─────────┘
  ▌         ▌
```

### Erreur (Error)
```
     •     •
     |     |
   ┌─┴─────┴─┐
   │  💚 AI  │
   │         │
   │  ×   ×  │   ← Yeux en X
   │         │
   │    ◠    │   ← Sourcils froncés
   │    ∩    │   ← Bouche inquiète
   └─────────┘
  ▌         ▌
```

---

## 🌈 Effets visuels

### Badge indicateur
```
    ╭─────────╮
    │         │
    │   🤖    │
    │         │
    ╰─────────╯
          💚     ← Badge vert avec ring animé
           ◉
          ◉ ◉
         ◉   ◉   ← Effet de propagation
        ◉     ◉
```

### Bouton flottant complet
```
       ╭─────────╮
       │         │
       │   🤖    │  ← Robot au centre
       │         │
       ╰─────────╯
          💚        ← Badge "en ligne"
     
    ≋≋≋≋≋≋≋≋≋       ← Effet de pulse
   ≋         ≋
  ≋           ≋     ← S'agrandit et disparaît
 ≋             ≋
≋               ≋
```

---

## 📱 Différentes tailles

### Petit (32px) - Header Drawer
```
  • •
  | |
 ┌─┴─┐
 │💚 │
 │◉ ◉│
 │ ◡ │
 └───┘
▌   ▌
```

### Moyen (40px) - Bouton flottant
```
   • •
   | |
 ┌─┴─┴─┐
 │ 💚  │
 │     │
 │ ◉ ◉ │
 │     │
 │  ◡  │
 └─────┘
▌     ▌
```

### Grand (56px) - Full size
```
     • •
     | |
  ┌──┴─┴──┐
  │  💚   │
  │       │
  │ ◉   ◉ │
  │       │
  │   ◡   │
  │       │
  └───────┘
 ▌       ▌
```

---

## 🎨 Palette de couleurs

### Modes d'affichage

**Mode clair** :
```
Tête:      #primary (bleu/violet)
Yeux:      Blanc (#fff) + pupilles primary
Sourire:   Blanc (#fff)
LED:       Vert (#10b981)
Antennes:  Primary
```

**Mode sombre** :
```
Tête:      #primary (plus lumineux)
Yeux:      Blanc avec glow
Sourire:   Blanc avec glow
LED:       Vert lumineux (#22c55e)
Antennes:  Primary avec glow
```

---

## 🎭 Personnalité

Le robot transmet :
- ✨ **Bienveillance** (sourire constant)
- 🤖 **Intelligence** (LED verte, circuits)
- 👀 **Attention** (yeux qui bougent)
- 🎯 **Disponibilité** (badge vert, pulse)
- 💫 **Modernité** (animations fluides)

---

## 📊 Comparaison Avant/Après

### Avant
```
    ◯        Simple cercle
   / \       Icône générique MessageCircle
  /   \      Pas d'animations
 /     \     Pas de personnalité
/       \    
─────────
```

### Après
```
    • •       Antennes expressives
    | |       
  ┌─┴─┴─┐     
  │ 💚  │     LED indicateur
  │ ◉ ◉ │     Yeux animés
  │  ◡  │     Sourire vivant
  └─────┘     Forme distinctive
 ▌     ▌      Capteurs latéraux
 
✨ Effet wow garanti ! ✨
```

---

## 🚀 Résultat final

Un compagnon IA **vivant**, **expressif** et **attachant** qui :
- 👀 Observe l'utilisateur
- 💚 Indique sa disponibilité
- 😊 Sourit en permanence
- 🎬 S'anime de manière fluide
- ✨ Apporte de la personnalité à l'app

---

**Découvrez-le en action ! 🤖**

