# Script d'installation OpenFisca + Module Scraping Fiscal (PowerShell)
# Usage: .\scripts\install-openfisca.ps1

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SmartImmo - Installation OpenFisca + Scraping        ║" -ForegroundColor Cyan
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

function Write-Warning {
    param($Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

# Vérifier Docker
Write-Info "Vérification de Docker..."
try {
    $dockerVersion = docker --version
    Write-Success "Docker trouvé: $dockerVersion"
} catch {
    Write-Warning "Docker non installé ou non démarré"
    Write-Info "OpenFisca sera sauté, le module fonctionnera en mode 'web scrapers uniquement'"
    $skipDocker = $true
}

if (-not $skipDocker) {
    # Démarrer OpenFisca
    Write-Host ""
    Write-Info "Démarrage du container OpenFisca-France..."
    
    # Vérifier si le container existe déjà
    $existing = docker ps -a --filter name=openfisca-france --format "{{.Names}}"
    
    if ($existing -eq "openfisca-france") {
        Write-Info "Container openfisca-france existe déjà, redémarrage..."
        docker start openfisca-france | Out-Null
    } else {
        docker run -d --name openfisca-france -p 5000:5000 openfisca/openfisca-france | Out-Null
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "OpenFisca-France démarré sur http://localhost:5000"
        
        # Attendre que le service soit prêt
        Write-Info "Attente du démarrage du service..."
        Start-Sleep -Seconds 3
        
        # Tester la connexion
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:5000/spec" -TimeoutSec 10 -UseBasicParsing
            Write-Success "OpenFisca répond correctement"
        } catch {
            Write-Warning "OpenFisca ne répond pas encore (normal au premier démarrage)"
            Write-Info "Réessayez dans 30 secondes: curl http://localhost:5000/spec"
        }
    } else {
        Write-Warning "Échec démarrage OpenFisca (le module fonctionnera sans)"
    }
    
    # Configurer .env.local
    Write-Host ""
    Write-Info "Configuration de .env.local..."
    
    if (Test-Path ".env.local") {
        # Vérifier si OPENFISCA_BASE_URL existe déjà
        $envContent = Get-Content ".env.local" -Raw
        if ($envContent -notmatch "OPENFISCA_BASE_URL") {
            Add-Content ".env.local" "`nOPENFISCA_BASE_URL=http://localhost:5000"
            Write-Success "OPENFISCA_BASE_URL ajouté à .env.local"
        } else {
            Write-Info "OPENFISCA_BASE_URL déjà présent dans .env.local"
        }
    } else {
        "OPENFISCA_BASE_URL=http://localhost:5000" | Out-File -FilePath ".env.local" -Encoding utf8
        Write-Success ".env.local créé avec OPENFISCA_BASE_URL"
    }
}

# Installer les dépendances du module scraping
Write-Host ""
Write-Info "Installation des dépendances de scraping..."
npm install axios cheerio pdf-parse
if ($LASTEXITCODE -ne 0) {
    Write-Error "Échec installation dépendances"
}
Write-Success "Dépendances installées"

Write-Host ""
Write-Info "Installation des types TypeScript..."
npm install -D @types/pdf-parse
if ($LASTEXITCODE -ne 0) {
    Write-Error "Échec installation types"
}
Write-Success "Types installés"

# Migration Prisma
Write-Host ""
Write-Info "Application de la migration Prisma..."
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Migration échouée, tentative avec db push..."
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

# Résumé
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║              Installation terminée ! ✓                 ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

if (-not $skipDocker) {
    Write-Host "🎯 OpenFisca :" -ForegroundColor Cyan
    Write-Host "   - Container : openfisca-france"
    Write-Host "   - URL       : http://localhost:5000"
    Write-Host "   - Test      : curl http://localhost:5000/spec"
    Write-Host ""
}

Write-Host "📚 Documentation :" -ForegroundColor Cyan
Write-Host "   - Démarrage rapide    : README_SCRAPING_FISCAL.md"
Write-Host "   - OpenFisca 5 min     : OPENFISCA_QUICK_START.md"
Write-Host "   - Configuration       : CONFIGURATION_OPENFISCA.md"
Write-Host "   - Guide complet       : MODULE_OPENFISCA_INTEGRATION.md"
Write-Host ""

Write-Host "🚀 Pour tester :" -ForegroundColor Cyan
Write-Host "   1. npm run dev"
Write-Host "   2. Ouvrir http://localhost:3000/admin/impots/parametres"
Write-Host "   3. Cliquer sur 'Mettre à jour depuis sources officielles'"
Write-Host "   4. Observer les logs en temps réel"
Write-Host "   5. Voir les barres de confiance par section"
Write-Host ""

Write-Host "🔒 Sécurités :" -ForegroundColor Cyan
Write-Host "   ✅ Aucune suppression de données possible"
Write-Host "   ✅ Publication bloquée si IR/PS confiance <80%"
Write-Host "   ✅ Fusion sécurisée section par section"
Write-Host "   ✅ Bug 'year' corrigé définitivement"
Write-Host ""

Write-Success "Module de scraping fiscal prêt avec OpenFisca !"
Write-Host ""

if (-not $skipDocker) {
    Write-Warning "Note: Lors du premier démarrage, OpenFisca peut mettre"
    Write-Warning "30-60 secondes à initialiser. Soyez patient ! 😊"
}

