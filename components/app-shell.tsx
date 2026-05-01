"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, ChevronDown, User } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/vendor-setup", label: "Vendor Setup" },
  { href: "/appointment-slots", label: "Appointment Slots" },
  { href: "/appointments", label: "Scheduled Appointments" },
  { href: "/schedule", label: "New Appointment" },
  { href: "/faq", label: "FAQ" },
];

export function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative size-12">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #4FB3E5 0%, #0085CA 100%)",
            clipPath:
              "polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)",
          }}
        />
        <div className="absolute inset-0 grid place-items-center font-serif italic text-2xl font-bold text-white">
          E
        </div>
      </div>
      <div className="leading-tight">
        <div className="font-bold tracking-wide text-lg" style={{ color: "#0067A0" }}>
          EWING DIAGNOSTICS
        </div>
        <div className="text-[11px] tracking-[0.2em]" style={{ color: "#0085CA" }}>
          &amp; PSYCHOLOGICAL SERVICES
        </div>
        <div className="text-[10px] text-slate-500 tracking-widest mt-0.5">INC.</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top brand bar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="block">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/schedule"
              className="hidden md:inline-flex items-center gap-2 h-9 px-3.5 rounded-md text-sm font-medium text-white shadow-sm transition"
              style={{ background: "#0085CA" }}
            >
              <Plus className="size-4" />
              New Appointment
            </Link>
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
            >
              <span>
                Welcome, <span className="font-medium">User</span>
              </span>
              <span className="grid place-items-center size-7 rounded-full bg-slate-100 ring-1 ring-slate-200">
                <User className="size-4 text-slate-600" />
              </span>
              <ChevronDown className="size-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Horizontal nav */}
        <nav
          style={{
            background: "#F1F5F9",
            borderTop: "2px solid #C9A55C",
            borderBottom: "2px solid #C9A55C",
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
