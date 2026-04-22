export interface ScrollToAnchorByIdOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  expandAncestors?: boolean;
}

function openCollapsibleAncestors(target: HTMLElement) {
  let current: HTMLElement | null = target.parentElement;
  while (current) {
    if (current instanceof HTMLDetailsElement && !current.open) {
      current.open = true;
    }

    if (current.getAttribute('data-state') === 'closed') {
      const trigger = current.querySelector<HTMLElement>('[aria-expanded="false"]');
      trigger?.click();
    }

    current = current.parentElement;
  }
}

export function scrollToAnchorById(
  anchorId: string,
  options: ScrollToAnchorByIdOptions = {}
): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const element = document.getElementById(anchorId);
  if (!element) return null;

  if (options.expandAncestors ?? true) {
    openCollapsibleAncestors(element);
  }

  requestAnimationFrame(() => {
    element.scrollIntoView({
      behavior: options.behavior ?? 'smooth',
      block: options.block ?? 'start',
    });
  });

  return element;
}
