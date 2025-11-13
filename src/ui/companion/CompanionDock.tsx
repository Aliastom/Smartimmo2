'use client';

/**
 * CompanionDock - Bouton flottant + panneau latéral (Drawer)
 * Interface principale du compagnon IA
 */

import React from 'react';
import { MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { useCompanion } from './CompanionProvider';
import { CompanionChat } from './CompanionChat';
import { CompanionActions } from './CompanionActions';
import { RobotAvatar } from './RobotAvatar';
import { cn } from '@/lib/utils';
import { aiConfig } from '@/lib/ai/config';

export function CompanionDock() {
  const { isOpen, open, close } = useCompanion();

  // Si l'IA est désactivée, ne rien afficher
  if (!aiConfig.isEnabled()) {
    return null;
  }

  return (
    <>
      {/* Bouton flottant - Robot animé */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0, rotate: -180 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0, rotate: 180 }}
            transition={{ 
              duration: 0.4,
              type: "spring",
              stiffness: 200,
              damping: 15
            }}
            className="fixed bottom-20 right-6 z-50"
          >
            <motion.button
              onClick={open}
              whileHover={{ 
                scale: 1.1,
                rotate: [0, -5, 5, -5, 0],
                transition: { duration: 0.5 }
              }}
              whileTap={{ scale: 0.9 }}
              className={cn(
                'relative h-16 w-16 rounded-full shadow-2xl',
                'bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600',
                'hover:from-blue-600 hover:via-blue-700 hover:to-purple-700',
                'hover:shadow-blue-500/50 hover:shadow-xl',
                'flex items-center justify-center',
                'border-2 border-white/20',
                'transition-all duration-300',
                'cursor-pointer group',
                'overflow-visible'
              )}
              aria-label="Ouvrir le compagnon IA"
            >
              {/* Effet de pulse en arrière-plan */}
              <motion.div
                className="absolute inset-0 rounded-full bg-white/20"
                animate={{
                  scale: [1, 1.4, 1],
                  opacity: [0.3, 0, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              
              {/* Cercle intérieur pour meilleur contraste */}
              <div className="absolute inset-2 rounded-full bg-white/10 backdrop-blur-sm" />
              
              {/* Tête de robot */}
              <RobotAvatar 
                size={42} 
                animated={aiConfig.isAnimated()}
                className="relative z-10 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] group-hover:drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] transition-all"
              />
            </motion.button>

            {/* Badge indicateur avec animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ 
                scale: 1,
                boxShadow: [
                  "0 0 0 0 rgba(16, 185, 129, 0.7)",
                  "0 0 0 10px rgba(16, 185, 129, 0)",
                  "0 0 0 0 rgba(16, 185, 129, 0)"
                ]
              }}
              transition={{
                scale: { duration: 0.3 },
                boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" }
              }}
              className={cn(
                'absolute -top-1 -right-1',
                'h-5 w-5 rounded-full',
                'bg-gradient-to-br from-green-400 to-green-600',
                'border-2 border-background',
                'flex items-center justify-center'
              )}
              title="Compagnon IA disponible"
            >
              <motion.div
                className="h-2 w-2 rounded-full bg-white"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.8, 1, 0.8],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panneau latéral (Drawer) */}
      <Drawer
        isOpen={isOpen}
        onClose={close}
        side="right"
        size="xl"
        closeOnBackdropClick={true}
        closeOnEscape={true}
        noPadding={true}
      >
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div 
                className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-inner"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                <RobotAvatar 
                  size={32} 
                  animated={aiConfig.isAnimated()}
                  className="text-primary"
                />
              </motion.div>
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Compagnon IA
                  <motion.span
                    className="inline-block h-2 w-2 rounded-full bg-green-500"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.7, 1, 0.7],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </h2>
                <p className="text-xs text-muted-foreground">
                  Posez vos questions sur Smartimmo
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              aria-label="Fermer"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Actions contextuelles */}
        <CompanionActions />

        <Separator />

        {/* Chat */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <CompanionChat />
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30">
          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-2">
            <motion.span
              animate={{
                rotate: [0, 360],
              }}
              transition={{
                duration: 20,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              ⚡
            </motion.span>
            Propulsé par Mistral 7B + RAG local + KPI Intelligence
          </p>
        </div>
      </Drawer>
    </>
  );
}

