import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint pour recevoir les logs côté client et les afficher dans le terminal serveur
 */
export async function POST(request: NextRequest) {
  try {
    const { message, level = 'info' } = await request.json();
    
    // Afficher dans le terminal avec un préfixe pour identifier les logs App Shell
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '📝';
    console.log(`[${timestamp}] ${prefix} [APP-SHELL] ${message}`);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid log data' }, { status: 400 });
  }
}




