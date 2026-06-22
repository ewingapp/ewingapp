"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CalendarCheck2, Plus, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/vendor-setup", label: "Vendor Setup" },
  { href: "/appointment-slots", label: "Appointment Slots" },
  { href: "/calendar", label: "Calendar" },
  { href: "/appointments", label: "Scheduled Appointments" },
  { href: "/schedule", label: "New Appointment" },
  { href: "/reports", label: "Reports" },
  { href: "/faq", label: "FAQ" },
];

export function BrandMark() {
  return (
    <Image
      src="/ewing-logo.png"
      alt="Ewing Medical & Psychological Services"
      width={1181}
      height={335}
      priority
      className="h-20 w-auto"
    />
  );
}

function TodayCounter() {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats/today", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.count === "number") setCount(data.count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-slate-700 bg-white shadow-sm"
      style={{ border: "1.5px solid #CBD5E1" }}
      title="Appointments scheduled for today"
      aria-live="polite"
    >
      <CalendarCheck2 className="size-3.5" style={{ color: "#06B6D4" }} />
      <span className="text-slate-500">Today:</span>
      <span className="font-semibold text-slate-900 tabular-nums">
        {count ?? "—"}
      </span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, startLogout] = useTransition();

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Cookie clear + redirect are best-effort; fall through regardless.
    }
    startLogout(() => router.push("/login"));
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top brand bar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-0 flex items-center justify-between">
          <Link href="/" className="block">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-3">
            <TodayCounter />
            <Link
              href="/schedule"
              className="hidden md:inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-sm font-medium text-white shadow-sm transition hover:brightness-95"
              style={{ background: "#06B6D4", border: "2px solid #06B6D4" }}
            >
              <Plus className="size-4" />
              New Appointment
            </Link>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <span>
                Welcome, <span className="font-medium">User</span>
              </span>
              <span className="grid place-items-center size-7 rounded-full bg-slate-100 ring-1 ring-slate-200">
                <User className="size-4 text-slate-600" />
              </span>
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ border: "1.5px solid #CBD5E1" }}
            >
              <LogOut className="size-4" />
              Logout
            </button>
          </div>
        </div>

        {/* Horizontal nav */}
        <nav
          style={{
            background: "#F8FAFC",
            borderTop: "2px solid #D1D5DB",
            borderBottom: "2px solid #D1D5DB",
          }}
        >
          <div className="max-w-7xl mx-auto px-6 flex items-center gap-2 sm:gap-4 overflow-x-auto">
            {NAV.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-5 py-4 text-[13px] tracking-wide whitespace-nowrap transition",
                    isActive
                      ? "font-semibold text-slate-900"
                      : "font-medium text-slate-500 hover:text-slate-900",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="flex-1 min-w-0 bg-white">{children}</main>

      <footer className="bg-white border-t border-slate-200 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <span>
            © {new Date().getFullYear()} Ewing Diagnostics &amp; Psychological Services, Inc.
          </span>
          <span>All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-6">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      {trailing && <div className="text-sm text-slate-600">{trailing}</div>}
    </div>
  );
}
