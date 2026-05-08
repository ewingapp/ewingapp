import Link from "next/link";
import { ArrowLeft, Wrench } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";

export default async function ReschedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <Link
          href={`/appointments/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to appointment
        </Link>
        <PageHeader title="Reschedule Appointment" />

        <div
          className="rounded-lg p-8 bg-slate-50 text-center"
          style={{ border: "2px solid #C9A55C" }}
        >
          <Wrench className="size-8 mx-auto mb-3 text-slate-400" />
          <p className="font-medium text-slate-800">Reschedule flow coming soon.</p>
          <p className="text-sm text-slate-600 mt-1">
            Will mark the original appointment <code>MOVED</code> and book a new
            slot, carrying claimant info forward.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
