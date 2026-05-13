"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { addWeeks, startOfDay } from "date-fns";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  ptFmtDateLong,
  ptFmtDateMed,
  ptFmtDateShort,
  ptFmtTime,
} from "@/lib/pt";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  doctor: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    claimantAges: string;
    remarks: string;
  };
};

type Appt = {
  id: string;
  startTime: string;
  caseNumber: string;
  firstInitial: string;
  lastNamePrefix: string;
  stateBranch: string;
  analystName: string;
  analystPhone: string;
  analystExt: string;
  schedulerName: string;
  schedulerPhone: string;
  schedulerExt: string;
  claimantPhone: string;
  contractNumber: string;
  hasInterpreter: string;
  isOdarCase: string;
  notes: string;
  status: string;
  scheduledBy: "BRANCH" | "VENDOR";
  doctor: { name: string; firstName: string; lastName: string };
  specialty: { id: string; name: string };
  location: { id: string; name: string };
};

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Must match the key used by /schedule/results so the carry-over flows the
// same way regardless of which confirmation dialog the user clicked from.
const CLAIMANT_STORAGE_KEY = "ewing-claimant-info";

function formatPhoneDisplay(s: string | undefined, ext?: string): string {
  let base = "—";
  if (s) {
    const d = s.replace(/\D/g, "");
    if (d.length === 10) base = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    else if (d.length === 7) base = `${d.slice(0, 3)}-${d.slice(3)}`;
    else base = s;
  }
  if (ext && ext.trim()) return `${base} ext. ${ext.trim()}`;
  return base;
}

function doctorDisplay(d: { firstName: string; lastName: string }): string {
  return `${d.firstName} ${d.lastName}`.trim();
}

export default function ReschedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [appt, setAppt] = useState<Appt | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState<string>(() =>
    isoDate(startOfDay(new Date())),
  );
  const [toDate, setToDate] = useState<string>(() =>
    isoDate(addWeeks(startOfDay(new Date()), 6)),
  );

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [movingSlotId, setMovingSlotId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<
    | { newAppointment: NewAppointmentSummary; original: Appt }
    | null
  >(null);

  // Load original appointment
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/appointments/${id}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 404 ? "Appointment not found" : "Failed to load",
          );
        }
        return r.json() as Promise<Appt>;
      })
      .then((a) => {
        if (cancelled) return;
        setAppt(a);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load available slots (same office + specialty as original) when range changes
  useEffect(() => {
    if (!appt || !fromDate || !toDate) return;
    if (fromDate > toDate) {
      setSlotsError("From date must be before To date.");
      return;
    }
    const ctrl = new AbortController();
    setSlotsLoading(true);
    setSlotsError(null);
    fetch(
      `/api/slots?locationId=${appt.location.id}&specialtyId=${appt.specialty.id}&from=${fromDate}&to=${toDate}`,
      { signal: ctrl.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error(`Search failed (${r.status})`);
        return r.json() as Promise<Slot[]>;
      })
      .then((s) => setSlots(s))
      .catch((e) => {
        if (e?.name !== "AbortError") {
          setSlotsError(e instanceof Error ? e.message : "Failed to load slots");
        }
      })
      .finally(() => setSlotsLoading(false));
    return () => ctrl.abort();
  }, [appt, fromDate, toDate]);

  async function moveTo(slot: Slot) {
    if (!appt) return;
    setMovingSlotId(slot.id);
    setMoveError(null);
    try {
      const res = await fetch(`/api/appointments/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: slot.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to move");
      }
      const data = (await res.json()) as { newAppointment: NewAppointmentSummary };
      setConfirmation({ newAppointment: data.newAppointment, original: appt });
      // Remove the booked slot from the local list so it can't be picked again.
      setSlots((curr) => (curr ? curr.filter((s) => s.id !== slot.id) : curr));
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : "Failed to move");
    } finally {
      setMovingSlotId(null);
    }
  }

  const terminal =
    appt?.status === "CANCELLED" || appt?.status === "MOVED";

  function handleScheduleSameClaimant() {
    if (confirmation) {
      const na = confirmation.newAppointment;
      const carry = {
        caseNumber: na.caseNumber,
        firstInitial: na.firstInitial,
        lastNamePrefix: na.lastNamePrefix,
        stateBranch: na.stateBranch,
        analystName: na.analystName,
        analystPhone: na.analystPhone,
        analystExt: na.analystExt,
        schedulerName: na.schedulerName,
        schedulerPhone: na.schedulerPhone,
        schedulerExt: na.schedulerExt,
        claimantPhone: na.claimantPhone,
        contractNumber: na.contractNumber,
        hasInterpreter: na.hasInterpreter === "yes" ? "yes" : "no",
        isOdarCase: na.isOdarCase === "yes" ? "yes" : "no",
        notes: na.notes,
      };
      window.sessionStorage.setItem(CLAIMANT_STORAGE_KEY, JSON.stringify(carry));
    }
    setConfirmation(null);
    router.push("/schedule");
  }

  function handleSaveAnalystInfo() {
    if (confirmation) {
      const na = confirmation.newAppointment;
      const analystOnly = {
        stateBranch: na.stateBranch,
        analystName: na.analystName,
        analystPhone: na.analystPhone,
        analystExt: na.analystExt,
        schedulerName: na.schedulerName,
        schedulerPhone: na.schedulerPhone,
        schedulerExt: na.schedulerExt,
      };
      window.sessionStorage.setItem(
        CLAIMANT_STORAGE_KEY,
        JSON.stringify(analystOnly),
      );
    }
    setConfirmation(null);
    router.push("/schedule");
  }

  function handleScheduleNewAppointment() {
    window.sessionStorage.removeItem(CLAIMANT_STORAGE_KEY);
    setConfirmation(null);
    router.push("/schedule");
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Link
          href={`/appointments/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to appointment
        </Link>
        <PageHeader title="Reschedule Appointment" />

        {loadError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 mb-4">
            {loadError}
          </div>
        )}

        {!appt && !loadError && (
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        )}

        {appt && (
          <>
            {/* Current appointment summary — compact horizontal bar */}
            <div
              className="rounded-lg p-4 mb-6 bg-slate-50 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
              style={{ border: "2px solid #C9A55C" }}
            >
              <SummaryItem
                label="Claimant"
                value={`${appt.lastNamePrefix}, ${appt.firstInitial}`}
              />
              <SummaryItem label="Case #" value={appt.caseNumber} />
              <SummaryItem
                label="Current"
                value={`${ptFmtDateShort(appt.startTime)} · ${ptFmtTime(appt.startTime)}`}
              />
              <SummaryItem label="Office" value={appt.location.name} />
              <SummaryItem label="Doctor" value={doctorDisplay(appt.doctor)} />
              <SummaryItem label="Exam" value={appt.specialty.name} />
              <SummaryItem label="Branch" value={appt.stateBranch} />
            </div>

            {terminal && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-4">
                This appointment is {appt.status.toLowerCase()} and cannot be moved.
              </div>
            )}

            {!terminal && (
              <>
                {/* Date range filters */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end mb-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label
                      htmlFor="resched-from"
                      className="text-xs uppercase tracking-wide text-slate-500"
                    >
                      From Date
                    </Label>
                    <Input
                      id="resched-from"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-10 bg-white"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label
                      htmlFor="resched-to"
                      className="text-xs uppercase tracking-wide text-slate-500"
                    >
                      To Date
                    </Label>
                    <Input
                      id="resched-to"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-10 bg-white"
                    />
                  </div>
                </div>

                {moveError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 mb-3">
                    {moveError}
                  </div>
                )}

                <SlotsTable
                  slots={slots}
                  loading={slotsLoading}
                  error={slotsError}
                  movingSlotId={movingSlotId}
                  onMove={moveTo}
                  office={appt.location.name}
                  specialty={appt.specialty.name}
                />
              </>
            )}
          </>
        )}

        <ConfirmationDialog
          open={confirmation !== null}
          confirmation={confirmation}
          onClose={() => setConfirmation(null)}
          onScheduleSameClaimant={handleScheduleSameClaimant}
          onSaveAnalystInfo={handleSaveAnalystInfo}
          onScheduleNewAppointment={handleScheduleNewAppointment}
        />
      </div>
    </AppShell>
  );
}

type NewAppointmentSummary = {
  id: string;
  startTime: string;
  endTime: string;
  caseNumber: string;
  firstInitial: string;
  lastNamePrefix: string;
  stateBranch: string;
  analystName: string;
  analystPhone: string;
  analystExt: string;
  schedulerName: string;
  schedulerPhone: string;
  schedulerExt: string;
  claimantPhone: string;
  contractNumber: string;
  hasInterpreter: string;
  isOdarCase: string;
  notes: string;
  scheduledBy: "BRANCH" | "VENDOR";
  doctor: { id: string; name: string; firstName: string; lastName: string };
  specialty: { id: string; name: string };
  location: { id: string; name: string };
};

function SlotsTable({
  slots,
  loading,
  error,
  movingSlotId,
  onMove,
  office,
  specialty,
}: {
  slots: Slot[] | null;
  loading: boolean;
  error: string | null;
  movingSlotId: string | null;
  onMove: (slot: Slot) => void;
  office: string;
  specialty: string;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="font-medium text-slate-900">
          {loading
            ? "Loading…"
            : `${slots?.length ?? 0} available slot${slots?.length === 1 ? "" : "s"}`}
          <span className="ml-2 text-sm font-normal text-slate-500">
            · {office} · {specialty}
          </span>
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="size-5 animate-spin mr-2" />
          Loading slots…
        </div>
      ) : !slots || slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500">
          <p>No available slots in this date range.</p>
          <p className="text-xs mt-2">Try widening the From / To range above.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm w-full">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
              <tr className="border-b">
                <th className="px-3 py-2 font-medium whitespace-nowrap">Date</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Time</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Doctor</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap text-center">
                  Claimant Ages
                </th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Remarks</th>
                <th className="px-3 py-2 font-medium text-right whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => {
                const moving = movingSlotId === s.id;
                return (
                  <tr
                    key={s.id}
                    className="border-b last:border-0 even:bg-slate-50/50"
                  >
                    <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap tabular-nums">
                      {ptFmtDateShort(s.startTime)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-700 whitespace-nowrap">
                      {ptFmtTime(s.startTime)}
                    </td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                      {doctorDisplay(s.doctor)}
                    </td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-center">
                      {s.doctor.claimantAges?.trim() || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {s.doctor.remarks?.trim() ?? ""}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onMove(s)}
                        disabled={moving || movingSlotId !== null}
                        style={{ borderColor: "#C9A55C", borderWidth: "1.5px" }}
                      >
                        {moving && <Loader2 className="size-3 animate-spin mr-1" />}
                        Move Appointment Here
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConfirmationDialog({
  open,
  confirmation,
  onClose,
  onScheduleSameClaimant,
  onSaveAnalystInfo,
  onScheduleNewAppointment,
}: {
  open: boolean;
  confirmation:
    | { newAppointment: NewAppointmentSummary; original: Appt }
    | null;
  onClose: () => void;
  onScheduleSameClaimant: () => void;
  onSaveAnalystInfo: () => void;
  onScheduleNewAppointment: () => void;
}) {
  if (!confirmation) return null;
  const { newAppointment: na, original } = confirmation;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-full">
        <div className="ewing-print-area">
          {/* Vendor header */}
          <div className="text-center pb-4 border-b border-slate-200 mb-5">
            <Image
              src="/ewing-logo.png"
              alt="Ewing Diagnostics & Psychological Services"
              width={1181}
              height={335}
              className="h-20 w-auto mx-auto"
            />
            <div className="mt-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Appointment Confirmation
              </h2>
              <div className="text-xs text-slate-500 mt-0.5">
                Issued {ptFmtDateMed(new Date())} at {ptFmtTime(new Date())}
              </div>
              <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 ring-1 ring-amber-200">
                Moved from{" "}
                {ptFmtDateLong(original.startTime)} at {ptFmtTime(original.startTime)}
              </div>
            </div>
          </div>

          <SectionHdr title="Appointment">
            <DetailRow label="Date" value={ptFmtDateLong(na.startTime)} />
            <DetailRow label="Time" value={ptFmtTime(na.startTime)} />
            <DetailRow label="Doctor" value={doctorDisplay(na.doctor)} />
            <DetailRow label="Office" value={na.location.name} />
            <DetailRow label="Specialty" value={na.specialty.name} />
          </SectionHdr>

          <SectionHdr title="Claimant">
            <DetailRow label="Case number" value={na.caseNumber} />
            <DetailRow
              label="Identifier"
              value={`${na.firstInitial.toUpperCase()}. ${na.lastNamePrefix.toUpperCase()}`}
            />
            <DetailRow
              label="Claimant phone"
              value={formatPhoneDisplay(na.claimantPhone)}
            />
            <DetailRow
              label="Contract number"
              value={na.contractNumber || "—"}
            />
            <DetailRow
              label="Interpreter"
              value={na.hasInterpreter === "yes" ? "Yes" : "No"}
            />
            <DetailRow
              label="ODAR case"
              value={na.isOdarCase === "yes" ? "Yes" : "No"}
            />
          </SectionHdr>

          <SectionHdr title="State">
            <DetailRow label="Branch" value={na.stateBranch} />
            <DetailRow label="Analyst" value={na.analystName} />
            <DetailRow
              label="Analyst phone"
              value={formatPhoneDisplay(na.analystPhone, na.analystExt)}
            />
          </SectionHdr>

          <SectionHdr title="Scheduler">
            <DetailRow label="Name" value={na.schedulerName} />
            <DetailRow
              label="Phone"
              value={formatPhoneDisplay(na.schedulerPhone, na.schedulerExt)}
            />
          </SectionHdr>

          {na.notes && (
            <div className="mb-4">
              <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-1 mb-2">
                Notes
              </h3>
              <p className="text-sm whitespace-pre-wrap text-slate-800">
                {na.notes}
              </p>
            </div>
          )}
        </div>

        <div className="ewing-print-hide pt-2 border-t border-slate-200">
          {/* Print at the top */}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => window.print()}
              autoFocus
              className="text-white font-medium hover:brightness-95"
              style={{ background: "#DC2626", border: "2px solid #C9A55C" }}
            >
              <Printer className="size-4" />
              Print
            </Button>
          </div>

          {/* Divider + Scheduling Options */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wide mb-3">
              Scheduling Options:
            </h3>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onScheduleSameClaimant}
                style={{
                  borderColor: "#C9A55C",
                  borderWidth: "2px",
                  background: "#FAF6EB",
                }}
                className="self-start font-normal hover:brightness-95"
              >
                Schedule another appointment for the same claimant{" "}
                <span style={{ color: "#DC2626" }}>(will save claimant info)</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onSaveAnalystInfo}
                style={{
                  borderColor: "#C9A55C",
                  borderWidth: "2px",
                  background: "#FAF6EB",
                }}
                className="self-start font-normal hover:brightness-95"
              >
                Save analyst information{" "}
                <span style={{ color: "#DC2626" }}>
                  (will save analyst/scheduler information)
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onScheduleNewAppointment}
                style={{
                  borderColor: "#C9A55C",
                  borderWidth: "2px",
                  background: "#FAF6EB",
                }}
                className="self-start font-normal hover:brightness-95"
              >
                Schedule New Appointment
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                style={{
                  borderColor: "#C9A55C",
                  borderWidth: "2px",
                  background: "#FAF6EB",
                }}
                className="self-start font-normal hover:brightness-95"
              >
                Close page
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Carry-over is saved to this browser tab only — it doesn&apos;t
              follow the shared login to anyone else.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Read({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-medium text-slate-900">{value}</div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function SectionHdr({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-1 mb-2">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="font-medium text-slate-900">{value}</div>
    </div>
  );
}
