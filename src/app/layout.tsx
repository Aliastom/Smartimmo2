import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@/styles/toasts.css';
import { AppShell } from '@/components/layout/AppShell';
import QueryProvider from '@/ui/providers/QueryProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { TooltipProvider } from '@/components/providers/TooltipProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { UnifiedUploadReviewModal } from '@/components/documents/UnifiedUploadReviewModal';
import { UploadReviewModalProvider } from '@/contexts/UploadReviewModalContext';
import { RouteProgressProvider } from '@/components/RouteProgressProvider';
import { AlertProvider } from '@/hooks/useAlert';
import { CompanionProvider } from '@/ui/companion/CompanionProvider';
import { CompanionDock } from '@/ui/companion/CompanionDock';
import { SmartTopLoader } from '@/components/SmartTopLoader';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
// Import du helper de test en développement uniquement
if (process.env.NODE_ENV === 'development') {
  import('@/lib/toast-test-helper');
}

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SmartImmo - Gestion Immobilière',
  description: 'Application de gestion immobilière moderne et responsive',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Smartimmo',
  },
  icons: {
    apple: '/icons/icon-180.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#3b82f6',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" data-theme="smartimmo">
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#3b82f6" />
        {/* iOS Specific */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Smartimmo" />
        <link rel="apple-touch-icon" href="/icons/icon-180.png" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <QueryProvider>
            <LoadingProvider>
              <SmartTopLoader
                color="#0ea5e9"
                height={5}
                shadowColor="rgba(14, 165, 233, 0.5)"
                initialProgress={20}
                zIndex={9999}
              />
              <AlertProvider>
              <TooltipProvider>
                {/* RouteProgressProvider désactivé - SmartTopLoader gère maintenant les navigations */}
                <RouteProgressProvider 
                  enableGlobalCapture={false}
                  showDelay={80}
                  className="z-[9999]"
                >
                  <UploadReviewModalProvider>
                    {/* Compagnon IA Provider */}
                    <CompanionProvider>
                      <AppShell>{children}</AppShell>
                      <UnifiedUploadReviewModal />
                      {/* Compagnon IA - Bouton flottant + panneau */}
                      <CompanionDock />
                    </CompanionProvider>
                  </UploadReviewModalProvider>
                </RouteProgressProvider>
              </TooltipProvider>
              </AlertProvider>
            </LoadingProvider>
          </QueryProvider>
          {/* SMARTIMMO: Toast System v2 - Monté en dehors des providers pour éviter les conflits */}
          <ToastProvider />
        </ThemeProvider>
        {/* Enregistrement du Service Worker PWA (uniquement en production, côté client) */}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
