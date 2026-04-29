'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  loadPatrimoineUserSettings,
  replacePatrimoineUserSettings,
  savePatrimoineUserSettings,
  type PatrimoineUserSettings,
} from '@/features/patrimoine/store/patrimoineSettings';

/**
 * État React des paramètres cockpit patrimoine (localStorage).
 */
export function usePatrimoineSettingsState(organizationId: string | undefined) {
  const [revision, setRevision] = useState(0);

  const settings = useMemo(() => {
    void revision;
    return loadPatrimoineUserSettings(organizationId);
  }, [organizationId, revision]);

  const updateSettings = useCallback(
    (patch: Partial<PatrimoineUserSettings>) => {
      if (!organizationId) return;
      savePatrimoineUserSettings(organizationId, patch);
      setRevision((r) => r + 1);
    },
    [organizationId]
  );

  const replaceSettings = useCallback(
    (next: PatrimoineUserSettings) => {
      if (!organizationId) return;
      replacePatrimoineUserSettings(organizationId, next);
      setRevision((r) => r + 1);
    },
    [organizationId]
  );

  return { settings, updateSettings, replaceSettings };
}
