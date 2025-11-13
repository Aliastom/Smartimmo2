# 🚀 Script de démarrage automatique - Smartimmo2
# Usage: .\start.ps1

Write-Host "`n🚀 Démarrage de Smartimmo2`n" -ForegroundColor Cyan
Write-Host "═" * 60 -ForegroundColor Cyan

# 1. Démarrer Docker
Write-Host "`n📦 1/6 - Démarrage de Docker (PostgreSQL + Qdrant)..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors du démarrage de Docker" -ForegroundColor Red
    exit 1
}

# Attendre que les services soient prêts
Write-Host "   ⏳ Attente du démarrage des services..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# 2. Vérifier Docker
Write-Host "`n🔍 2/6 - Vérification des services Docker..." -ForegroundColor Yellow
docker-compose ps

# 3. Vérifier Ollama
Write-Host "`n🤖 3/6 - Vérification d'Ollama..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   ✅ Ollama est actif" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Ollama ne répond pas. Assurez-vous qu'il est lancé." -ForegroundColor Yellow
}

# 4. Vérifier l'environnement
Write-Host "`n⚙️  4/6 - Vérification de l'environnement..." -ForegroundColor Yellow
npm run check:env

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Problème de configuration. Vérifiez .env.local" -ForegroundColor Red
    exit 1
}

# 5. Générer Prisma
Write-Host "`n🗄️  5/6 - Génération du client Prisma..." -ForegroundColor Yellow
npm run prisma:generate

# 6. Vérifier Qdrant
Write-Host "`n🔍 6/6 - Vérification de la base de connaissances..." -ForegroundColor Yellow
Write-Host "   ℹ️  Si vous n'avez jamais ingéré de documents, lancez:" -ForegroundColor Gray
Write-Host "      npm run ingest:kb" -ForegroundColor Gray

# Tout est prêt
Write-Host "`n✅ Tous les services sont prêts !`n" -ForegroundColor Green
Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host "`n🎯 Pour démarrer l'application, lancez:" -ForegroundColor Cyan
Write-Host "   npm run dev`n" -ForegroundColor White
Write-Host "📖 L'application sera disponible sur: http://localhost:3000`n" -ForegroundColor Gray

