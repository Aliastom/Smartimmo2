/**
 * SavedSimulationsDropdown — compact pour le header
 * Menu principal via Radix (portail) pour éviter tout chevauchement avec la nav sticky.
 */

'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Folder, ChevronDown, MoreHorizontal, Trash2, Loader2, FolderOpen, Pencil, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SavedSimulation {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  dateCalcul?: string;
}

interface SavedSimulationsDropdownProps {
  simulations: SavedSimulation[];
  currentSaveId?: string | null;
  currentSimulationId?: string | null;
  onOpen?: (id: string) => void;
  onLoad?: (id: string) => void;
  onRename?: (id: string) => Promise<void> | void;
  onDuplicate?: (id: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
}

export function SavedSimulationsDropdown({
  simulations,
  currentSaveId,
  currentSimulationId,
  onOpen,
  onLoad,
  onRename,
  onDuplicate,
  onDelete,
  loading = false,
}: SavedSimulationsDropdownProps) {
  const [mainOpen, setMainOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const effectiveCurrentId = currentSaveId ?? currentSimulationId ?? null;
  const handleOpenCb = onOpen ?? onLoad;
  const handleRenameCb = onRename ?? (() => {});
  const handleDuplicateCb = onDuplicate ?? (() => {});

  const handleOpen = (id: string) => {
    if (!handleOpenCb) return;
    handleOpenCb(id);
    setMainOpen(false);
  };

  const handleRename = (id: string) => {
    handleRenameCb(id);
    setMainOpen(false);
  };

  const handleDuplicate = (id: string) => {
    handleDuplicateCb(id);
    setMainOpen(false);
  };

  const handleDelete = async (id: string, e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  if (simulations.length === 0) {
    return null;
  }

  return (
    <DropdownMenu modal={false} open={mainOpen} onOpenChange={setMainOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-violet-300 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-60"
        >
          <Folder className="h-3.5 w-3.5 text-violet-600" />
          <span className="hidden sm:inline">Sauvegardes</span>
          <Badge variant="secondary" className="ml-0.5 h-4 border-0 bg-violet-600 px-1.5 text-[10px] text-white">
            {simulations.length}
          </Badge>
          <ChevronDown className="h-3 w-3 text-gray-500" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        className={cn(
          'z-[200] w-80 max-w-[90vw] overflow-hidden rounded-xl border border-gray-200 bg-white p-0 shadow-xl sm:max-w-[20rem]',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        )}
      >
        <div className="border-b border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Folder className="h-3.5 w-3.5 text-violet-600" />
            <span className="text-xs font-semibold text-gray-800">Mes simulations</span>
          </div>
        </div>

        <div className="max-h-[280px] overflow-y-auto overflow-x-hidden">
          {simulations.map((sim) => {
            const isActive = sim.id === effectiveCurrentId;
            const dateValue = sim.dateCalcul || sim.createdAt || sim.updatedAt;

            return (
              <DropdownMenuItem
                key={sim.id}
                className="cursor-default rounded-none border-b border-gray-100 p-0 last:border-b-0 focus:bg-transparent data-[highlighted]:bg-transparent"
                onSelect={(e) => e.preventDefault()}
              >
                <div
                  className={cn(
                    'flex w-full min-w-0 items-start justify-between gap-2 px-3 py-2',
                    isActive ? 'bg-violet-50' : 'hover:bg-gray-50',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <h4
                        className={cn(
                          'truncate text-xs font-semibold',
                          isActive ? 'text-violet-900' : 'text-gray-900',
                        )}
                      >
                        {sim.name}
                      </h4>
                      {isActive && (
                        <Badge
                          variant="outline"
                          className="h-4 shrink-0 border-violet-300 bg-violet-100 px-1.5 text-[10px] text-violet-800"
                        >
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-gray-500">{formatDate(dateValue)}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen(sim.id);
                      }}
                      className="rounded p-1 text-violet-600 transition-colors hover:bg-violet-100"
                      title="Ouvrir"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                    </button>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                          title="Actions"
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-[220] w-44" sideOffset={4}>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            handleOpen(sim.id);
                          }}
                        >
                          <FolderOpen className="mr-2 h-3.5 w-3.5" />
                          Ouvrir
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            handleRename(sim.id);
                          }}
                        >
                          <Pencil className="mr-2 h-3.5 w-3.5" />
                          Renommer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            handleDuplicate(sim.id);
                          }}
                        >
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Dupliquer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            void handleDelete(sim.id);
                          }}
                          className="text-red-700 focus:text-red-700"
                          disabled={deletingId === sim.id}
                        >
                          {deletingId === sim.id ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                          )}
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
