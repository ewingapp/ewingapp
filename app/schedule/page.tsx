"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ArrowLeft, Search, Calendar as CalendarIcon, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Location = { id: string; name: string; city: string; state: string };
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
  firstInitial: z.string().length(1, "1 letter"),
  lastNamePrefix: z.string().min(1, "Required").max(5, "Max 5 letters"),
  stateBranch: z.string().min(1, "Required"),
  analystName: z.string().min(1, "Required"),
  analystPhone: z.string().regex(/^\d{10,15}$/, "10–15 digits"),
  schedulerName: z.string().min(1, "Required"),
  schedulerPhone: z.string().regex(/^\d{10,15}$/, "10–15 digits"),
  claimantPhone: z
    .string()
    .regex(/^\d{10,15}$/, "10–15 digits")
    .optional()
    .or(z.literal("")),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function plusDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function SchedulePage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [locationId, setLocationId] = useState<string>("");
  const [specialtyId, setSpecialtyId] = useState<string>("");
  const [from, setFrom] = useState<string>(todayISO());
  const [to, setTo] = useState<string>(plusDaysISO(30));

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ slot: Slot } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/specialties").then((r) => r.json()),
      fetch("/api/branches").then((r) => r.json()),
    ]).then(([l, s, b]) => {
      setLocations(l);
      setSpecialties(s);
      setBranches(b);
    });
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      caseNumber: "",
      firstInitial: "",
      lastNamePrefix: "",
      stateBranch: "",
      analystName: "",
      analystPhone: "",
      schedulerName: "",
      schedulerPhone: "",
      claimantPhone: "",
      notes: "",
    },
  });

  async function onSearch() {
    if (!locationId || !specialtyId) {
      setSearchError("Choose office and specialty.");
      return;
    }
    setSearchError(null);
    setSearching(true);
    setSlots(null);
    try {
      const params = new URLSearchParams({ locationId, specialtyId, from, to });
      const res = await fetch(`/api/slots?${params}`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data: Slot[] = await res.json();
      setSlots(data);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

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

  const selectedLocation = locations.find((l) => l.id === locationId);
  const selectedSpecialty = specialties.find((s) => s.id === specialtyId);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft className="size-4" />
            Dashboard
          </Link>
          <div className="h-5 w-px bg-slate-200" />
          <h1 className="font-semibold">Create a New Appointment</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Search availability</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-3 space-y-1.5">
                <Label htmlFor="office">Office</Label>
                <Select value={locationId} onValueChange={(v) => setLocationId(v ?? "")}>
                  <SelectTrigger id="office" className="w-full h-9">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-4 space-y-1.5">
                <Label htmlFor="specialty">Specialty</Label>
                <Select value={specialtyId} onValueChange={(v) => setSpecialtyId(v ?? "")}>
                  <SelectTrigger id="specialty" className="w-full h-9">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="from">From date</Label>
                <Input
                  id="from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="md:col-span-2 space-y-1.5">
                <Label htmlFor="to">To date</Label>
                <Input
                  id="to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="md:col-span-1">
                <Button onClick={onSearch} disabled={searching} className="w-full h-9">
                  {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  Search
                </Button>
              </div>
            </div>
            {searchError && (
              <p className="mt-3 text-sm text-destructive">{searchError}</p>
            )}
          </CardContent>
        </Card>

        {confirmation && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Appointment booked with {confirmation.slot.doctor.name} on{" "}
            {format(new Date(confirmation.slot.startTime), "EEE, MMM d 'at' h:mm a")}.
          </div>
        )}

        {slots !== null && (
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle className="text-base">
                {slots.length} available slot{slots.length === 1 ? "" : "s"}
                {selectedLocation && selectedSpecialty && (
                  <span className="ml-2 font-normal text-muted-foreground">
                    · {selectedLocation.name} · {selectedSpecialty.name}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {slots.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                  <CalendarIcon className="size-8 mb-2 opacity-40" />
                  <p>No available slots in this date range.</p>
                  <p className="text-sm">Try a wider window or a different specialty.</p>
                </div>
              ) : (
                <ResultsTable slots={slots} onPick={setBookingSlot} />
              )}
            </CardContent>
          </Card>
        )}
      </main>

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
                {selectedLocation && <> · {selectedLocation.name}</>}
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
              <Field label="Analyst phone (digits only)" error={form.formState.errors.analystPhone?.message}>
                <Input inputMode="numeric" {...form.register("analystPhone")} />
              </Field>

              <Field label="Scheduler name" error={form.formState.errors.schedulerName?.message}>
                <Input {...form.register("schedulerName")} />
              </Field>
              <Field label="Scheduler phone (digits only)" error={form.formState.errors.schedulerPhone?.message}>
                <Input inputMode="numeric" {...form.register("schedulerPhone")} />
              </Field>

              <Field label="Claimant phone (optional)" error={form.formState.errors.claimantPhone?.message}>
                <Input inputMode="numeric" {...form.register("claimantPhone")} />
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
    </div>
  );
}

function ResultsTable({ slots, onPick }: { slots: Slot[]; onPick: (s: Slot) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr className="border-b">
            <th className="px-4 py-2 font-medium">Date</th>
            <th className="px-4 py-2 font-medium">Time</th>
            <th className="px-4 py-2 font-medium">Doctor</th>
            <th className="px-4 py-2 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s, i) => {
            const start = new Date(s.startTime);
            const prev = i > 0 ? new Date(slots[i - 1].startTime) : null;
            const newDay = !prev || prev.toDateString() !== start.toDateString();
            return (
              <tr key={s.id} className={`border-b last:border-0 ${newDay ? "bg-slate-50/60" : ""}`}>
                <td className="px-4 py-2 font-medium">
                  {newDay ? format(start, "EEE, MMM d") : ""}
                </td>
                <td className="px-4 py-2 tabular-nums">{format(start, "h:mm a")}</td>
                <td className="px-4 py-2">{s.doctor.name}</td>
                <td className="px-4 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => onPick(s)}>
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
