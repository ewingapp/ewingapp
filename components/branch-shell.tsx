"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/branch", label: "Home" },
  { href: "/branch/new-appointment", label: "New Appointment" },
  { href: "/branch/existing-appointments", label: "Existing Appointments" },
  { href: "/branch/vendor-info", label: "Vendor Info" },
  { href: "/branch/support", label: "Support" },
];

export type Branch = { id: string; name: string };

export function BranchShell({
  actingBranch,
  children,
}: {
  // `branches` was used by the legacy picker. Kept in the prop list as
  // optional so existing call sites (SmartShell) compile while we rip it
  // out. Real session is the source of truth now.
  branches?: Branch[];
  actingBranch: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function logout() {
    setError(null);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      startTransition(() => router.push("/branch/login"));
    } catch {
      // Falls through; cookie clear and redirect are best-effort.
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-0 flex items-center justify-between">
          <Link href="/branch" className="block">
            <Image
              src="/ewing-logo.png"
              alt="Ewing Medical & Psychological Services"
              width={1181}
              height={335}
              priority
              className="h-20 w-auto"
            />
          </Link>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-white text-sm text-slate-700"
              style={{ border: "1.5px solid #CBD5E1" }}
            >
              <Building2 className="size-4" style={{ color: "#06B6D4" }} />
              <span className="text-slate-500 hidden sm:inline">Branch:</span>
              <span className="font-medium text-slate-900">
                {actingBranch ?? "All branches"}
              </span>
            </span>
            <button
              type="button"
              onClick={logout}
              disabled={pending}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ border: "1.5px solid #CBD5E1" }}
            >
              <LogOut className="size-4" />
              Logout
            </button>
          </div>
        </div>

        <nav
          style={{
            background: "#F8FAFC",
            borderTop: "2px solid #06B6D4",
            borderBottom: "2px solid #06B6D4",
          }}
        >
          <div className="max-w-7xl mx-auto px-6 flex items-center gap-2 sm:gap-4 overflow-x-auto">
            {NAV.map((item) => {
              const isActive =
                item.href === "/branch"
                  ? pathname === "/branch"
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

      {error && (
        <div className="max-w-7xl mx-auto px-6 py-2 w-full">
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">
            {error}
          </p>
        </div>
      )}

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

export function BranchPageHeader({
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
