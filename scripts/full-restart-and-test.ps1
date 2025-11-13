# Script PowerShell pour redémarrer le serveur et tester le workflow

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  REDÉMARRAGE COMPLET ET TEST DU WORKFLOW BAIL SIGNÉ" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Étape 1 : Arrêter le serveur
Write-Host "📍 Étape 1/5 : Arrêt du serveur Next.js..." -ForegroundColor Yellow
Write-Host ""

$processesToKill = @()
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | ForEach-Object {
    $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)").CommandLine
    if ($commandLine -like "*next*") {
        $processesToKill += $_
        Write-Host "  → Arrêt du processus $($_.Id): $($_.ProcessName)" -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}

if ($processesToKill.Count -eq 0) {
    Write-Host "  ℹ️  Aucun serveur Next.js en cours d'exécution" -ForegroundColor Gray
} else {
    Write-Host "  ✅ $($processesToKill.Count) processus arrêté(s)" -ForegroundColor Green
}

Start-Sleep -Seconds 2
Write-Host ""

# Étape 2 : Informations importantes
Write-Host "📍 Étape 2/5 : Préparation du redémarrage..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  ⚠️  IMPORTANT : Vous devez maintenant :" -ForegroundColor Red
Write-Host "     1. Ouvrir un terminal PowerShell" -ForegroundColor White
Write-Host "     2. Exécuter : cd D:\Smartimmo2" -ForegroundColor White
Write-Host "     3. Exécuter : npm run dev" -ForegroundColor White
Write-Host "     4. Attendre que le serveur affiche 'Ready in X ms'" -ForegroundColor White
Write-Host ""
Write-Host "  📝 Une fois le serveur démarré, appuyez sur une touche pour continuer..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
Write-Host ""

# Étape 3 : Vérifier que le serveur est bien démarré
Write-Host "📍 Étape 3/5 : Vérification du serveur..." -ForegroundColor Yellow
Write-Host ""

$maxAttempts = 10
$attempt = 0
$serverReady = $false

while ($attempt -lt $maxAttempts -and -not $serverReady) {
    $attempt++
    Write-Host "  → Tentative $attempt/$maxAttempts..." -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        $serverReady = $true
        Write-Host "  ✅ Serveur prêt !" -ForegroundColor Green
    } catch {
        if ($attempt -lt $maxAttempts) {
            Start-Sleep -Seconds 2
        }
    }
}

if (-not $serverReady) {
    Write-Host "  ❌ Le serveur ne répond pas après $maxAttempts tentatives" -ForegroundColor Red
    Write-Host "  ⚠️  Vérifiez que 'npm run dev' est bien en cours d'exécution" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""

# Étape 4 : Créer un bail de test
Write-Host "📍 Étape 4/5 : Création d'un bail de test..." -ForegroundColor Yellow
Write-Host ""

npx tsx scripts/create-test-lease-for-workflow.ts

Write-Host ""

# Étape 5 : Instructions pour le test manuel
Write-Host "📍 Étape 5/5 : Test du workflow..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  ✅ Le serveur est prêt et un bail de test a été créé" -ForegroundColor Green
Write-Host ""
Write-Host "  📝 Pour tester le workflow :" -ForegroundColor Cyan
Write-Host "     1. Allez sur http://localhost:3000" -ForegroundColor White
Write-Host "     2. Ouvrez la page 'Biens'" -ForegroundColor White
Write-Host "     3. Cliquez sur le bien 'appart 6'" -ForegroundColor White
Write-Host "     4. Allez dans l'onglet 'Baux'" -ForegroundColor White
Write-Host "     5. Cliquez sur 'Modifier le bail' (dernier bail)" -ForegroundColor White
Write-Host "     6. Allez dans l'onglet 'Statut et workflow'" -ForegroundColor White
Write-Host "     7. Cliquez sur 'Uploader le bail signé'" -ForegroundColor White
Write-Host "     8. Uploadez un PDF" -ForegroundColor White
Write-Host ""
Write-Host "  🔍 Dans le terminal où npm run dev est en cours, vous devriez voir :" -ForegroundColor Cyan
Write-Host "     [Finalize] Verification du type de document: ..." -ForegroundColor Gray
Write-Host "     [Finalize] Document BAIL_SIGNE detecte: ..." -ForegroundColor Gray
Write-Host "     [Finalize] Statut du bail ... mis a jour a SIGNE ..." -ForegroundColor Gray
Write-Host ""
Write-Host "  ✅ Si vous voyez ces logs, la correction fonctionne !" -ForegroundColor Green
Write-Host ""
Write-Host "  📝 Pour vérifier le résultat dans la base de données :" -ForegroundColor Cyan
Write-Host "     npx tsx scripts/check-latest-lease-status.ts" -ForegroundColor White
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
