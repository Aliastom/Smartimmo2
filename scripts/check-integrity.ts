/**
 * Script de vérification d'intégrité après migration
 * 
 * Compare les données entre SQLite et PostgreSQL pour vérifier l'intégrité
 * de la migration. Vérifie les comptages et échantillonne des enregistrements.
 * 
 * Usage:
 *   tsx scripts/check-integrity.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const SQLITE_URL = process.env.DATABASE_URL_SQLITE || 'file:./prisma/dev.db';
const POSTGRES_URL = process.env.DATABASE_URL_POSTGRES || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('❌ DATABASE_URL_POSTGRES ou DATABASE_URL doit être défini');
  process.exit(1);
}

interface IntegrityCheck {
  timestamp: string;
  source: string;
  target: string;
  tables: Record<string, {
    sqliteCount: number;
    pgCount: number;
    match: boolean;
    sampleChecks: Array<{
      id: string;
      matches: boolean;
      differences?: Record<string, { sqlite: any; postgres: any }>;
    }>;
  }>;
  summary: {
    totalTables: number;
    tablesWithMismatches: number;
    totalRecords: number;
    sampleCheckPassed: number;
    sampleCheckFailed: number;
  };
}

// Ordre des tables à vérifier
const TABLES_TO_CHECK = [
  'ManagementCompany',
  'AppSetting',
  'Property',
  'Tenant',
  'Lease',
  'LeaseVersion',
  'OccupancyHistory',
  'Transaction',
  'Category',
  'Loan',
  'Photo',
  'Document',
  'DocumentLink',
  'Payment',
];

class IntegrityChecker {
  private sqliteClient: PrismaClient;
  private pgClient: PrismaClient;
  private report: IntegrityCheck;

  constructor() {
    if (!POSTGRES_URL) {
      throw new Error('DATABASE_URL_POSTGRES or DATABASE_URL must be defined');
    }

    this.sqliteClient = new PrismaClient({
      datasources: {
        db: {
          url: SQLITE_URL,
        },
      },
    });

    this.pgClient = new PrismaClient({
      datasources: {
        db: {
          url: POSTGRES_URL,
        },
      },
    });

    this.report = {
      timestamp: new Date().toISOString(),
      source: SQLITE_URL,
      target: POSTGRES_URL,
      tables: {},
      summary: {
        totalTables: 0,
        tablesWithMismatches: 0,
        totalRecords: 0,
        sampleCheckPassed: 0,
        sampleCheckFailed: 0,
      },
    };
  }

  async check() {
    console.log('🔍 Vérification d\'intégrité SQLite ↔ PostgreSQL\n');
    const startTime = Date.now();

    try {
      // Vérifier les connexions
      await this.sqliteClient.$queryRaw`SELECT 1`;
      await this.pgClient.$queryRaw`SELECT 1`;
      console.log('✅ Connexions établies\n');

      // Vérifier chaque table
      for (const tableName of TABLES_TO_CHECK) {
        await this.checkTable(tableName);
      }

      // Générer le résumé
      this.generateSummary();

      // Afficher les résultats
      this.displayResults();

      // Générer le rapport
      this.generateReport();

      const duration = Date.now() - startTime;
      console.log(`\n⏱️  Durée: ${(duration / 1000).toFixed(2)}s`);

      // Exit avec code d'erreur si des problèmes ont été trouvés
      if (this.report.summary.tablesWithMismatches > 0 || this.report.summary.sampleCheckFailed > 0) {
        console.log('\n❌ Des incohérences ont été détectées');
        process.exit(1);
      } else {
        console.log('\n✅ Tous les contrôles ont réussi');
        process.exit(0);
      }

    } catch (error) {
      console.error('\n❌ Erreur fatale:', error);
      throw error;
    } finally {
      await this.sqliteClient.$disconnect();
      await this.pgClient.$disconnect();
    }
  }

  private async checkTable(tableName: string) {
    console.log(`📋 Vérification de ${tableName}...`);

    try {
      // Compter les enregistrements
      const sqliteCount = await (this.sqliteClient as any)[tableName].count();
      const pgCount = await (this.pgClient as any)[tableName].count();
      
      const match = sqliteCount === pgCount;
      
      // Échantillonner des enregistrements (max 20)
      const sampleSize = Math.min(20, sqliteCount);
      const samples = await this.getSamples(tableName, sampleSize);
      
      // Vérifier chaque échantillon
      const sampleChecks = await this.checkSamples(tableName, samples);

      this.report.tables[tableName] = {
        sqliteCount,
        pgCount,
        match,
        sampleChecks,
      };

      if (match) {
        console.log(`   ✅ Comptage: ${sqliteCount} enregistrements (match)`);
      } else {
        console.log(`   ❌ Comptage: ${sqliteCount} (SQLite) vs ${pgCount} (PostgreSQL)`);
        this.report.summary.tablesWithMismatches++;
      }

      const passed = sampleChecks.filter(s => s.matches).length;
      const failed = sampleChecks.length - passed;

      if (failed === 0) {
        console.log(`   ✅ Échantillons: ${passed}/${sampleChecks.length} vérifiés`);
      } else {
        console.log(`   ⚠️  Échantillons: ${passed}/${sampleChecks.length} OK, ${failed} échecs`);
      }

      this.report.summary.sampleCheckPassed += passed;
      this.report.summary.sampleCheckFailed += failed;

    } catch (error) {
      console.error(`   ❌ Erreur: ${error}`);
      this.report.tables[tableName] = {
        sqliteCount: 0,
        pgCount: 0,
        match: false,
        sampleChecks: [],
      };
    }
  }

  private async getSamples(tableName: string, sampleSize: number): Promise<any[]> {
    try {
      const total = await (this.sqliteClient as any)[tableName].count();
      
      if (total === 0) return [];

      // Prendre des échantillons aléatoires (simulation)
      const records = await (this.sqliteClient as any)[tableName].findMany({
        take: sampleSize,
        orderBy: { createdAt: 'desc' }, // Simple ordering instead of random
      });

      return records;
    } catch (error) {
      console.warn(`   ⚠️  Impossible d'échantillonner: ${error}`);
      return [];
    }
  }

  private async checkSamples(tableName: string, samples: any[]): Promise<Array<{
    id: string;
    matches: boolean;
    differences?: Record<string, { sqlite: any; postgres: any }>;
  }>> {
    const checks: Array<{
      id: string;
      matches: boolean;
      differences?: Record<string, { sqlite: any; postgres: any }>;
    }> = [];

    for (const sample of samples) {
      const id = sample.id;
      
      try {
        const pgRecord = await (this.pgClient as any)[tableName].findUnique({
          where: { id },
        });

        if (!pgRecord) {
          checks.push({ 
            id: String(id), 
            matches: false, 
            differences: { _existence: { sqlite: 'exists', postgres: 'missing' } } 
          });
          continue;
        }

        // Comparer les champs (exclure updatedAt qui peut différer)
        const differences: Record<string, { sqlite: any; postgres: any }> = {};
        
        for (const key in sample) {
          if (key === 'updatedAt') continue; // Ignorer updatedAt
          
          if (JSON.stringify(sample[key]) !== JSON.stringify(pgRecord[key])) {
            differences[key] = { sqlite: sample[key], postgres: pgRecord[key] };
          }
        }

        checks.push({
          id: String(id),
          matches: Object.keys(differences).length === 0,
          differences: Object.keys(differences).length > 0 ? differences : undefined,
        });

      } catch (error) {
        checks.push({ id: String(id), matches: false });
      }
    }

    return checks;
  }

  private generateSummary() {
    this.report.summary.totalTables = TABLES_TO_CHECK.length;
    
    // Compter le total d'enregistrements
    for (const tableName in this.report.tables) {
      this.report.summary.totalRecords += this.report.tables[tableName].pgCount;
    }
  }

  private displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ DE LA VÉRIFICATION');
    console.log('='.repeat(60));
    console.log(`Tables vérifiées: ${this.report.summary.totalTables}`);
    console.log(`Tables avec incohérences: ${this.report.summary.tablesWithMismatches}`);
    console.log(`Total enregistrements: ${this.report.summary.totalRecords}`);
    console.log(`Échantillons OK: ${this.report.summary.sampleCheckPassed}`);
    console.log(`Échantillons échoués: ${this.report.summary.sampleCheckFailed}`);
    console.log('='.repeat(60));

    // Afficher les détails des échecs
    if (this.report.summary.sampleCheckFailed > 0) {
      console.log('\n⚠️  DÉTAILS DES ÉCHECS:\n');
      
      for (const tableName in this.report.tables) {
        const table = this.report.tables[tableName];
        const failed = table.sampleChecks.filter(s => !s.matches);
        
        if (failed.length > 0) {
          console.log(`Table: ${tableName}`);
          for (const check of failed) {
            console.log(`  ID: ${check.id}`);
            if (check.differences) {
              for (const field in check.differences) {
                console.log(`    ${field}: ${JSON.stringify(check.differences[field].sqlite)} → ${JSON.stringify(check.differences[field].postgres)}`);
              }
            }
          }
          console.log();
        }
      }
    }
  }

  private generateReport() {
    const reportPath = path.join(process.cwd(), `integrity-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    console.log(`\n📄 Rapport généré: ${reportPath}`);
  }
}

// Exécution
async function main() {
  const checker = new IntegrityChecker();
  await checker.check();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
