import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { prisma } from "@/lib/db";
import { ptFmtDateLong, ptFmtTime } from "@/lib/pt";

type Params = Promise<{ id: string }>;

export default async function AppointmentDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: {
      doctor: { select: { name: true } },
      specialty: { select: { name: true } },
      location: { select: { name: true } },
    },
  });
  if (!a) notFound();

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link
          href="/appointments"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to Scheduled Appointments
        </Link>
        <PageHeader title="Appointment Details" />

        <div
          className="rounded-lg p-5 mb-6 bg-emerald-50/40"
          style={{ border: "2px solid #C9A55C" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-2 text-sm text-slate-700">
            <Field label="Date" value={ptFmtDateLong(a.startTime)} />
            <Field label="Time" value={ptFmtTime(a.startTime)} />
            <Field label="Office" value={a.location.name} />
            <Field label="Doctor" value={a.doctor.name} />
            <Field label="Branch" value={a.stateBranch} />
            <Field label="Scheduled By" value={a.scheduledBy} />
            <Field
              label="Appt Made"
              value={ptFmtDateLong(a.createdAt)}
            />
            <Field label="Status" value={a.status.replace("_", " ")} />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden mb-6">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
            Claimant Information
          </div>
          <dl className="divide-y divide-slate-100 text-sm">
            <Row label="First Name" value={a.firstInitial} />
            <Row label="Last Name" value={a.lastNamePrefix} />
            <Row label="Exam Type" value={a.specialty.name} />
            <Row label="Case Number" value={a.caseNumber} />
            <Row label="Contract Number" value={a.contractNumber || "—"} />
            <Row
              label="DDS Scheduler"
              value={`${a.schedulerName}${a.schedulerExt ? ` (ext ${a.schedulerExt})` : ""}`}
            />
            <Row label="Scheduler Phone" value={formatPhone(a.schedulerPhone)} />
            <Row
              label="DDS Analyst"
              value={`${a.analystName}${a.analystExt ? ` (ext ${a.analystExt})` : ""}`}
            />
            <Row label="Analyst Phone" value={formatPhone(a.analystPhone)} />
            <Row label="Interpreter?" value={a.hasInterpreter} />
            <Row label="OHA/DHU Case" value={a.isOdarCase} />
            <Row
              label="Claimant Phone#"
              value={a.claimantPhone ? formatPhone(a.claimantPhone) : "—"}
            />
          </dl>
        </div>

        {(a.notes || a.statusNote) && (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800">
              Comments
            </div>
            <div className="p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {a.notes && <p>{a.notes}</p>}
              {a.statusNote && (
                <p className="mt-2">
                  <span className="font-medium">Status note:</span> {a.statusNote}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-medium text-slate-900">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4 py-2">
      <dt className="font-medium text-slate-600">{label}</dt>
      <dd className="col-span-2 text-slate-900">{value}</dd>
    </div>
  );
}

function formatPhone(d: string) {
  const digits = d.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return d;
}
