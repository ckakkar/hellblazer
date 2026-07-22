import {
  LayoutDashboard,
  PlusCircle,
  History,
  TrendingUp,
  ClipboardList,
  Dumbbell,
  User,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Grouped sidebar navigation (desktop). */
export const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/log", label: "Log workout", icon: PlusCircle },
    ],
  },
  {
    title: "Plan",
    items: [
      { href: "/programs", label: "Programs", icon: CalendarRange },
      { href: "/templates", label: "Templates", icon: ClipboardList },
      { href: "/exercises", label: "Exercises", icon: Dumbbell },
    ],
  },
  {
    title: "Analyze",
    items: [
      { href: "/progress", label: "Progress", icon: TrendingUp },
      { href: "/history", label: "History", icon: History },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Profile",
  icon: User,
};

/** Mobile bottom tab bar — the five most-used destinations. */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/programs", label: "Programs", icon: CalendarRange },
  { href: "/log", label: "Log", icon: PlusCircle },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/history", label: "History", icon: History },
];

/** Mobile top-bar overflow (secondary destinations). */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/templates", label: "Templates", icon: ClipboardList },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/settings", label: "Profile", icon: User },
];
