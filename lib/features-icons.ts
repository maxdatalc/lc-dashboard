// Mapa compartilhado nome-do-ícone -> componente lucide-react, para
// renderizar dinamicamente o campo `icone` (string) de FEATURES_CATALOG.

import {
  LayoutDashboard,
  Scale,
  ClipboardList,
  Landmark,
  Package,
  FileText,
  ShoppingCart,
  Users,
  Building2,
  MessageCircle,
  Bell,
  Sparkles,
  UserCheck,
  TrendingUp,
  Zap,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export const FEATURE_ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Scale,
  ClipboardList,
  Landmark,
  Package,
  FileText,
  ShoppingCart,
  Users,
  Building2,
  MessageCircle,
  Bell,
  Sparkles,
  UserCheck,
  TrendingUp,
  Zap,
  BarChart3,
};

/** Ícone do módulo pelo nome salvo em FEATURES_CATALOG; Package como fallback. */
export function getFeatureIcon(iconName: string): LucideIcon {
  return FEATURE_ICON_MAP[iconName] ?? Package;
}
