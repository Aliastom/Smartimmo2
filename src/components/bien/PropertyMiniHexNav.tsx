'use client';

import Link from 'next/link';
import React from 'react';

interface PropertyMiniHexNavProps {
  propertyId: string;
  currentPage?: 'transactions' | 'documents' | 'photos' | 'baux' | 'rentabilite' | 'prets' | 'parametres';
}

interface HexItem {
  id: string;
  href: string;
  icon: string;
  title: string;
}

export function PropertyMiniHexNav({ propertyId, currentPage }: PropertyMiniHexNavProps) {
  const hexItems: HexItem[] = [
    {
      id: 'transactions',
      href: `/biens/${propertyId}/transactions`,
      icon: 'fa-receipt',
      title: 'Transactions',
    },
    {
      id: 'documents',
      href: `/biens/${propertyId}?tab=documents`,
      icon: 'fa-file-alt',
      title: 'Documents',
    },
    {
      id: 'photos',
      href: `/biens/${propertyId}?tab=photos`,
      icon: 'fa-camera',
      title: 'Photos',
    },
    {
      id: 'baux',
      href: `/biens/${propertyId}/baux`,
      icon: 'fa-file-contract',
      title: 'Baux',
    },
    {
      id: 'rentabilite',
      href: `/biens/${propertyId}?tab=profitability`,
      icon: 'fa-chart-line',
      title: 'Rentabilité',
    },
    {
      id: 'prets',
      href: `/biens/${propertyId}/loans`,
      icon: 'fa-credit-card',
      title: 'Prêts',
    },
    {
      id: 'parametres',
      href: `/biens/${propertyId}?tab=settings`,
      icon: 'fa-cog',
      title: 'Paramètres',
    },
  ];

  console.log('[PropertyMiniHexNav] Rendu avec', hexItems.length, 'hexagones, page active:', currentPage);

  return (
    <div className="hexagon-menu-mini" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {hexItems.map((item) => {
        const isActive = item.id === currentPage;
        return (
              <div 
                key={item.id} 
                className={`hexagon-item-mini hexagon-item-mini-${item.id} ${isActive ? 'hexagon-item-mini-active' : ''}`}
              >
                <div className="hex-item-mini">
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
                <div className="hex-item-mini">
                  <div></div>
                  <div></div>
                  <div></div>
                </div>
                {isActive ? (
                  <div className="hex-content-mini" style={{ cursor: 'default' }}>
                    <span className="hex-content-inner-mini">
                      <span className="icon-mini">
                        <i className={`fa ${item.icon}`}></i>
                      </span>
                      <span className="title-mini">{item.title}</span>
                    </span>
                    <svg
                      viewBox="0 0 173.20508075688772 200"
                      height="100"
                      width="87"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M86.60254037844386 0L173.20508075688772 50L173.20508075688772 150L86.60254037844386 200L0 150L0 50Z"
                        fill="#f9fafb"
                      ></path>
                    </svg>
                  </div>
                ) : (
                  <Link href={item.href} className="hex-content-mini">
                    <span className="hex-content-inner-mini">
                      <span className="icon-mini">
                        <i className={`fa ${item.icon}`}></i>
                      </span>
                      <span className="title-mini">{item.title}</span>
                    </span>
                    <svg
                      viewBox="0 0 173.20508075688772 200"
                      height="100"
                      width="87"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M86.60254037844386 0L173.20508075688772 50L173.20508075688772 150L86.60254037844386 200L0 150L0 50Z"
                        fill="#f9fafb"
                      ></path>
                    </svg>
                  </Link>
                )}
              </div>
        );
      })}
    </div>
  );
}

