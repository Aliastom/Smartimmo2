# Script PowerShell pour tester le healthcheck OpenFisca
# Usage: .\scripts\test-openfisca-health.ps1 [year]

param(
    [int]$Year = (Get-Date).Year
)

$url = "http://localhost:3000/api/admin/tax/openfisca/health?year=$Year"

Write-Host "🔍 Test healthcheck OpenFisca pour l'année $Year..." -ForegroundColor Cyan
Write-Host "URL: $url" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Get -ErrorAction Stop
    
    if ($response.ok) {
        Write-Host "✅ OpenFisca opérationnel" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Détails:" -ForegroundColor Yellow
        Write-Host "  Base URL    : $($response.baseUrl)"
        Write-Host "  Année       : $($response.year)"
        Write-Host "  Durée       : $($response.durationMs) ms"
        Write-Host ""
        Write-Host "  IR          : $($response.hasIR ? '✅' : '❌') ($($response.irCount) tranches)"
        Write-Host "  Décote      : $($response.hasDecote ? '✅' : '❌')"
        Write-Host "  PS          : $($response.hasPS ? '✅' : '❌') ($(if ($response.psRate) { ($response.psRate * 100).ToString('0.0') + '%' } else { 'N/A' }))"
        Write-Host "  Micro       : $($response.hasMicro ? '✅' : '❌')"
        Write-Host "  Déficit     : $($response.hasDeficit ? '✅' : '❌')"
        Write-Host "  PER         : $($response.hasPer ? '✅' : '❌')"
        Write-Host ""
        Write-Host "  Paramètres  : $($response.totalKeys) disponibles"
        Write-Host "  Clés        : $($response.keys -join ', ')"
        
        if ($response.warnings -and $response.warnings.Count -gt 0) {
            Write-Host ""
            Write-Host "⚠️  Warnings:" -ForegroundColor Yellow
            foreach ($warning in $response.warnings) {
                Write-Host "    - $warning" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "❌ OpenFisca indisponible" -ForegroundColor Red
        Write-Host ""
        Write-Host "Erreur: $($response.error)" -ForegroundColor Red
        Write-Host "Base URL: $($response.baseUrl)"
        Write-Host "Configuré: $($response.configured ? 'Oui' : 'Non')"
        
        if (-not $response.configured) {
            Write-Host ""
            Write-Host "💡 Solution: Ajouter dans .env.local:" -ForegroundColor Cyan
            Write-Host "   OPENFISCA_BASE_URL=http://localhost:5000" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "📄 JSON complet:" -ForegroundColor Gray
    $response | ConvertTo-Json -Depth 10
    
} catch {
    Write-Host "❌ Erreur lors de l'appel API" -ForegroundColor Red
    Write-Host ""
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Vérifiez que:" -ForegroundColor Yellow
    Write-Host "  1. Le serveur Next.js tourne (npm run dev)" -ForegroundColor Gray
    Write-Host "  2. L'URL est correcte: $url" -ForegroundColor Gray
    Write-Host "  3. Pas de firewall qui bloque localhost:3000" -ForegroundColor Gray
}

