/** Payload JSON exposé par `/version.json` et version « boot » (bundle client). */
export type AppVersionPayload = {
  /** Hash Git complet si disponible */
  commit: string;
  /** ISO build time */
  buildTime: string;
  /** production | preview | development | … */
  deployEnv: string;
};
