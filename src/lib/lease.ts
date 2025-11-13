/**
 * Helper pour vérifier si un bail est actif
 * Règle unique : un bail est actif si et seulement si son status === "ACTIF"
 */
export const isActive = (lease: { status: string }) => {
  return lease.status === "ACTIF";
};

