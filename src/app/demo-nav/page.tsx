'use client';

import React, { useState } from 'react';
import { ReceiptText, FileText, Camera, FileCheck, PieChart, Settings, Sliders } from 'lucide-react';

const tabs = [
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'photos', label: 'Photos', icon: Camera },
  { id: 'baux', label: 'Baux', icon: FileCheck },
  { id: 'rentabilite', label: 'Rentabilité', icon: PieChart },
  { id: 'parametres', label: 'Paramètres', icon: Settings },
  { id: 'a-venir', label: 'À venir', icon: Sliders },
];

// Style 1 : Ligne animée en dessous (Apple style)
function Style1() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const currentIndex = hoveredIndex !== null ? hoveredIndex : activeIndex;

  return (
    <div className="mb-16">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Style 1 : Ligne animée (Apple)</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <nav className="relative flex justify-center gap-8">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = index === activeIndex;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveIndex(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`flex flex-col items-center gap-1 pb-2 transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            );
          })}
          <div
            className="absolute bottom-0 h-0.5 bg-blue-600 transition-all duration-300 ease-out"
            style={{
              left: `${currentIndex * (100 / tabs.length)}%`,
              width: `${100 / tabs.length}%`,
            }}
          />
        </nav>
      </div>
    </div>
  );
}

// Style 2 : Pills colorées
function Style2() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const colors = [
    { base: '#10b981', hover: '#059669', active: '#047857' }, // emerald
    { base: '#f43f5e', hover: '#e11d48', active: '#be123c' }, // rose
    { base: '#0ea5e9', hover: '#0284c7', active: '#0369a1' }, // sky
    { base: '#a855f7', hover: '#9333ea', active: '#7e22ce' }, // purple
    { base: '#f97316', hover: '#ea580c', active: '#c2410c' }, // orange
    { base: '#14b8a6', hover: '#0d9488', active: '#0f766e' }, // teal
    { base: '#f59e0b', hover: '#d97706', active: '#b45309' }, // amber
  ];

  return (
    <div className="mb-16">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Style 2 : Pills colorées</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <nav className="flex justify-center gap-3 flex-wrap">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = index === activeIndex;
            const isHovered = hoveredIndex === index;
            
            // Chaque onglet a SA propre couleur
            const colorList = [
              '#10b981', // emerald - Transactions
              '#f43f5e', // rose - Documents
              '#0ea5e9', // sky - Photos
              '#a855f7', // purple - Baux
              '#f97316', // orange - Rentabilité
              '#14b8a6', // teal - Paramètres
              '#f59e0b', // amber - À venir
            ];
            
            const bgColor = colorList[index % colorList.length];

            return (
              <button
                key={tab.id}
                onClick={() => setActiveIndex(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 1rem',
                  borderRadius: '9999px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: 'white',
                  backgroundColor: bgColor,
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isActive ? '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.3s',
                  border: 'none',
                  cursor: 'pointer',
                  filter: isActive ? 'brightness(0.9)' : isHovered ? 'brightness(1.1)' : 'brightness(1)',
                }}
              >
                <Icon style={{ width: '1rem', height: '1rem' }} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// Style 3 : Morphing blob
function Style3() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const currentIndex = hoveredIndex !== null ? hoveredIndex : activeIndex;

  return (
    <div className="mb-16">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Style 3 : Morphing Blob</h2>
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
        <nav
          className="relative flex justify-center gap-4"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = index === activeIndex;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveIndex(index)}
                onMouseEnter={() => setHoveredIndex(index)}
                className={`relative z-10 flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  isActive || hoveredIndex === index ? 'text-white' : 'text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <div
            className="absolute top-0 h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all duration-500 ease-out shadow-lg"
            style={{
              left: `${currentIndex * (100 / tabs.length)}%`,
              width: `${100 / tabs.length}%`,
              transform: 'scale(0.95)',
            }}
          />
        </nav>
      </div>
    </div>
  );
}

// Style 4 : Néon/Glow
function Style4() {
  const [activeIndex, setActiveIndex] = useState(0);

  const glowColors = [
    'shadow-emerald-500/50 text-emerald-400 border-emerald-500',
    'shadow-rose-500/50 text-rose-400 border-rose-500',
    'shadow-sky-500/50 text-sky-400 border-sky-500',
    'shadow-purple-500/50 text-purple-400 border-purple-500',
    'shadow-orange-500/50 text-orange-400 border-orange-500',
    'shadow-teal-500/50 text-teal-400 border-teal-500',
    'shadow-amber-500/50 text-amber-400 border-amber-500',
  ];

  return (
    <div className="mb-16">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Style 4 : Néon/Glow</h2>
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
        <nav className="flex justify-center gap-4 flex-wrap">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = index === activeIndex;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveIndex(index)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  isActive
                    ? `${glowColors[index]} shadow-lg bg-gray-800`
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// Style 5 : Cartes 3D
function Style5() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="mb-16">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Style 5 : Cartes 3D</h2>
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <nav className="flex justify-center gap-4 flex-wrap">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = index === activeIndex;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveIndex(index)}
                className={`group flex flex-col items-center gap-2 px-6 py-4 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white shadow-xl -translate-y-2 scale-105'
                    : 'bg-white/70 shadow-md hover:shadow-lg hover:-translate-y-1'
                }`}
                style={{
                  transformStyle: 'preserve-3d',
                }}
              >
                <Icon
                  className={`h-6 w-6 transition-colors ${
                    isActive ? 'text-blue-600' : 'text-gray-600 group-hover:text-blue-500'
                  }`}
                />
                <span
                  className={`transition-colors ${
                    isActive ? 'text-blue-600' : 'text-gray-700 group-hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// Style 6 : Skew Menu
function Style6() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const skewDeg = 25;
  const radius = 7;
  const mainColor = '#ff6347'; // tomato

  return (
    <div className="mb-16">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Style 6 : Skew Menu</h2>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <nav style={{ textAlign: 'center', paddingTop: '2em', paddingBottom: '2em' }}>
          <ul
            style={{
              display: 'inline-block',
              margin: 0,
              padding: 0,
              listStyle: 'none',
              transform: `skew(-${skewDeg}deg)`,
            }}
          >
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              const isActive = index === activeIndex;
              const isHovered = hoveredIndex === index;
              const isFirst = index === 0;
              const isLast = index === tabs.length - 1;

              return (
                <li
                  key={tab.id}
                  style={{
                    background: isHovered ? '#eee' : '#fff',
                    float: 'left',
                    borderRight: isLast ? 'none' : '1px solid #eee',
                    boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                    textTransform: 'uppercase',
                    color: isHovered ? mainColor : '#555',
                    fontWeight: 'bold',
                    transition: 'all 0.3s linear',
                    borderRadius: isFirst
                      ? `${radius}px 0 0 ${radius}px`
                      : isLast
                      ? `0 ${radius}px ${radius}px 0`
                      : '0',
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveIndex(index);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '1em 2em',
                      color: 'inherit',
                      textDecoration: 'none',
                      transform: `skew(${skewDeg}deg)`,
                      fontSize: '0.875rem',
                    }}
                  >
                    <Icon style={{ width: '1rem', height: '1rem' }} />
                    <span>{tab.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default function DemoNavPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        /* Forcer les styles inline à fonctionner */
        .demo-nav-page nav[style],
        .demo-nav-page nav *[style],
        .demo-nav-page button[style],
        .demo-nav-page button *[style],
        .demo-nav-page a[style],
        .demo-nav-page a *[style],
        .demo-nav-page ul[style],
        .demo-nav-page ul *[style],
        .demo-nav-page li[style],
        .demo-nav-page li *[style] {
          all: unset;
        }
        
        .demo-nav-page nav[style] { display: var(--display) !important; }
        .demo-nav-page *[style*="background"] { 
          background: revert !important; 
          background-color: revert !important; 
        }
        .demo-nav-page *[style*="color"] { color: revert !important; }
        .demo-nav-page *[style*="display"] { display: revert !important; }
        .demo-nav-page *[style*="padding"] { padding: revert !important; }
        .demo-nav-page *[style*="margin"] { margin: revert !important; }
        .demo-nav-page *[style*="border"] { border: revert !important; }
        .demo-nav-page *[style*="width"] { width: revert !important; }
        .demo-nav-page *[style*="height"] { height: revert !important; }
        .demo-nav-page *[style*="transform"] { transform: revert !important; }
        .demo-nav-page *[style*="transition"] { transition: revert !important; }
        .demo-nav-page *[style*="box-shadow"] { box-shadow: revert !important; }
        .demo-nav-page *[style*="font"] { font: revert !important; font-size: revert !important; font-weight: revert !important; }
        .demo-nav-page *[style*="cursor"] { cursor: revert !important; }
        .demo-nav-page *[style*="flex"] { 
          display: revert !important;
          flex: revert !important; 
          align-items: revert !important;
          justify-content: revert !important;
          gap: revert !important;
        }
      `}} />
      <div className="demo-nav-page min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
          Démo des 6 Styles de Navigation
        </h1>
        <p className="text-gray-600 text-center mb-12">
          Cliquez sur les onglets pour tester l'interaction. Survolez pour voir les animations.
        </p>

        <Style1 />
        <Style2 />
        <Style3 />
        <Style4 />
        <Style5 />
        <Style6 />

        <div className="text-center mt-12">
          <p className="text-sm text-gray-500">
            Choisissez votre style préféré et je l'implémenterai dans votre navigation !
          </p>
        </div>
      </div>
      </div>
    </>
  );
}

