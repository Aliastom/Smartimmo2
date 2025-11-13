# Script simple pour redemarrer le serveur Next.js

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  REDEMARRAGE DU SERVEUR NEXT.JS" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Arreter tous les processus node
Write-Host "Arret des processus Node.js..." -ForegroundColor Yellow
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "OK - Processus arretes" -ForegroundColor Green
Write-Host ""

Write-Host "IMPORTANT: Vous devez maintenant executer:" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "Apres le demarrage du serveur, testez l'upload du bail signe" -ForegroundColor Cyan
Write-Host "et verifiez les logs [Finalize] dans le terminal." -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour verifier le resultat:" -ForegroundColor Cyan
Write-Host "  npx tsx scripts/check-latest-lease-status.ts" -ForegroundColor White
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
