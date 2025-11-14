'use client';

import { useState } from 'react';

type Offset = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function useCursorOffset() {
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    setOffset({ x: clamp(x, -1, 1), y: clamp(y, -1, 1) });
  }

  function handleLeave() {
    setOffset({ x: 0, y: 0 });
  }

  return { offset, handleMove, handleLeave };
}

type CharacterProps = {
  height: number;
  width: number;
  color: string;
  offsetMultiplier: number;
  eyePosition: 'left' | 'right' | 'center';
  eyebrow?: boolean;
  offset: Offset;
};

function Character({
  height,
  width,
  color,
  offsetMultiplier,
  eyePosition,
  eyebrow,
  offset,
}: CharacterProps) {
  const eyeOffsetX = offset.x * 4;
  const eyeOffsetY = offset.y * 3;
  const translatedStyle = {
    transform: `translate(${offset.x * offsetMultiplier}px, ${offset.y * offsetMultiplier}px)`,
  };

  return (
    <div
      className="relative rounded-t-[32px]"
      style={{
        height,
        width,
        backgroundColor: color,
        ...translatedStyle,
      }}
    >
      <div
        className="absolute top-[18%] flex items-center gap-2"
        style={{
          left:
            eyePosition === 'left'
              ? '20%'
              : eyePosition === 'right'
              ? '60%'
              : '35%',
        }}
      >
        <div className="relative h-6 w-6 rounded-full bg-white">
          <div
            className="absolute h-3 w-3 rounded-full bg-gray-900"
            style={{
              top: `calc(50% - 6px + ${eyeOffsetY}px)`,
              left: `calc(50% - 6px + ${eyeOffsetX}px)`,
            }}
          />
        </div>
        <div className="relative h-5 w-5 rounded-full bg-white">
          <div
            className="absolute h-2.5 w-2.5 rounded-full bg-gray-900"
            style={{
              top: `calc(50% - 5px + ${eyeOffsetY}px)`,
              left: `calc(50% - 5px + ${eyeOffsetX}px)`,
            }}
          />
        </div>
      </div>

      {eyebrow && (
        <div
          className="absolute h-1 w-10 rounded-full bg-gray-900/70"
          style={{
            top: '12%',
            left: '38%',
            transform: `rotate(${offset.x * 5}deg)`,
          }}
        />
      )}

      <div
        className="absolute bottom-[20%] left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-gray-900/70"
        style={{
          transform: `translate(-50%, ${offset.y * 6}px)`,
        }}
      />
    </div>
  );
}

export function MascotPanel() {
  const { offset, handleMove, handleLeave } = useCursorOffset();

  return (
    <div
      className="relative hidden overflow-hidden rounded-[32px] bg-gradient-to-br from-[#FFF4DE] via-[#FFE3FC] to-[#E0E7FF] p-10 text-gray-900 lg:flex"
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <div className="flex flex-col justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
            Bienvenue sur SmartImmo
          </p>
          <h2 className="mt-3 text-3xl font-bold text-gray-900">
            Administrez votre patrimoine
          </h2>
          <p className="mt-2 max-w-sm text-base text-gray-600">
            Toutes vos opérations sont synchronisées avec Supabase et sécurisées
            par notre middleware. Connectez-vous pour retrouver vos derniers
            tableaux de bord.
          </p>
        </div>

        <div className="mt-8 flex items-end gap-6">
          <Character
            height={220}
            width={130}
            color="#F97316"
            offsetMultiplier={6}
            eyePosition="left"
            offset={offset}
          />
          <Character
            height={260}
            width={120}
            color="#8B5CF6"
            offsetMultiplier={4}
            eyePosition="center"
            eyebrow
            offset={offset}
          />
          <Character
            height={190}
            width={110}
            color="#111827"
            offsetMultiplier={3}
            eyePosition="right"
            offset={offset}
          />
          <Character
            height={160}
            width={110}
            color="#FACC15"
            offsetMultiplier={5}
            eyePosition="left"
            offset={offset}
          />
        </div>
      </div>

      <div
        className="pointer-events-none absolute -right-10 bottom-16 h-32 w-32 rounded-full bg-white/60 blur-3xl"
        style={{
          transform: `translate(${offset.x * 40}px, ${offset.y * 30}px)`,
        }}
      />
    </div>
  );
}

