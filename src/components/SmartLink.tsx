'use client';

import React, { forwardRef, useCallback, useRef, useState } from 'react';
import Link, { LinkProps } from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/utils/cn';
import { useViewTransitionNav } from '@/hooks/useViewTransitionNav';
import { useQuickNavigationFeedback } from '@/hooks/useImmediateRouteProgress';

interface SmartLinkProps extends Omit<LinkProps, 'href'> {
  href: string;
  children: React.ReactNode;
  className?: string;
  
  // Options de préchargement
  prefetch?: boolean;
  prefetchDelay?: number; // Délai avant prefetch au hover (défaut: 80ms)
  
  // Options de transition
  enableTransition?: boolean;
  transitionName?: string;
  
  // Options de feedback
  enableFeedback?: boolean;
  enableVibration?: boolean;
  
  // Styles de micro-interactions
  enableMicroInteractions?: boolean;
  scaleOnActive?: number; // Scale au touch (défaut: 0.98)
  
  // Props HTML standard
  [key: string]: any;
}

export const SmartLink = forwardRef<HTMLAnchorElement, SmartLinkProps>(
  ({
    href,
    children,
    className,
    prefetch = true,
    prefetchDelay = 80,
    enableTransition = true,
    transitionName,
    enableFeedback = true,
    enableVibration = true,
    enableMicroInteractions = true,
    scaleOnActive = 0.98,
    onClick,
    onPointerEnter,
    onPointerDown,
    ...props
  }, ref) => {
    const router = useRouter();
    const { navigate } = useViewTransitionNav({
      enableTransition,
      transitionName
    });
    const { isNavigating, onNavigationStart } = useQuickNavigationFeedback();
    
    const [isPrefetched, setIsPrefetched] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    
    const prefetchTimeoutRef = useRef<NodeJS.Timeout>();
    const prefetchedRef = useRef(false);

    // Préchargement intelligent au hover
    const handlePointerEnter = useCallback((e: React.PointerEvent<HTMLAnchorElement>) => {
      setIsHovered(true);
      
      if (prefetch && !prefetchedRef.current) {
        prefetchTimeoutRef.current = setTimeout(async () => {
          try {
            await router.prefetch(href);
            setIsPrefetched(true);
            prefetchedRef.current = true;
          } catch (error) {
            console.warn('Prefetch failed:', error);
          }
        }, prefetchDelay);
      }
      
      onPointerEnter?.(e);
    }, [prefetch, href, prefetchDelay, router, onPointerEnter]);

    const handlePointerLeave = useCallback(() => {
      setIsHovered(false);
      
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }
    }, []);

    // Feedback immédiat au pointerdown
    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLAnchorElement>) => {
      setIsPressed(true);
      
      // Vibration tactile si activée
      if (enableVibration && 'vibrate' in navigator && window.matchMedia('(pointer: coarse)').matches) {
        try {
          navigator.vibrate(10);
        } catch (error) {
          // Ignore silently
        }
      }
      
      // Feedback de navigation immédiat
      if (enableFeedback) {
        onNavigationStart(e);
      }
      
      onPointerDown?.(e);
    }, [enableVibration, enableFeedback, onNavigationStart, onPointerDown]);

    const handlePointerUp = useCallback(() => {
      setIsPressed(false);
    }, []);

    // Navigation avec transition
    const handleClick = useCallback(async (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Laisser le comportement par défaut si modificateurs
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        onClick?.(e);
        return;
      }

      // Empêcher la navigation par défaut
      e.preventDefault();
      
      try {
        // Utiliser la navigation avec transition
        await navigate(href);
      } catch (error) {
        console.warn('Navigation failed, falling back:', error);
        // Fallback vers navigation Next.js standard
        router.push(href);
      }
      
      onClick?.(e);
    }, [navigate, href, router, onClick]);

    // Classes dynamiques pour micro-interactions
    const linkClasses = cn(
      'inline-block transition-transform duration-75 ease-out',
      
      // Micro-interactions si activées
      enableMicroInteractions && {
        'hover:scale-[1.02] motion-reduce:hover:scale-100': !isPressed,
        'active:scale-95 motion-reduce:active:scale-100': true,
      },
      
      // État de navigation
      isNavigating && 'opacity-80',
      
      // État préchargé (optionnel, pour debug)
      isPrefetched && 'data-prefetched',
      
      className
    );

    // Style inline pour scale personnalisé
    const inlineStyle = enableMicroInteractions && isPressed ? {
      transform: `scale(${scaleOnActive})`,
      ...props.style
    } : props.style;

    return (
      <Link
        href={href}
        ref={ref}
        className={linkClasses}
        style={inlineStyle}
        data-navigation // Marqueur pour le RouteProgressProvider
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        {...props}
      >
        {children}
      </Link>
    );
  }
);

SmartLink.displayName = 'SmartLink';

// Composants spécialisés pour différents contextes

/**
 * Lien pour navigation principale (sidebar, header)
 */
export const NavLink = forwardRef<HTMLAnchorElement, SmartLinkProps>(
  (props, ref) => (
    <SmartLink
      ref={ref}
      prefetchDelay={100}
      transitionName="nav-transition"
      enableMicroInteractions={false} // Plus subtil pour navigation
      {...props}
    />
  )
);
NavLink.displayName = 'NavLink';

/**
 * Lien pour cartes/tuiles cliquables
 */
export const CardLink = forwardRef<HTMLAnchorElement, SmartLinkProps>(
  (props, ref) => (
    <SmartLink
      ref={ref}
      prefetchDelay={50} // Plus rapide pour cartes
      transitionName="card-transition"
      scaleOnActive={0.96} // Plus marqué
      {...props}
    />
  )
);
CardLink.displayName = 'CardLink';

/**
 * Lien pour éléments de liste
 */
export const ListLink = forwardRef<HTMLAnchorElement, SmartLinkProps>(
  (props, ref) => (
    <SmartLink
      ref={ref}
      prefetchDelay={120}
      transitionName="list-item-transition"
      enableMicroInteractions={false} // Éviter les effets sur les listes
      {...props}
    />
  )
);
ListLink.displayName = 'ListLink';

/**
 * Lien pour boutons d'action
 */
export const ActionLink = forwardRef<HTMLAnchorElement, SmartLinkProps>(
  (props, ref) => (
    <SmartLink
      ref={ref}
      prefetch={false} // Pas de prefetch pour les actions
      enableVibration={true}
      scaleOnActive={0.95}
      {...props}
    />
  )
);
ActionLink.displayName = 'ActionLink';
