"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addWeeks, format, parseISO, startOfDay } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ptFmtDateLong, ptFmtDateShort, ptFmtTime } from "@/lib/pt";
import { getCaHolidaysRange } from "@/lib/ca-holidays";

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

  const [range, setRange] = useState<DateRange | undefined>(() => {
    const today = startOfDay(new Date());
    return { from: today, to: addWeeks(today, 6) };
  });
  const fromDate = range?.from ? isoDate(range.from) : "";
  const toDate = range?.to ? isoDate(range.to) : "";

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [movingSlotId, setMovingSlotId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<
    | { newAppointment: NewAppointmentSummary; original: Appt }
    | null
  >(null);

  const caHolidays = useMemo(() => getCaHolidaysRange(2), []);

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
            {/* Current appointment summary */}
            <div
              className="rounded-lg p-4 mb-4 bg-slate-50 text-sm"
              style={{ border: "2px solid #C9A55C" }}
            >
              <div className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-2">
                <Read label="Claimant" value={`${appt.lastNamePrefix}, ${appt.firstInitial}`} />
                <Read label="Case #" value={appt.caseNumber} />
                <Read label="Current date" value={ptFmtDateShort(appt.startTime)} />
                <Read label="Current time" value={ptFmtTime(appt.startTime)} />
                <Read label="Office" value={appt.location.name} />
                <Read label="Doctor" value={doctorDisplay(appt.doctor)} />
                <Read label="Exam" value={appt.specialty.name} />
                <Read label="Branch" value={appt.stateBranch} />
              </div>
            </div>

            {terminal && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-4">
                This appointment is {appt.status.toLowerCase()} and cannot be moved.
              </div>
            )}

            {!terminal && (
              <>
                {/* Date range readouts */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end mb-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">
                      From Date
                    </Label>
                    <Input
                      value={range?.from ? format(range.from, "MM/dd/yyyy") : ""}
                      readOnly
                      placeholder="––/––/––––"
                      className="h-10 bg-white"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">
                      To Date
                    </Label>
                    <Input
                      value={range?.to ? format(range.to, "MM/dd/yyyy") : ""}
                      readOnly
                      placeholder="––/––/––––"
                      className="h-10 bg-white"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg border shadow-sm p-4 mb-6 ewing-calendar">
                  <DayPicker
                    mode="range"
                    numberOfMonths={2}
                    selected={range}
                    onSelect={setRange}
                    modifiers={{ holiday: caHolidays }}
                    modifiersClassNames={{ holiday: "rdp-day-holiday" }}
                  />
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
                />
              </>
            )}
          </>
        )}

        <ConfirmationDialog
          open={confirmation !== null}
          confirmation={confirmation}
          onClose={() => {
            setConfirmation(null);
            router.push(`/appointments/${confirmation?.newAppointment.id ?? id}`);
          }}
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
  scheduledBy: "BRANCH" | "VENDOR";
};

function SlotsTable({
  slots,
  loading,
  error,
  movingSlotId,
  onMove,
}: {
  slots: Slot[] | null;
  loading: boolean;
  error: string | null;
  movingSlotId: string | null;
  onMove: (slot: Slot) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        Loading available appointments…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  if (!slots || slots.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No available appointments in this date range.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 text-sm text-slate-600">
        <strong>{slots.length}</strong> available slot{slots.length === 1 ? "" : "s"}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Time</th>
              <th className="px-3 py-2 text-left font-semibold">Doctor</th>
              <th className="px-3 py-2 text-left font-semibold">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => {
              const moving = movingSlotId === s.id;
              return (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {ptFmtDateShort(s.startTime)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {ptFmtTime(s.startTime)}
                  </td>
                  <td className="px-3 py-2">{doctorDisplay(s.doctor)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onMove(s)}
                      disabled={moving || movingSlotId !== null}
                      className="inline-flex items-center px-3 py-1 rounded text-xs text-white font-medium hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
                    >
                      {moving && (
                        <Loader2 className="size-3 animate-spin mr-1" />
                      )}
                      Move Appointment Here
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConfirmationDialog({
  open,
  confirmation,
  onClose,
}: {
  open: boolean;
  confirmation:
    | { newAppointment: NewAppointmentSummary; original: Appt }
    | null;
  onClose: () => void;
}) {
  if (!confirmation) return null;
  const { newAppointment: na, original } = confirmation;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl print:shadow-none print:max-w-full">
        <DialogHeader>
          <DialogTitle>Appointment moved</DialogTitle>
          <DialogDescription>
            The original appointment has been marked <strong>Moved</strong> and a
            new appointment is now scheduled.
          </DialogDescription>
        </DialogHeader>

        <div
          id="move-confirmation"
          className="rounded-lg p-4 bg-emerald-50/40 text-sm space-y-3"
          style={{ border: "2px solid #C9A55C" }}
        >
          <div className="font-semibold text-slate-900 text-base">
            Appointment Confirmation
          </div>

          <Section title="New Appointment">
            <Row label="Date" value={ptFmtDateLong(na.startTime)} />
            <Row label="Time" value={ptFmtTime(na.startTime)} />
            <Row label="Office" value={original.location.name} />
            <Row label="Doctor" value={doctorDisplay(original.doctor)} />
            <Row label="Exam" value={original.specialty.name} />
            <Row label="Scheduled By" value={na.scheduledBy} />
          </Section>

          <Section title="Claimant">
            <Row label="Name" value={`${na.lastNamePrefix}, ${na.firstInitial}`} />
            <Row label="Case Number" value={na.caseNumber} />
            <Row label="Branch" value={na.stateBranch} />
          </Section>

          <Section title="Moved From">
            <Row
              label="Previous"
              value={`${ptFmtDateLong(original.startTime)} at ${ptFmtTime(original.startTime)}`}
            />
          </Section>
        </div>

        <DialogFooter className="print:hidden">
          <Button
            type="button"
            onClick={() => window.print()}
            className="sm:mr-auto text-white font-medium hover:brightness-95"
            style={{ background: "#DC2626", border: "2px solid #C9A55C" }}
          >
            <Printer className="size-4" />
            Print
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="text-white font-medium"
            style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
          >
            Done
          </Button>
        </DialogFooter>
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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
        {title}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
