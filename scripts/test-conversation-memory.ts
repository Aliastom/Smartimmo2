/**
 * Test de la mémoire conversationnelle
 * Simule une conversation avec des questions de suivi
 */

import { PrismaClient } from '@prisma/client';
import { runReActAgent, type AgentConfig } from '../src/lib/ai/agent/react';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

interface TestConversation {
  name: string;
  messages: string[];
  expectedKeywords: string[][]; // Mots-clés attendus dans chaque réponse
}

const conversations: TestConversation[] = [
  {
    name: 'Question de suivi sur un document',
    messages: [
      "le compte rendu de gestion de la derniere transaction, il dit quoi ?",
      "c'est quoi le nom du fichier ?",
    ],
    expectedKeywords: [
      ['compte', 'rendu', 'gestion'], // 1ère réponse
      ['fichier', 'nom', '.pdf'], // 2ème réponse devrait mentionner le nom du fichier
    ],
  },
  {
    name: 'Question de suivi sur un calcul',
    messages: [
      "Combien j'ai encaissé ce mois-ci ?",
      "et le mois dernier ?",
    ],
    expectedKeywords: [
      ['encaiss', 'mois'], // 1ère réponse
      ['mois', 'dernier'], // 2ème réponse
    ],
  },
  {
    name: 'Question de suivi avec référence implicite',
    messages: [
      "Qui est le locataire de mon bien sur la rue de la République ?",
      "Il a payé son loyer ce mois-ci ?",
    ],
    expectedKeywords: [
      ['locataire', 'république'], // 1ère réponse
      ['pay', 'loyer', 'mois'], // 2ème réponse
    ],
  },
];

async function runConversationTest(test: TestConversation): Promise<{
  success: boolean;
  errors: string[];
  transcript: string[];
}> {
  console.log(`\n📝 Test: ${test.name}`);
  console.log('═'.repeat(60));

  const sessionId = randomUUID();
  const errors: string[] = [];
  const transcript: string[] = [];

  for (let i = 0; i < test.messages.length; i++) {
    const question = test.messages[i];
    const expectedKw = test.expectedKeywords[i];

    console.log(`\n${i + 1}. Question: "${question}"`);

    try {
      // Récupérer l'historique pour ce test
      const conversationHistory = await prisma.aiMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });

      const config: AgentConfig = {
        sessionId,
        correlationId: randomUUID(),
        context: {
          conversationHistory: conversationHistory.map(m => ({
            role: m.role,
            content: m.content,
            timestamp: m.createdAt,
          })),
        },
        maxIterations: 3,
        stream: false,
      };

      const result = await runReActAgent(question, config);

      console.log(`   ✓ Réponse: ${result.answer.substring(0, 200)}...`);
      transcript.push(`Q: ${question}`);
      transcript.push(`R: ${result.answer}\n`);

      // Vérifier les mots-clés attendus
      const answerLower = result.answer.toLowerCase();
      const missingKeywords = expectedKw.filter(kw => !answerLower.includes(kw.toLowerCase()));

      if (missingKeywords.length > 0) {
        const error = `   ⚠️  Mots-clés manquants: ${missingKeywords.join(', ')}`;
        console.log(error);
        errors.push(error);
      }

      // Pour le test de question de suivi, vérifier la cohérence
      if (i > 0) {
        // La 2ème réponse devrait faire référence au contexte de la 1ère
        if (test.name.includes('document') && i === 1) {
          // Devrait mentionner un nom de fichier
          if (!result.answer.match(/\.pdf|\.docx|fichier|document/i)) {
            const error = `   ❌ La réponse ne mentionne pas de fichier spécifique`;
            console.log(error);
            errors.push(error);
          }
        }
      }

      // Sauvegarder le message dans la session (simuler ce que fait l'API)
      await prisma.aiMessage.create({
        data: {
          sessionId,
          role: 'user',
          content: question,
          correlationId: config.correlationId,
        },
      });

      await prisma.aiMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: result.answer,
          tokensUsed: result.tokensUsed,
          correlationId: config.correlationId,
        },
      });

    } catch (error: any) {
      const errorMsg = `   ❌ Erreur: ${error.message}`;
      console.log(errorMsg);
      errors.push(errorMsg);
    }
  }

  const success = errors.length === 0;
  console.log(`\n${success ? '✅' : '❌'} Test ${success ? 'réussi' : 'échoué'}`);
  if (!success) {
    console.log('Erreurs:', errors);
  }

  // Nettoyer la session de test
  await prisma.aiMessage.deleteMany({ where: { sessionId } });
  await prisma.aiChatSession.deleteMany({ where: { id: sessionId } });

  return { success, errors, transcript };
}

async function main() {
  console.log('\n🧪 TEST DE LA MÉMOIRE CONVERSATIONNELLE\n');
  console.log('Objectif: Vérifier que l\'agent peut répondre à des questions de suivi');
  console.log('         en utilisant le contexte des messages précédents.\n');

  let totalTests = 0;
  let passedTests = 0;

  for (const test of conversations) {
    totalTests++;
    const result = await runConversationTest(test);
    if (result.success) passedTests++;

    // Afficher la transcription complète
    console.log('\n📄 Transcription complète:');
    console.log('─'.repeat(60));
    result.transcript.forEach(line => console.log(line));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 RÉSUMÉ: ${passedTests}/${totalTests} tests réussis`);
  console.log(`   ${passedTests === totalTests ? '✅ TOUS LES TESTS PASSENT' : '❌ CERTAINS TESTS ÉCHOUENT'}\n`);

  await prisma.$disconnect();
  process.exit(passedTests === totalTests ? 0 : 1);
}

main();
























