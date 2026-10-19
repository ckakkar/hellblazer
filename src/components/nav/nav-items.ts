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

export type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * Desktop sidebar, in groups: home, planning, looking back. Logging isn't a
 * row here: the sidebar's start button (or the workout under way) is it, and
 * Profile is the lifter's own card at the foot.
 */
export const NAV_SECTIONS: NavItem[][] = [
  [{ href: "/dashboard", label: "Home", icon: LayoutDashboard }],
  [
    { href: "/programs", label: "Programs", icon: CalendarRange },
    { href: "/templates", label: "Templates", icon: ClipboardList },
    { href: "/exercises", label: "Exercises", icon: Dumbbell },
  ],
  [
    { href: "/progress", label: "Progress", icon: TrendingUp },
    { href: "/history", label: "History", icon: History },
    { href: "/leaderboard", label: "King of the Hill", icon: Trophy },
  ],
];

/** Mobile bottom tab bar: the five most-used destinations. */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/programs", label: "Programs", icon: CalendarRange },
  { href: "/log", label: "Log", icon: PlusCircle },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/settings", label: "Profile", icon: User },
];

/**
 * The iPad app's tab bar, for a window too narrow for the sidebar (Split
 * View, Slide Over). Workouts aren't run on an iPad, so History takes the
 * place of Log.
 */
export const IPAD_BOTTOM_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/programs", label: "Programs", icon: CalendarRange },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Profile", icon: User },
];

/** Mobile top-bar overflow (secondary destinations). */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/leaderboard", label: "King of the Hill", icon: Trophy },
  { href: "/templates", label: "Templates", icon: ClipboardList },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/history", label: "History", icon: History },
];
