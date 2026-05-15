import { HelpCircle } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";

export default function FaqPage() {
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <PageHeader title="Frequently Asked Questions" />

        <div
          className="rounded-lg p-8 bg-slate-50 text-center"
          style={{ border: "2px solid #CBD5E1" }}
        >
          <HelpCircle className="size-8 mx-auto mb-3 text-slate-400" />
          <p className="font-medium text-slate-800">FAQ content coming soon.</p>
          <p className="text-sm text-slate-600 mt-1">
            This page will collect answers to common scheduling questions for
            State analysts and Ewing staff.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
