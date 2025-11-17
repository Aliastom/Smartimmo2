/**
 * Script pour générer des icônes PWA placeholder
 * 
 * Usage: node scripts/generate-pwa-icons.js
 * 
 * Note: Ce script nécessite le package 'canvas' qui est déjà dans les dépendances.
 * Les icônes générées sont des placeholders simples avec le logo "SI" (Smartimmo).
 * Pour la production, remplacez ces icônes par de vraies icônes professionnelles.
 */

import fs from 'fs';
import path from 'path';
import { createCanvas } from 'canvas';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Créer le dossier icons s'il n'existe pas
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Couleurs du thème Smartimmo
const primaryColor = '#3b82f6';
const backgroundColor = '#ffffff';
const textColor = '#ffffff';

sizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Fond blanc
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, size, size);

  // Cercle bleu au centre
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.4;

  ctx.fillStyle = primaryColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.fill();

  // Texte "SI" au centre
  ctx.fillStyle = textColor;
  ctx.font = `bold ${size * 0.35}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SI', centerX, centerY);

  // Sauvegarder l'icône
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Icône générée: ${filePath} (${size}x${size})`);
});

console.log('\n🎉 Toutes les icônes PWA ont été générées !');
console.log('📝 Note: Remplacez ces icônes placeholder par de vraies icônes professionnelles pour la production.');

