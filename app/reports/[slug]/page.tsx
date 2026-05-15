import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Construction } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { findReport } from "@/lib/reports";

export default async function ReportStubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const report = findReport(slug);
  if (!report) notFound();

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to Reports
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">
          {report.name}
        </h1>
        <p className="text-sm text-slate-600 mb-6">{report.description}</p>

        <div
          className="rounded-lg p-8 bg-slate-50 text-center"
          style={{ border: "2px solid #CBD5E1" }}
        >
          <Construction className="size-8 mx-auto mb-3 text-slate-400" />
          <p className="font-medium text-slate-800">Coming soon.</p>
          <p className="text-sm text-slate-600 mt-1">
            This report is being built. CSV export will be available here once
            it ships.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
