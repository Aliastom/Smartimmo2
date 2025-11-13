# 🛑 Script d'arrêt - Smartimmo2
# Usage: .\stop.ps1

Write-Host "`n🛑 Arrêt de Smartimmo2`n" -ForegroundColor Cyan
Write-Host "═" * 60 -ForegroundColor Cyan

# 1. Arrêter Docker
Write-Host "`n📦 Arrêt de Docker (PostgreSQL + Qdrant)..." -ForegroundColor Yellow
docker-compose stop

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de l'arrêt de Docker" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Services arrêtés proprement !`n" -ForegroundColor Green
Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host "`nℹ️  Notes:" -ForegroundColor Gray
Write-Host "   • Les données PostgreSQL sont préservées" -ForegroundColor Gray
Write-Host "   • Pour supprimer les conteneurs: docker-compose down" -ForegroundColor Gray
Write-Host "   • Pour redémarrer: .\start.ps1`n" -ForegroundColor Gray

