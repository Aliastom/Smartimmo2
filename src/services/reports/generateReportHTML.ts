/**
 * Génère un rapport HTML imprimable depuis les données du rapport
 */

import type { DelegatedManagementReportData } from '@/types/reports';

export function generateReportHTML(data: DelegatedManagementReportData): string {
  const { gestionnaire, period, summary, lateRents, unmatchedTransactions, amountGaps, missingIndexations } = data;
  
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport Gestionnaire Délégué - ${gestionnaire.name}</title>
  <style>
    @media print {
      body { margin: 0; }
      .no-print { display: none; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 3px solid #f97316;
      padding-bottom: 10px;
      margin-bottom: 30px;
    }
    h2 {
      color: #374151;
      margin-top: 40px;
      margin-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
    }
    .header-info {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 30px 0;
    }
    .summary-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    .summary-card h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #6b7280;
      text-transform: uppercase;
    }
    .summary-card .value {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background: #fff;
    }
    th {
      background: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    tr:hover {
      background: #f9fafb;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-danger {
      background: #fee2e2;
      color: #991b1b;
    }
    .badge-warning {
      background: #fef3c7;
      color: #92400e;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>Rapport d'Anomalies - Gestionnaire Délégué</h1>
  
  <div class="header-info">
    <p><strong>Gestionnaire:</strong> ${gestionnaire.name}${gestionnaire.email ? ` (${gestionnaire.email})` : ''}</p>
    <p><strong>Période:</strong> Du ${formatDate(period.from)} au ${formatDate(period.to)}</p>
    <p><strong>Date de génération:</strong> ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  </div>

  <div class="summary">
    <div class="summary-card">
      <h3>Loyers en retard</h3>
      <div class="value">${summary.totalLateRents}</div>
      <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${formatCurrency(summary.totalLateRentsAmount)}</div>
    </div>
    <div class="summary-card">
      <h3>Transactions non rapprochées</h3>
      <div class="value">${summary.totalUnmatchedTransactions}</div>
      <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${formatCurrency(summary.totalUnmatchedAmount)}</div>
    </div>
    <div class="summary-card">
      <h3>Écarts de montant</h3>
      <div class="value">${summary.totalAmountGapsCases}</div>
      <div style="font-size: 14px; color: #6b7280; margin-top: 5px;">${formatCurrency(summary.totalAmountGapsValue)}</div>
    </div>
    <div class="summary-card">
      <h3>Total baux</h3>
      <div class="value">${summary.totalBaux}</div>
    </div>
  </div>

  ${lateRents.length > 0 ? `
    <h2>Loyers en retard (${lateRents.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Bien</th>
          <th>Locataire</th>
          <th>Mois</th>
          <th>Montant dû</th>
          <th>Retard</th>
        </tr>
      </thead>
      <tbody>
        ${lateRents.map(rent => `
          <tr>
            <td>${rent.bienLabel}</td>
            <td>${rent.locataireName}</td>
            <td>${rent.month}</td>
            <td>${formatCurrency(rent.dueAmount)}</td>
            <td><span class="badge badge-danger">${rent.delayInDays || 0} jour${(rent.delayInDays || 0) > 1 ? 's' : ''}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  ${unmatchedTransactions.length > 0 ? `
    <h2>Transactions non rapprochées (${unmatchedTransactions.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Libellé</th>
          <th>Montant</th>
          <th>Bien potentiel</th>
          <th>Locataire potentiel</th>
        </tr>
      </thead>
      <tbody>
        ${unmatchedTransactions.map(trans => `
          <tr>
            <td>${formatDate(trans.date)}</td>
            <td>${trans.label}</td>
            <td>${formatCurrency(trans.amount)}</td>
            <td>${trans.potentialBien || '-'}</td>
            <td>${trans.potentialLocataire || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  ${amountGaps.length > 0 ? `
    <h2>Écarts de montant (${amountGaps.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Bien</th>
          <th>Locataire</th>
          <th>Mois</th>
          <th>Montant attendu</th>
          <th>Montant reçu</th>
          <th>Écart</th>
        </tr>
      </thead>
      <tbody>
        ${amountGaps.map(gap => `
          <tr>
            <td>${gap.bienLabel}</td>
            <td>${gap.locataireName}</td>
            <td>${gap.month}</td>
            <td>${formatCurrency(gap.expectedAmount)}</td>
            <td>${formatCurrency(gap.receivedAmount)}</td>
            <td><span class="badge ${gap.diff > 0 ? 'badge-danger' : 'badge-warning'}">${formatCurrency(gap.diff)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  ${missingIndexations.length > 0 ? `
    <h2>Indexations non appliquées (${missingIndexations.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Bien</th>
          <th>Locataire</th>
          <th>Date anniversaire</th>
          <th>Indice</th>
          <th>Loyer actuel</th>
          <th>Loyer théorique</th>
          <th>Écart mensuel</th>
        </tr>
      </thead>
      <tbody>
        ${missingIndexations.map(index => `
          <tr>
            <td>${index.bienLabel}</td>
            <td>${index.locataireName}</td>
            <td>${formatDate(index.anniversaryDate)}</td>
            <td>${index.indexName}</td>
            <td>${formatCurrency(index.currentRent)}</td>
            <td>${formatCurrency(index.theoreticalRent)}</td>
            <td>${formatCurrency(index.diffPerMonth)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <div class="footer">
    <p>Rapport généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
    <p>Smartimmo - Gestion de patrimoine immobilier</p>
  </div>
</body>
</html>
  `;

  return html.trim();
}
