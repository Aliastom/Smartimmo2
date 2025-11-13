#!/bin/bash

# Script d'installation du module de scraping fiscal
# Usage: bash scripts/install-scraping-fiscal.sh

echo "╔════════════════════════════════════════════════════════╗"
echo "║  SmartImmo - Installation Module Scraping Fiscal      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction d'erreur
error() {
    echo -e "${RED}✗ Erreur: $1${NC}"
    exit 1
}

# Fonction de succès
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Fonction d'info
info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Vérifier Node.js
info "Vérification de Node.js..."
if ! command -v node &> /dev/null; then
    error "Node.js n'est pas installé"
fi
success "Node.js trouvé: $(node -v)"

# Vérifier npm
info "Vérification de npm..."
if ! command -v npm &> /dev/null; then
    error "npm n'est pas installé"
fi
success "npm trouvé: $(npm -v)"

# Installer les dépendances
echo ""
info "Installation des dépendances de production..."
npm install axios cheerio pdf-parse || error "Échec installation dépendances"
success "Dépendances de production installées"

echo ""
info "Installation des dépendances de développement..."
npm install -D @types/pdf-parse || error "Échec installation types"
success "Dépendances de développement installées"

# Appliquer la migration Prisma
echo ""
info "Application de la migration Prisma..."
npx prisma migrate deploy || {
    echo -e "${YELLOW}⚠ Migration échouée, tentative avec db push...${NC}"
    npx prisma db push || error "Échec migration Prisma"
}
success "Migration Prisma appliquée"

# Générer le client Prisma
echo ""
info "Génération du client Prisma..."
npx prisma generate || error "Échec génération client Prisma"
success "Client Prisma généré"

# Vérifier les fichiers
echo ""
info "Vérification des fichiers créés..."

FILES=(
    "src/services/tax/sources/types.ts"
    "src/services/tax/sources/utils.ts"
    "src/services/tax/sources/TaxScrapeWorker.ts"
    "src/services/tax/sources/adapters/BofipAdapter.ts"
    "src/services/tax/sources/adapters/DgfipAdapter.ts"
    "src/services/tax/sources/parsers/html.ts"
    "src/services/tax/sources/parsers/pdf.ts"
    "src/app/api/admin/tax/sources/update/route.ts"
    "src/app/api/admin/tax/sources/status/route.ts"
    "src/components/admin/fiscal/TaxSourceScrapeModal.tsx"
)

MISSING=0
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        success "$file"
    else
        echo -e "${RED}✗ Fichier manquant: $file${NC}"
        MISSING=$((MISSING + 1))
    fi
done

if [ $MISSING -gt 0 ]; then
    error "$MISSING fichier(s) manquant(s)"
fi

# Résumé
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║              Installation terminée ! ✓                 ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "📚 Documentation :"
echo "   - Guide complet : MODULE_SCRAPING_FISCAL_GUIDE.md"
echo "   - Installation  : INSTALL_SCRAPING_FISCAL.md"
echo "   - README        : src/services/tax/sources/README.md"
echo ""
echo "🚀 Pour tester :"
echo "   1. npm run dev"
echo "   2. Ouvrir http://localhost:3000/admin/impots/parametres"
echo "   3. Cliquer sur 'Mettre à jour depuis sources officielles'"
echo ""
echo "🧪 Pour lancer les tests :"
echo "   npm test src/services/tax/sources"
echo ""
success "Module de scraping fiscal prêt à l'emploi !"

