"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import {
  Search,
  Loader2,
  Info,
  Mail,
  Calendar as CalendarIcon,
} from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Location = { id: string; name: string; city: string; state: string };
type Specialty = { id: string; name: string };

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function SchedulePage() {
  return (
    <Suspense fallback={null}>
      <SearchView />
    </Suspense>
  );
}

function SearchView() {
  const router = useRouter();
  const params = useSearchParams();

  const [locations, setLocations] = useState<Location[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [locationId, setLocationId] = useState<string>(params.get("locationId") ?? "");
  const [specialtyId, setSpecialtyId] = useState<string>(params.get("specialtyId") ?? "");
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = params.get("from");
    const to = params.get("to");
    if (!from || !to) return undefined;
    return { from: parseISO(from), to: parseISO(to) };
  });
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/specialties").then((r) => r.json()),
    ]).then(([l, s]) => {
      setLocations(l);
      setSpecialties(s);
    });
  }, []);

  useEffect(() => {
    if (!locationId || !specialtyId) {
      setAvailableDates([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/availability?locationId=${locationId}&specialtyId=${specialtyId}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((data: { dates: string[] }) => {
        setAvailableDates(data.dates.map((s) => parseISO(s)));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [locationId, specialtyId]);

  function onSearch() {
    if (!locationId || !specialtyId) {
      setSearchError("Choose office and specialty.");
      return;
    }
    if (!range?.from || !range?.to) {
      setSearchError("Pick a from and to date on the calendar.");
      return;
    }
    setSearchError(null);
    setSubmitting(true);
    const qs = new URLSearchParams({
      locationId,
      specialtyId,
      from: isoDate(range.from),
      to: isoDate(range.to),
    });
    router.push(`/schedule/results?${qs.toString()}`);
  }

  const fromDateInput = useMemo(
    () => (range?.from ? format(range.from, "MM/dd/yyyy") : ""),
    [range?.from],
  );
  const toDateInput = useMemo(
    () => (range?.to ? format(range.to, "MM/dd/yyyy") : ""),
    [range?.to],
  );

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <PageHeader
          title="Create a New Appointment"
          trailing={
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{ background: "#FDF7E7", borderColor: "#E6CC8A", color: "#7A5E1F" }}
            >
              <Mail className="size-3.5" />
              <span className="font-semibold">0</span> emails sent today
            </span>
          }
        />

        <div className="rounded-lg p-5 flex gap-4 mb-6 bg-slate-50 border border-slate-200">
          <div
            className="grid place-items-center size-9 rounded-full shrink-0"
            style={{ background: "#C9A55C" }}
          >
            <Info className="size-5 text-white" />
          </div>
          <ul className="text-sm text-slate-700 space-y-1.5 leading-relaxed list-disc pl-4">
            <li>
              Choose the desired <strong>Office</strong>.
            </li>
            <li>
              Choose the desired <strong>Specialty</strong>.
            </li>
            <li>
              Choose the <strong>From Date</strong> and <strong>To Date</strong> by clicking the appropriate dates on the calendar.
            </li>
            <li>
              Click the <strong>Search</strong> button.
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-6">
          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="office" className="text-xs uppercase tracking-wide text-slate-500">
              Office
            </Label>
            <Select
              value={locationId}
              onValueChange={(v) => setLocationId(v ?? "")}
              items={locations.map((l) => ({ value: l.id, label: l.name }))}
            >
              <SelectTrigger id="office" className="w-full h-10 bg-white">
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

          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="specialty" className="text-xs uppercase tracking-wide text-slate-500">
              Specialty
            </Label>
            <Select
              value={specialtyId}
              onValueChange={(v) => setSpecialtyId(v ?? "")}
              items={specialties.map((s) => ({ value: s.id, label: s.name }))}
            >
              <SelectTrigger id="specialty" className="w-full h-10 bg-white">
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
            <Label className="text-xs uppercase tracking-wide text-slate-500">From Date</Label>
            <div className="relative">
              <Input value={fromDateInput} readOnly placeholder="––/––/––––" className="h-10 pr-9 bg-white" />
              <CalendarIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-slate-500">To Date</Label>
            <div className="relative">
              <Input value={toDateInput} readOnly placeholder="––/––/––––" className="h-10 pr-9 bg-white" />
              <CalendarIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="md:col-span-2">
            <Button
              onClick={onSearch}
              disabled={submitting}
              className="w-full h-10 text-white font-medium shadow-sm hover:brightness-95"
              style={{ background: "#0085CA" }}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Search
            </Button>
          </div>
        </div>

        {searchError && (
          <p className="text-sm text-destructive mb-4">{searchError}</p>
        )}

        <div className="bg-white rounded-lg border shadow-sm p-4 mb-6 ewing-calendar">
          <DayPicker
            mode="range"
            numberOfMonths={2}
            selected={range}
            onSelect={setRange}
            modifiers={{ available: availableDates }}
            modifiersClassNames={{ available: "rdp-day-available" }}
          />
        </div>
      </div>
    </AppShell>
  );
}
