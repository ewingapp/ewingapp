import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { REPORTS } from "@/lib/reports";

export default function ReportsIndexPage() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-6">
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">Reports</h1>
        <p className="text-sm text-slate-600 mb-6">
          Choose a report to view. All reports support CSV export.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {REPORTS.map((r) => (
            <Link
              key={r.slug}
              href={`/reports/${r.slug}`}
              className="block rounded-lg bg-white hover:shadow-sm p-4 transition group"
              style={{ border: "1.5px solid #CBD5E1" }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="grid place-items-center size-9 rounded-full shrink-0"
                  style={{ background: "#F1F5F9" }}
                >
                  <FileText className="size-4 text-slate-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 text-sm">
                      {r.name}
                    </h3>
                    <ArrowRight className="size-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {r.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
