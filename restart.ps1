# 🔄 Script de redémarrage - Smartimmo2
# Usage: .\restart.ps1

Write-Host "`n🔄 Redémarrage de Smartimmo2`n" -ForegroundColor Cyan
Write-Host "═" * 60 -ForegroundColor Cyan

# 1. Arrêter
Write-Host "`n🛑 Arrêt des services..." -ForegroundColor Yellow
docker-compose down

# 2. Nettoyer (optionnel)
$clean = Read-Host "`n❓ Voulez-vous nettoyer Qdrant ? (o/N)"
if ($clean -eq "o" -or $clean -eq "O") {
    Write-Host "   🗑️  Suppression de qdrant_storage..." -ForegroundColor Yellow
    Remove-Item -Path "qdrant_storage" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "   ✅ Qdrant nettoyé" -ForegroundColor Green
}

# 3. Redémarrer
Write-Host "`n🚀 Redémarrage..." -ForegroundColor Yellow
docker-compose up -d

Write-Host "   ⏳ Attente du démarrage..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# 4. Réingérer si nettoyé
if ($clean -eq "o" -or $clean -eq "O") {
    Write-Host "`n📚 Réingestion de la base de connaissances..." -ForegroundColor Yellow
    npm run ingest:kb
}

Write-Host "`n✅ Redémarrage terminé !`n" -ForegroundColor Green
Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host "`n🎯 Pour démarrer l'application:" -ForegroundColor Cyan
Write-Host "   npm run dev`n" -ForegroundColor White

