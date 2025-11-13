/**
 * Script de migration des données SQLite vers PostgreSQL
 * 
 * Ce script migre toutes les données de la base SQLite locale vers PostgreSQL
 * en préservant les IDs d'origine (CUID) pour maintenir les relations.
 * 
 * Usage:
 *   - Définir DATABASE_URL_SQLITE et DATABASE_URL_POSTGRES
 *   - Exécuter: tsx scripts/migrate-sqlite-to-postgres.ts
 * 
 * @example
 * DATABASE_URL_SQLITE="file:./prisma/dev.db"
 * DATABASE_URL_POSTGRES="postgresql://smartimmo:smartimmo@localhost:5432/smartimmo"
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SQLITE_URL = process.env.DATABASE_URL_SQLITE || 'file:./prisma/dev.db';
const POSTGRES_URL = process.env.DATABASE_URL_POSTGRES || process.env.DATABASE_URL;

if (!POSTGRES_URL) {
  console.error('❌ DATABASE_URL_POSTGRES ou DATABASE_URL doit être défini');
  process.exit(1);
}

// Types de données pour le rapport
interface MigrationReport {
  timestamp: string;
  source: string;
  target: string;
  tables: Record<string, {
    before: number;
    after: number;
    errors: string[];
    duration: number;
  }>;
  summary: {
    totalTables: number;
    totalRecords: number;
    totalErrors: number;
    duration: number;
  };
}

// Ordre topologique des tables (dépendances d'abord)
const TABLE_ORDER = [
  // Tables sans dépendances
  'Landlord',
  'UserProfile',
  'TaxConfig',
  'AppConfig',
  'AppSetting',
  'ManagementCompany',
  'Category',
  'NatureEntity',
  'NatureDefault',
  'NatureRule',
  'NatureCategoryAllowed',
  'NatureCategoryDefault',
  'DocumentType',
  'DocumentTypeField',
  'DocumentExtractionRule',
  'DocumentKeyword',
  'Signal',
  'TypeSignal',
  
  // Données utilisateur
  'Tenant',
  'Property',
  
  // Relations
  'OccupancyHistory',
  'Lease',
  'LeaseVersion',
  'Loan',
  'Transaction',
  'Payment',
  'PaymentAttachment',
  
  // Documents et médias
  'Photo',
  'UploadSession',
  'UploadStagedItem',
  'Document',
  'DocumentLink',
  'DocumentField',
  'DocumentTextIndex',
  'Reminder',
  
  // Logs
  'EmailLog',
];

// Clés primaires à préserver
const PRESERVE_IDS = true;

class MigrationTool {
  private sqliteClient: PrismaClient;
  private pgClient: PrismaClient;
  private report: MigrationReport;

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
        totalRecords: 0,
        totalErrors: 0,
        duration: 0,
      },
    };
  }

  async migrate() {
    const startTime = Date.now();
    console.log('🚀 Démarrage de la migration SQLite → PostgreSQL\n');

    try {
      // Vérifier les connexions
      await this.verifyConnections();

      // Migrer chaque table dans l'ordre topologique
      for (const tableName of TABLE_ORDER) {
        await this.migrateTable(tableName);
      }

      this.report.summary.duration = Date.now() - startTime;
      this.report.summary.totalTables = TABLE_ORDER.length;

      // Générer le rapport
      this.generateReport();

      console.log('\n✅ Migration terminée avec succès !');
      console.log(`⏱️  Durée totale: ${(this.report.summary.duration / 1000).toFixed(2)}s`);
      console.log(`📊 ${this.report.summary.totalRecords} enregistrements migrés`);
      console.log(`⚠️  ${this.report.summary.totalErrors} erreurs rencontrées`);
      
    } catch (error) {
      console.error('\n❌ Erreur fatale pendant la migration:', error);
      throw error;
    } finally {
      await this.sqliteClient.$disconnect();
      await this.pgClient.$disconnect();
    }
  }

  private async verifyConnections() {
    console.log('🔍 Vérification des connexions...');
    
    try {
      await this.sqliteClient.$queryRaw`SELECT 1`;
      console.log('✅ Connexion SQLite OK');
    } catch (error) {
      throw new Error(`Impossible de se connecter à SQLite: ${error}`);
    }

    try {
      await this.pgClient.$queryRaw`SELECT 1`;
      console.log('✅ Connexion PostgreSQL OK\n');
    } catch (error) {
      throw new Error(`Impossible de se connecter à PostgreSQL: ${error}`);
    }
  }

  private async migrateTable(tableName: string) {
    const startTime = Date.now();
    console.log(`📦 Migration de la table: ${tableName}`);

    try {
      // Comptage initial
      const before = await this.countRecords(tableName);
      
      // Récupération des données par batch
      const batchSize = 100;
      let offset = 0;
      let migrated = 0;

      while (true) {
        const batch = await this.fetchBatch(tableName, batchSize, offset);
        
        if (batch.length === 0) break;

        // Insertion en batch
        await this.insertBatch(tableName, batch);
        
        migrated += batch.length;
        offset += batchSize;
      }

      const after = await this.countRecords(tableName);
      const errors: string[] = [];

      if (migrated !== before && PRESERVE_IDS) {
        errors.push(`Incohérence de comptage: ${before} -> ${migrated} (attendu: ${before})`);
      }

      this.report.tables[tableName] = {
        before,
        after,
        errors,
        duration: Date.now() - startTime,
      };

      this.report.summary.totalRecords += migrated;

      console.log(`   ✅ ${migrated} enregistrements migrés en ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
      
      if (errors.length > 0) {
        console.log(`   ⚠️  Avertissements: ${errors.join(', ')}`);
        this.report.summary.totalErrors += errors.length;
      }

    } catch (error) {
      console.error(`   ❌ Erreur: ${error}`);
      this.report.tables[tableName] = {
        before: 0,
        after: 0,
        errors: [String(error)],
        duration: Date.now() - startTime,
      };
      this.report.summary.totalErrors++;
    }
  }

  private async countRecords(tableName: string): Promise<number> {
    try {
      // Utilisation de Prisma pour compter (safe)
      const count = await (this.sqliteClient as any)[tableName].count();
      return count;
    } catch (error) {
      console.warn(`   ⚠️  Impossible de compter ${tableName}: ${error}`);
      return 0;
    }
  }

  private async fetchBatch(tableName: string, batchSize: number, offset: number): Promise<any[]> {
    try {
      return await (this.sqliteClient as any)[tableName].findMany({
        take: batchSize,
        skip: offset,
      });
    } catch (error) {
      console.warn(`   ⚠️  Erreur lors de la récupération: ${error}`);
      return [];
    }
  }

  private async insertBatch(tableName: string, records: any[]): Promise<void> {
    if (records.length === 0) return;

    try {
      // Insertion en batch avec gestion des conflits
      for (const record of records) {
        try {
          await (this.pgClient as any)[tableName].create({
            data: record,
          });
        } catch (error: any) {
          // Ignorer les erreurs de duplication si on préserve les IDs
          if (error.code === 'P2002' && PRESERVE_IDS) {
            // ID déjà existant, on peut skip
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      throw new Error(`Erreur lors de l'insertion: ${error}`);
    }
  }

  private generateReport() {
    const reportPath = path.join(process.cwd(), `migration-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
    console.log(`\n📄 Rapport généré: ${reportPath}`);
  }
}

// Exécution
async function main() {
  const tool = new MigrationTool();
  await tool.migrate();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
