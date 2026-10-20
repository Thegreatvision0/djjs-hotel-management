import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import {
  LayoutDashboard, CalendarRange, CalendarDays, Users2, BedDouble, Receipt, Sparkles, UtensilsCrossed,
  ShieldCheck, BarChart3, LogOut, Menu, X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useMeta } from "../api/hooks";
import { ACCESS } from "../lib/access";
import { Avatar, Loading } from "../components/ui";
import Logo from "../components/Logo";
import { ReservationUIProvider } from "../features/reservations/ReservationUI";

const NAV = [
  { group: "Front Office", items: [
    { to: "/", section: "dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/reservations", section: "reservations", label: "Reservations", icon: CalendarRange },
    { to: "/availability", section: "availability", label: "Availability", icon: CalendarDays },
    { to: "/guests", section: "guests", label: "Guests", icon: Users2 },
  ] },
  { group: "Operations", items: [
    { to: "/rooms", section: "rooms", label: "Rooms", icon: BedDouble },
    { to: "/billing", section: "billing", label: "Billing", icon: Receipt },
    { to: "/housekeeping", section: "housekeeping", label: "Housekeeping", icon: Sparkles },
    { to: "/pos", section: "pos", label: "Restaurant POS", icon: UtensilsCrossed },
  ] },
  { group: "Administration", items: [
    { to: "/reports", section: "reports", label: "Reports & Audit", icon: BarChart3 },
    { to: "/users", section: "users", label: "Users", icon: ShieldCheck },
  ] },
];

function Sidebar({ onNavigate, onClose }) {
  const { user, logout } = useAuth();
  const { data: meta } = useMeta();
  return (
    <div className="flex h-full flex-col bg-ink-900 text-slate-300">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <Logo size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[21px] font-semibold leading-none tracking-wide text-white">{meta?.hotel?.name || "DJJS Hotel"}</p>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">{meta?.hotel?.tagline || "Hotel Management"}</p>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="-mr-2 rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"><X className="h-5 w-5" /></button>
        )}
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 scroll-thin">
        {NAV.map((g) => {
          const items = g.items.filter((i) => ACCESS[i.section].includes(user.role));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[.14em] text-slate-500">{g.group}</p>
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate}
                  className={({ isActive }) => clsx("group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition lg:py-2 lg:text-[13.5px]",
                    isActive ? "bg-white/[.07] text-white" : "text-slate-400 hover:bg-white/[.04] hover:text-slate-200")}>
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-gold-400" />}
                      <i.icon className={clsx("h-[18px] w-[18px]", isActive ? "text-gold-400" : "text-slate-500 group-hover:text-slate-300")} />
                      {i.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
            <p className="truncate text-[11px] text-slate-400">{user.role}</p>
          </div>
          <button onClick={logout} title="Sign out" className="rounded-md p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

const PAGE_TITLES = Object.fromEntries(NAV.flatMap((g) => g.items.map((i) => [i.to, i.label])));

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const { user } = useAuth();
  const { data: meta, error } = useMeta();

  // Close the mobile menu on navigation and with Escape.
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open]);

  if (!meta) {
    return <div className="grid h-[100dvh] place-items-center px-4 text-center">{error ? <p className="text-sm text-rose-600">Couldn't reach the server: {error.message}</p> : <Loading label="Loading workspace…" />}</div>;
  }
  return (
    <ReservationUIProvider>
    <div className="flex h-[100dvh] overflow-hidden">
      <aside className="hidden w-[248px] shrink-0 lg:block 2xl:w-[272px]"><Sidebar /></aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 animate-fade-in bg-ink-950/50" onClick={() => setOpen(false)} />
          <div className="relative h-full w-[min(280px,85vw)] animate-pop-in shadow-pop"><Sidebar onClose={() => setOpen(false)} /></div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/95 px-3 py-2.5 backdrop-blur sm:px-5 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="rounded-md p-2 hover:bg-slate-100"><Menu className="h-5 w-5" /></button>
          <Logo size="sm" className="!h-8 !w-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[17px] font-semibold leading-tight">{PAGE_TITLES[loc.pathname] || meta.hotel.name}</p>
            <p className="hidden truncate text-[11px] text-slate-500 sm:block">{meta.hotel.name} · {meta.hotel.tagline}</p>
          </div>
          <Avatar name={user.name} size="sm" />
        </header>
        <main key={loc.pathname} className="flex-1 overflow-y-auto overflow-x-hidden scroll-thin">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 2xl:max-w-[1680px] 2xl:px-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </ReservationUIProvider>
  );
}
