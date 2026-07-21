import {
  LayoutDashboard,
  PlusCircle,
  History,
  TrendingUp,
  ClipboardList,
  Dumbbell,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/log", label: "Log", icon: PlusCircle },
  { href: "/history", label: "History", icon: History },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/templates", label: "Templates", icon: ClipboardList },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/settings", label: "Settings", icon: Settings },
];

const BOTTOM_HREFS = ["/dashboard", "/log", "/history", "/progress", "/templates"];
export const BOTTOM_NAV = NAV_ITEMS.filter((i) => BOTTOM_HREFS.includes(i.href));
export const SECONDARY_NAV = NAV_ITEMS.filter(
  (i) => i.href === "/exercises" || i.href === "/settings",
);
