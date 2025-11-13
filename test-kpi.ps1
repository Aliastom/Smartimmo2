# Script PowerShell de test du moteur KPI
# Usage: .\test-kpi.ps1

$API_URL = "http://localhost:3000/api/ai/kpi"

Write-Host "🧪 Test du moteur KPI..." -ForegroundColor Cyan
Write-Host ""

# Test 1 : Biens
Write-Host "1️⃣  Combien de biens au total ?" -ForegroundColor Yellow
$body1 = @{
    question = "Combien de biens au total ?"
} | ConvertTo-Json
$response1 = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body1 -ContentType "application/json"
Write-Host $response1.text -ForegroundColor Green
Write-Host ""

# Test 2 : Baux actifs
Write-Host "2️⃣  Combien de baux actifs ?" -ForegroundColor Yellow
$body2 = @{
    question = "Combien de baux actifs ?"
} | ConvertTo-Json
$response2 = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body2 -ContentType "application/json"
Write-Host $response2.text -ForegroundColor Green
Write-Host ""

# Test 3 : Loyers (temporel)
Write-Host "3️⃣  Combien de loyers encaissés ce mois ?" -ForegroundColor Yellow
$body3 = @{
    question = "Combien de loyers encaissés ce mois ?"
} | ConvertTo-Json
$response3 = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body3 -ContentType "application/json"
Write-Host $response3.text -ForegroundColor Green
Write-Host ""

# Test 4 : Cashflow (temporel)
Write-Host "4️⃣  Quel est mon cashflow cette année ?" -ForegroundColor Yellow
$body4 = @{
    question = "Quel est mon cashflow cette année ?"
} | ConvertTo-Json
$response4 = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body4 -ContentType "application/json"
Write-Host $response4.text -ForegroundColor Green
Write-Host ""

# Test 5 : Documents
Write-Host "5️⃣  Combien de documents non classés ?" -ForegroundColor Yellow
$body5 = @{
    question = "Combien de documents non classés ?"
} | ConvertTo-Json
$response5 = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body5 -ContentType "application/json"
Write-Host $response5.text -ForegroundColor Green
Write-Host ""

# Test 6 : Locataires
Write-Host "6️⃣  Combien de locataires ?" -ForegroundColor Yellow
$body6 = @{
    question = "Combien de locataires ?"
} | ConvertTo-Json
$response6 = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body6 -ContentType "application/json"
Write-Host $response6.text -ForegroundColor Green
Write-Host ""

# Test 7 : Pas de match (fallback)
Write-Host "7️⃣  Comment créer un bail ? (pas de match KPI)" -ForegroundColor Yellow
$body7 = @{
    question = "Comment créer un bail ?"
} | ConvertTo-Json
$response7 = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body7 -ContentType "application/json"
Write-Host "Matched: $($response7.matched)" -ForegroundColor $(if ($response7.matched) { "Green" } else { "Red" })
Write-Host ""

Write-Host "✅ Tests terminés !" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Résumé :" -ForegroundColor Cyan
Write-Host "  - API URL: $API_URL"
Write-Host "  - Tests exécutés: 7"
Write-Host ""
Write-Host "📚 Documentation: KPI_QUICK_START.md" -ForegroundColor Gray

