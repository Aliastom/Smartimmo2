/**
 * API Route — Healthcheck OpenFisca
 * 
 * Vérifie la disponibilité et les données d'OpenFisca pour une année donnée
 */

import { NextResponse } from 'next/server';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const BASE = process.env.OPENFISCA_BASE_URL || '';

async function ofGet(path: string, params: Record<string, any> = {}) {
  if (!BASE || BASE.trim() === '') {
    throw new Error('OPENFISCA_BASE_URL non configurée');
  }

  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), { 
    cache: 'no-store'
    // Timeout géré par Next.js (10s par défaut)
  });

  if (!res.ok) {
    throw new Error(`OpenFisca HTTP ${res.status}: ${res.statusText}`);
  }

  return res.json();
}

export async function GET(req: Request) {
  const startTime = Date.now();

  try {
    const u = new URL(req.url);
    const year = Number(u.searchParams.get('year')) || new Date().getFullYear();

    console.log(`[OpenFisca Health] Vérification pour ${year}...`);
    console.log(`[OpenFisca Health] BASE = "${BASE}" (type: ${typeof BASE}, length: ${BASE.length})`);

    // Vérifier la configuration AVANT d'appeler ofGet
    if (!BASE || BASE.trim() === '') {
      console.warn('[OpenFisca Health] ⚠️ OPENFISCA_BASE_URL non configurée - Retour 200');
      const duration = Date.now() - startTime;
      
      return NextResponse.json(
        {
          ok: false,
          baseUrl: '(non configurée)',
          year,
          error: 'OPENFISCA_BASE_URL non configurée dans .env.local',
          durationMs: duration,
          configured: false
        },
        { status: 200 } // 200 car c'est un état attendu, pas une erreur serveur
      );
    }

    // Vérifier la disponibilité d'OpenFisca via /spec (plus rapide)
    const specData = await ofGet('/spec', {});
    const duration = Date.now() - startTime;

    // L'endpoint /parameters retourne une liste de LIENS, pas les valeurs directement
    // Pour l'instant, on vérifie juste que l'API répond
    // TODO: Implémenter l'extraction réelle via /parameter/{id} pour chaque section
    
    const apiTitle = specData?.info?.title || '';
    const apiVersion = specData?.info?.version || '';
    
    // Vérifier que c'est bien OpenFisca-France
    const isOpenFiscaFrance = apiTitle.toLowerCase().includes('france');
    
    // Pour une vraie extraction des données, il faudrait:
    // const irData = await ofGet('/parameter/impot_revenu.bareme', {});
    // const psData = await ofGet('/parameter/taxation_capital.prelevements_sociaux', {});
    // Mais c'est complexe et lent, donc on laisse en TODO
    
    const irCount = 0; // TODO: Extraire via /parameter/impot_revenu.bareme
    const hasDecote = false; // TODO
    const ps = null; // TODO: Extraire via /parameter approprié

    const result = {
      ok: true,
      baseUrl: BASE,
      year,
      durationMs: duration,
      apiTitle,
      apiVersion,
      isOpenFiscaFrance,
      
      // Sections disponibles (TODO: extraction réelle)
      hasIR: false, // TODO: Appeler /parameter/impot_revenu.bareme
      irCount: 0,   // TODO
      hasDecote: false, // TODO
      hasPS: false, // TODO
      psRate: null, // TODO
      hasMicro: false, // TODO
      hasDeficit: false, // TODO
      hasPer: false, // TODO
      
      // Meta
      note: 'Healthcheck basique: vérifie uniquement que l\'API répond. TODO: Extraire les valeurs fiscales via /parameter/{id}',
      
      // Warning
      warnings: [
        'Extraction des données fiscales non implémentée (TODO)',
        'Pour l\'instant, seule la disponibilité de l\'API est vérifiée'
      ] as string[]
    };

    console.log(`[OpenFisca Health] ✅ OK en ${duration}ms - API répond, version ${apiVersion}`);

    return NextResponse.json(result);

  } catch (e: any) {
    const duration = Date.now() - startTime;
    
    console.error(`[OpenFisca Health] ❌ Erreur après ${duration}ms:`, e.message);

    // Si l'erreur est "non configurée", retourner 200 (état attendu, pas une erreur serveur)
    const isConfigError = e.message?.includes('non configurée') || !BASE || BASE.trim() === '';
    
    return NextResponse.json(
      {
        ok: false,
        baseUrl: BASE || '(non configurée)',
        error: e.message || String(e),
        durationMs: duration,
        configured: !!BASE && BASE.trim() !== ''
      },
      { status: isConfigError ? 200 : 500 }
    );
  }
}

