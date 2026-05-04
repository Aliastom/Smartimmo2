'use client';

import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';
import {
  filterSymbolSearchCandidates,
  formatSymbolSearchLine,
  type SymbolSearchCandidate,
} from '@/features/market/services/marketOrderSymbolSearch';

export interface MarketOrderSymbolComboboxProps {
  id?: string;
  value: string;
  onInputChange: (raw: string) => void;
  onSelectCandidate: (c: SymbolSearchCandidate) => void;
  candidates: SymbolSearchCandidate[];
  disabled?: boolean;
  placeholder?: string;
  'aria-invalid'?: boolean;
  /** Aucun résultat local : proposer une recherche Yahoo (route `/api/market/search`). */
  onRequestOnlineSearch?: () => void;
  onlineSearchLoading?: boolean;
}

/**
 * Champ symbole searchable : catalogue local enrichi, puis résultats en ligne sur action.
 */
export function MarketOrderSymbolCombobox({
  id: idProp,
  value,
  onInputChange,
  onSelectCandidate,
  candidates,
  disabled,
  placeholder = 'Ticker, nom ou ISIN…',
  'aria-invalid': ariaInvalid,
  onRequestOnlineSearch,
  onlineSearchLoading,
}: MarketOrderSymbolComboboxProps) {
  const genId = useId();
  const listboxId = `${genId}-listbox`;
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filterSymbolSearchCandidates(candidates, value),
    [candidates, value],
  );

  const showOnlineRow =
    Boolean(onRequestOnlineSearch) &&
    value.trim().length >= 2 &&
    filtered.length === 0 &&
    !onlineSearchLoading;

  const listItemsCount = filtered.length + (showOnlineRow ? 1 : 0);

  useEffect(() => {
    setHighlighted(0);
  }, [value, filtered.length, showOnlineRow]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [close]);

  const pick = useCallback(
    (c: SymbolSearchCandidate) => {
      onSelectCandidate(c);
      close();
    },
    [onSelectCandidate, close],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && listItemsCount > 0) {
      setOpen(true);
      return;
    }
    if (!open || listItemsCount === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % listItemsCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((i) => (i - 1 + listItemsCount) % listItemsCount);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showOnlineRow && highlighted === filtered.length) {
        onRequestOnlineSearch?.();
        return;
      }
      const c = filtered[highlighted];
      if (c) pick(c);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  const openList = filtered.length > 0 || showOnlineRow || onlineSearchLoading;

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={idProp}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-invalid={ariaInvalid}
        disabled={disabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onInputChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (openList) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {open && openList && (
        <ul
          id={listboxId}
          role="listbox"
          className={cn(
            'absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg',
            'text-sm',
          )}
        >
          {onlineSearchLoading && filtered.length === 0 && (
            <li className="cursor-default px-3 py-2 text-slate-500">Recherche en ligne…</li>
          )}
          {filtered.map((c, idx) => (
            <li
              key={`${c.tier}-${normalizeKey(c.storageSymbol)}-${idx}`}
              role="option"
              aria-selected={idx === highlighted}
              className={cn(
                'cursor-pointer px-3 py-2 text-left',
                idx === highlighted
                  ? 'bg-violet-50 text-violet-950'
                  : 'text-slate-800 hover:bg-slate-50',
              )}
              onMouseEnter={() => setHighlighted(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
            >
              <span className="block truncate">{formatSymbolSearchLine(c)}</span>
            </li>
          ))}
          {showOnlineRow && (
            <li
              role="option"
              aria-selected={highlighted === filtered.length}
              className={cn(
                'cursor-pointer border-t border-slate-100 px-3 py-2 text-left text-xs font-medium',
                highlighted === filtered.length
                  ? 'bg-sky-50 text-sky-950'
                  : 'text-sky-800 hover:bg-sky-50/80',
              )}
              onMouseEnter={() => setHighlighted(filtered.length)}
              onMouseDown={(e) => {
                e.preventDefault();
                onRequestOnlineSearch?.();
              }}
            >
              Rechercher en ligne « {value.trim()} »…
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function normalizeKey(s: string): string {
  return s.replace(/\s+/g, '_');
}
