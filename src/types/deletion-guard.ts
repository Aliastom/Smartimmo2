export type HardBlockerItem = {
  type: string;
  label: string;
  count: number;
  hint?: string;
};

export type SoftInfoItem = {
  type: string;
  label: string;
  count: number;
};

export type BlockingPayload = {
  code: string;
  hardBlockers: HardBlockerItem[];
  softInfo: SoftInfoItem[];
  message: string;
};

export type ActionItem = {
  label: string;
  href: string;
  icon: string;
};

export type EntityType = 'property' | 'lease' | 'tenant' | 'loan';

