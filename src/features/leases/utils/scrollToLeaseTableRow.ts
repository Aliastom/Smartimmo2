/**
 * Fait défiler jusqu’à la ligne de tableau marquée `data-lease-row-id` (bandeau → tableau).
 */
export function scrollToLeaseTableRow(leaseId: string): void {
  if (typeof document === 'undefined') return;
  const safe =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(leaseId)
      : leaseId.replace(/"/g, '\\"');
  requestAnimationFrame(() => {
    document.querySelector(`[data-lease-row-id="${safe}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  });
}
