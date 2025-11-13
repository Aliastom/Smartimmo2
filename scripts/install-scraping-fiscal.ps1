# Script d'installation du module de scraping fiscal (PowerShell)
# Usage: .\scripts\install-scraping-fiscal.ps1

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SmartImmo - Installation Module Scraping Fiscal      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

function Write-Success {
    param($Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error {
    param($Message)
    Write-Host "✗ Erreur: $Message" -ForegroundColor Red
    exit 1
}

function Write-Info {
    param($Message)
    Write-Host "→ $Message" -ForegroundColor Yellow
}

# Vérifier Node.js
Write-Info "Vérification de Node.js..."
try {
    $nodeVersion = node -v
    Write-Success "Node.js trouvé: $nodeVersion"
} catch {
    Write-Error "Node.js n'est pas installé"
}

# Vérifier npm
Write-Info "Vérification de npm..."
try {
    $npmVersion = npm -v
    Write-Success "npm trouvé: $npmVersion"
} catch {
    Write-Error "npm n'est pas installé"
}

# Installer les dépendances
Write-Host ""
Write-Info "Installation des dépendances de production..."
npm install axios cheerio pdf-parse
if ($LASTEXITCODE -ne 0) {
    Write-Error "Échec installation dépendances"
}
Write-Success "Dépendances de production installées"

Write-Host ""
Write-Info "Installation des dépendances de développement..."
npm install -D @types/pdf-parse
if ($LASTEXITCODE -ne 0) {
    Write-Error "Échec installation types"
}
Write-Success "Dépendances de développement installées"

# Appliquer la migration Prisma
Write-Host ""
Write-Info "Application de la migration Prisma..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Migration échouée, tentative avec db push..." -ForegroundColor Yellow
    npx prisma db push
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Échec migration Prisma"
    }
}
Write-Success "Migration Prisma appliquée"

# Générer le client Prisma
Write-Host ""
Write-Info "Génération du client Prisma..."
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Error "Échec génération client Prisma"
}
Write-Success "Client Prisma généré"

# Vérifier les fichiers
Write-Host ""
Write-Info "Vérification des fichiers créés..."

$files = @(
    "src\services\tax\sources\types.ts",
    "src\services\tax\sources\utils.ts",
    "src\services\tax\sources\TaxScrapeWorker.ts",
    "src\services\tax\sources\adapters\BofipAdapter.ts",
    "src\services\tax\sources\adapters\DgfipAdapter.ts",
    "src\services\tax\sources\parsers\html.ts",
    "src\services\tax\sources\parsers\pdf.ts",
    "src\app\api\admin\tax\sources\update\route.ts",
    "src\app\api\admin\tax\sources\status\route.ts",
    "src\components\admin\fiscal\TaxSourceScrapeModal.tsx"
)

$missing = 0
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Success $file
    } else {
        Write-Host "✗ Fichier manquant: $file" -ForegroundColor Red
        $missing++
    }
}

if ($missing -gt 0) {
    Write-Error "$missing fichier(s) manquant(s)"
}

# Résumé
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              Installation terminée ! ✓                 ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "📚 Documentation :" -ForegroundColor Cyan
Write-Host "   - Guide complet : MODULE_SCRAPING_FISCAL_GUIDE.md"
Write-Host "   - Installation  : INSTALL_SCRAPING_FISCAL.md"
Write-Host "   - README        : src\services\tax\sources\README.md"
Write-Host ""
Write-Host "🚀 Pour tester :" -ForegroundColor Cyan
Write-Host "   1. npm run dev"
Write-Host "   2. Ouvrir http://localhost:3000/admin/impots/parametres"
Write-Host "   3. Cliquer sur 'Mettre à jour depuis sources officielles'"
Write-Host ""
Write-Host "🧪 Pour lancer les tests :" -ForegroundColor Cyan
Write-Host "   npm test src/services/tax/sources"
Write-Host ""
Write-Success "Module de scraping fiscal prêt à l'emploi !"

