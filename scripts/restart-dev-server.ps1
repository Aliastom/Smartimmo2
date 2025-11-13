# Script PowerShell pour redémarrer le serveur Next.js

Write-Host "🔄 Arrêt du serveur Next.js..." -ForegroundColor Yellow

# Tuer tous les processus node qui contiennent "next"
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | ForEach-Object {
    $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
    if ($commandLine -like "*next*") {
        Write-Host "  Arrêt du processus $($_.Id): $($_.ProcessName)" -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 2

Write-Host "✅ Serveur arrêté" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Redémarrage du serveur Next.js..." -ForegroundColor Cyan
Write-Host "   Exécutez maintenant: npm run dev" -ForegroundColor Yellow
Write-Host ""
