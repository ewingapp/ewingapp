"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Calendar as CalendarIcon, Loader2 } from "lucide-react";

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
  const [confirmation, setConfirmation] = useState<{ slot: Slot } | null>(null);

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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
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
    },
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
      setConfirmation({ slot: bookingSlot });
      setSlots((curr) => (curr ? curr.filter((s) => s.id !== bookingSlot.id) : curr));
      setBookingSlot(null);
      form.reset();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  const fromLabel = useMemo(() => (from ? format(parseISO(from), "MMM d, yyyy") : ""), [from]);
  const toLabel = useMemo(() => (to ? format(parseISO(to), "MMM d, yyyy") : ""), [to]);

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

        {confirmation && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 mb-4">
            Appointment booked with {confirmation.slot.doctor.name} on{" "}
            {format(new Date(confirmation.slot.startTime), "EEE, MMM d 'at' h:mm a")}.
          </div>
        )}

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
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Submit appointment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ResultsTable({ slots, onPick }: { slots: Slot[]; onPick: (s: Slot) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
          <tr className="border-b">
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 font-medium">Time</th>
            <th className="px-4 py-2.5 font-medium">Doctor</th>
            <th className="px-4 py-2.5 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s, i) => {
            const start = new Date(s.startTime);
            const prev = i > 0 ? new Date(slots[i - 1].startTime) : null;
            const newDay = !prev || prev.toDateString() !== start.toDateString();
            return (
              <tr key={s.id} className={`border-b last:border-0 ${newDay ? "bg-slate-50/40" : ""}`}>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  {newDay ? format(start, "EEE, MMM d") : ""}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-slate-700">{format(start, "h:mm a")}</td>
                <td className="px-4 py-2.5 text-slate-700">{s.doctor.name}</td>
                <td className="px-4 py-2.5 text-right">
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
