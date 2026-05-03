"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Calendar as CalendarIcon, Loader2, Printer } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";

type Location = { id: string; name: string };
type Specialty = { id: string; name: string };
type Branch = { id: string; name: string };
type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  doctor: { id: string; name: string };
};

const formSchema = z.object({
  caseNumber: z.string().min(1, "Required"),
  contractNumber: z.string().optional(),
  firstInitial: z.string().length(1, "1 letter"),
  lastNamePrefix: z.string().min(1, "Required").max(5, "Max 5 letters"),
  stateBranch: z.string().min(1, "Required"),
  analystName: z.string().min(1, "Required"),
  analystPhone: z.string().regex(/^\d{1,15}$/, "Digits only"),
  schedulerName: z.string().min(1, "Required"),
  schedulerPhone: z.string().regex(/^\d{1,15}$/, "Digits only"),
  claimantPhone: z
    .string()
    .regex(/^\d{1,15}$/, "Digits only")
    .optional()
    .or(z.literal("")),
  hasInterpreter: z.enum(["yes", "no"]),
  isOdarCase: z.enum(["yes", "no"]),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

const CLAIMANT_STORAGE_KEY = "ewing-claimant-info";

const EMPTY_FORM: FormValues = {
  caseNumber: "",
  contractNumber: "",
  firstInitial: "",
  lastNamePrefix: "",
  stateBranch: "",
  analystName: "",
  analystPhone: "",
  schedulerName: "",
  schedulerPhone: "",
  claimantPhone: "",
  hasInterpreter: "no",
  isOdarCase: "no",
  notes: "",
};

function loadSavedFormValues(): FormValues {
  if (typeof window === "undefined") return EMPTY_FORM;
  const saved = window.sessionStorage.getItem(CLAIMANT_STORAGE_KEY);
  if (!saved) return EMPTY_FORM;
  try {
    return { ...EMPTY_FORM, ...JSON.parse(saved) };
  } catch {
    return EMPTY_FORM;
  }
}

function formatPhoneDisplay(s: string | undefined): string {
  if (!s) return "—";
  const d = s.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return s;
}

export default function ResultsPage() {
  return (
    <Suspense fallback={null}>
      <ResultsView />
    </Suspense>
  );
}

function ResultsView() {
  const router = useRouter();
  const params = useSearchParams();
  const locationId = params.get("locationId") ?? "";
  const specialtyId = params.get("specialtyId") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [location, setLocation] = useState<Location | null>(null);
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<
    { slot: Slot; values: FormValues } | null
  >(null);

  // Redirect home if URL is missing required params
  useEffect(() => {
    if (!locationId || !specialtyId || !from || !to) {
      router.replace("/schedule");
    }
  }, [locationId, specialtyId, from, to, router]);

  useEffect(() => {
    if (!locationId || !specialtyId || !from || !to) return;
    setLoading(true);
    setLoadError(null);

    const ctrl = new AbortController();
    Promise.all([
      fetch(`/api/locations`, { signal: ctrl.signal }).then((r) => r.json()),
      fetch(`/api/specialties`, { signal: ctrl.signal }).then((r) => r.json()),
      fetch(`/api/branches`, { signal: ctrl.signal }).then((r) => r.json()),
      fetch(
        `/api/slots?locationId=${locationId}&specialtyId=${specialtyId}&from=${from}&to=${to}`,
        { signal: ctrl.signal },
      ).then((r) => {
        if (!r.ok) throw new Error(`Search failed (${r.status})`);
        return r.json();
      }),
    ])
      .then(([locs, specs, brs, slts]: [Location[], Specialty[], Branch[], Slot[]]) => {
        setLocation(locs.find((l) => l.id === locationId) ?? null);
        setSpecialty(specs.find((s) => s.id === specialtyId) ?? null);
        setBranches(brs);
        setSlots(slts);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setLoadError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [locationId, specialtyId, from, to]);

  const initialFormValues = useMemo(() => loadSavedFormValues(), []);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialFormValues,
  });

  async function onBook(values: FormValues) {
    if (!bookingSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, slotId: bookingSlot.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Booking failed (${res.status})`);
      }
      setConfirmation({ slot: bookingSlot, values });
      setSlots((curr) => (curr ? curr.filter((s) => s.id !== bookingSlot.id) : curr));
      setBookingSlot(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  const fromLabel = useMemo(() => (from ? format(parseISO(from), "MMM d, yyyy") : ""), [from]);
  const toLabel = useMemo(() => (to ? format(parseISO(to), "MMM d, yyyy") : ""), [to]);

  function handleScheduleSameClaimant() {
    if (confirmation) {
      window.sessionStorage.setItem(
        CLAIMANT_STORAGE_KEY,
        JSON.stringify(confirmation.values),
      );
    }
    setConfirmation(null);
    router.push("/schedule");
  }

  function handleScheduleNewAppointment() {
    window.sessionStorage.removeItem(CLAIMANT_STORAGE_KEY);
    form.reset(EMPTY_FORM);
    setConfirmation(null);
    router.push("/schedule");
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <PageHeader
          title="Available Appointments"
          trailing={
            <Link
              href={`/schedule?locationId=${locationId}&specialtyId=${specialtyId}&from=${from}&to=${to}`}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="size-4" />
              Change search
            </Link>
          }
        />

        {/* Search summary */}
        <div className="rounded-lg p-4 mb-6 bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <SummaryItem label="Office" value={location?.name ?? "—"} />
          <SummaryItem label="Specialty" value={specialty?.name ?? "—"} />
          <SummaryItem label="From" value={fromLabel} />
          <SummaryItem label="To" value={toLabel} />
        </div>

        {loadError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 mb-4">
            {loadError}
          </div>
        )}

        <div className="bg-white rounded-lg border shadow-sm">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="font-medium text-slate-900">
              {loading
                ? "Loading…"
                : `${slots?.length ?? 0} available slot${slots?.length === 1 ? "" : "s"}`}
              {location && specialty && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  · {location.name} · {specialty.name}
                </span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="size-5 animate-spin mr-2" />
              Loading slots…
            </div>
          ) : !slots || slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500">
              <CalendarIcon className="size-8 mb-2 opacity-40" />
              <p>No available slots in this date range.</p>
              <Link
                href="/schedule"
                className="text-sm mt-2 hover:text-slate-900 underline underline-offset-2"
              >
                Try a wider window or a different specialty
              </Link>
            </div>
          ) : (
            <ResultsTable slots={slots} onPick={setBookingSlot} />
          )}
        </div>
      </div>

      <Dialog
        open={bookingSlot !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBookingSlot(null);
            setSubmitError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Book appointment</DialogTitle>
            {bookingSlot && (
              <DialogDescription>
                {format(new Date(bookingSlot.startTime), "EEEE, MMMM d, yyyy 'at' h:mm a")} ·{" "}
                {bookingSlot.doctor.name}
                {location && <> · {location.name}</>}
              </DialogDescription>
            )}
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onBook)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Case number" error={form.formState.errors.caseNumber?.message}>
                <Input {...form.register("caseNumber")} />
              </Field>
              <Field label="State branch" error={form.formState.errors.stateBranch?.message}>
                <select
                  {...form.register("stateBranch")}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <option value="">Choose…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="First initial" error={form.formState.errors.firstInitial?.message}>
                <Input maxLength={1} {...form.register("firstInitial")} />
              </Field>
              <Field label="Last name prefix (5)" error={form.formState.errors.lastNamePrefix?.message}>
                <Input maxLength={5} {...form.register("lastNamePrefix")} />
              </Field>

              <Field label="Analyst name" error={form.formState.errors.analystName?.message}>
                <Input {...form.register("analystName")} />
              </Field>
              <Field label="Analyst phone or ext." error={form.formState.errors.analystPhone?.message}>
                <Input inputMode="numeric" {...form.register("analystPhone")} />
              </Field>

              <Field label="Scheduler name" error={form.formState.errors.schedulerName?.message}>
                <Input {...form.register("schedulerName")} />
              </Field>
              <Field label="Scheduler phone or ext." error={form.formState.errors.schedulerPhone?.message}>
                <Input inputMode="numeric" {...form.register("schedulerPhone")} />
              </Field>

              <Field label="Claimant phone (optional)" error={form.formState.errors.claimantPhone?.message}>
                <Input inputMode="numeric" {...form.register("claimantPhone")} />
              </Field>
              <Field label="Contract number (optional)" error={form.formState.errors.contractNumber?.message}>
                <Input {...form.register("contractNumber")} />
              </Field>

              <Field label="Interpreter?" error={form.formState.errors.hasInterpreter?.message}>
                <select
                  {...form.register("hasInterpreter")}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>
              <Field label="ODAR case?" error={form.formState.errors.isOdarCase?.message}>
                <select
                  {...form.register("isOdarCase")}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>
            </div>

            <Field label="Notes" error={form.formState.errors.notes?.message}>
              <Textarea rows={3} {...form.register("notes")} />
            </Field>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setBookingSlot(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="text-white hover:brightness-95"
                style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Submit appointment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Appointment confirmation (printable) */}
      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          {confirmation && (
            <>
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
                      Issued {format(new Date(), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  </div>
                </div>

                <Section title="Appointment">
                  <DetailRow
                    label="Date"
                    value={format(
                      new Date(confirmation.slot.startTime),
                      "EEEE, MMMM d, yyyy",
                    )}
                  />
                  <DetailRow
                    label="Time"
                    value={format(new Date(confirmation.slot.startTime), "h:mm a")}
                  />
                  <DetailRow label="Doctor" value={confirmation.slot.doctor.name} />
                  <DetailRow label="Office" value={location?.name ?? "—"} />
                  <DetailRow label="Specialty" value={specialty?.name ?? "—"} />
                </Section>

                <Section title="Claimant">
                  <DetailRow label="Case number" value={confirmation.values.caseNumber} />
                  <DetailRow
                    label="Identifier"
                    value={`${confirmation.values.firstInitial.toUpperCase()}. ${confirmation.values.lastNamePrefix.toUpperCase()}`}
                  />
                  <DetailRow
                    label="Claimant phone"
                    value={formatPhoneDisplay(confirmation.values.claimantPhone)}
                  />
                  <DetailRow
                    label="Contract number"
                    value={confirmation.values.contractNumber || "—"}
                  />
                  <DetailRow
                    label="Interpreter"
                    value={confirmation.values.hasInterpreter === "yes" ? "Yes" : "No"}
                  />
                  <DetailRow
                    label="ODAR case"
                    value={confirmation.values.isOdarCase === "yes" ? "Yes" : "No"}
                  />
                </Section>

                <Section title="State">
                  <DetailRow label="Branch" value={confirmation.values.stateBranch} />
                  <DetailRow label="Analyst" value={confirmation.values.analystName} />
                  <DetailRow
                    label="Analyst phone"
                    value={formatPhoneDisplay(confirmation.values.analystPhone)}
                  />
                </Section>

                <Section title="Scheduler">
                  <DetailRow label="Name" value={confirmation.values.schedulerName} />
                  <DetailRow
                    label="Phone"
                    value={formatPhoneDisplay(confirmation.values.schedulerPhone)}
                  />
                </Section>

                {confirmation.values.notes && (
                  <div className="mb-4">
                    <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-1 mb-2">
                      Notes
                    </h3>
                    <p className="text-sm whitespace-pre-wrap text-slate-800">
                      {confirmation.values.notes}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="ewing-print-hide flex flex-col-reverse sm:flex-row gap-2 sm:justify-between sm:items-center pt-2 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.print()}
                  className="sm:mr-auto"
                >
                  <Printer className="size-4" />
                  Print
                </Button>
                <div className="flex flex-col-reverse sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleScheduleSameClaimant}
                  >
                    Schedule another for same claimant
                  </Button>
                  <Button
                    type="button"
                    onClick={handleScheduleNewAppointment}
                    style={{ background: "#0085CA" }}
                  >
                    Schedule a new appointment
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
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
    <div className="mb-4">
      <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-1 mb-2">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-slate-900">{value || "—"}</span>
    </div>
  );
}

function ResultsTable({ slots, onPick }: { slots: Slot[]; onPick: (s: Slot) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
          <tr className="border-b">
            <th className="px-3 py-2 font-medium whitespace-nowrap">Date</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Time</th>
            <th className="px-3 py-2 font-medium whitespace-nowrap">Doctor</th>
            <th className="px-3 py-2 font-medium text-right whitespace-nowrap">Action</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => {
            const start = new Date(s.startTime);
            return (
              <tr key={s.id} className="border-b last:border-0 even:bg-slate-50/50">
                <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap tabular-nums">
                  {format(start, "EEE, MMM d")}
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-700 whitespace-nowrap">
                  {format(start, "h:mm a")}
                </td>
                <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{s.doctor.name}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onPick(s)}
                    style={{ borderColor: "#C9A55C", borderWidth: "1.5px" }}
                  >
                    Make appointment
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
