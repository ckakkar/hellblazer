import {
  LayoutDashboard,
  PlusCircle,
  History,
  TrendingUp,
  ClipboardList,
  Dumbbell,
  User,
  CalendarRange,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; code: string };

/** Grouped sidebar navigation (desktop). */
export const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, code: "01" },
      { href: "/log", label: "Log workout", icon: PlusCircle, code: "02" },
    ],
  },
  {
    title: "Plan",
    items: [
      { href: "/programs", label: "Programs", icon: CalendarRange, code: "03" },
      { href: "/templates", label: "Templates", icon: ClipboardList, code: "04" },
      { href: "/exercises", label: "Exercises", icon: Dumbbell, code: "05" },
    ],
  },
  {
    title: "Analyze",
    items: [
      { href: "/progress", label: "Progress", icon: TrendingUp, code: "06" },
      { href: "/history", label: "History", icon: History, code: "07" },
      { href: "/leaderboard", label: "King of the Hill", icon: Trophy, code: "08" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Profile",
  icon: User,
  code: "09",
};

/** Mobile bottom tab bar: the five most-used destinations. */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, code: "01" },
  { href: "/programs", label: "Programs", icon: CalendarRange, code: "03" },
  { href: "/log", label: "Log", icon: PlusCircle, code: "02" },
  { href: "/progress", label: "Progress", icon: TrendingUp, code: "06" },
  { href: "/settings", label: "Profile", icon: User, code: "09" },
];

/** Mobile top-bar overflow (secondary destinations). */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/leaderboard", label: "King of the Hill", icon: Trophy, code: "08" },
  { href: "/templates", label: "Templates", icon: ClipboardList, code: "04" },
  { href: "/exercises", label: "Exercises", icon: Dumbbell, code: "05" },
  { href: "/history", label: "History", icon: History, code: "07" },
];
