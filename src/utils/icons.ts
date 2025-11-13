import { LucideIcon, FileText, Receipt, FileCheck, ClipboardList, ClipboardX, Shield, ReceiptEuro, CreditCard, Image, Folder } from 'lucide-react';

// Mapping des icônes Lucide
const iconMap: Record<string, LucideIcon> = {
  FileText,
  Receipt,
  FileCheck,
  ClipboardList,
  ClipboardX,
  Shield,
  ReceiptEuro,
  CreditCard,
  Image,
  Folder,
};

// Fonction pour obtenir l'icône correspondante
export const getIcon = (iconName?: string): LucideIcon => {
  if (!iconName) return FileText; // Icône par défaut
  return iconMap[iconName] || FileText;
};
