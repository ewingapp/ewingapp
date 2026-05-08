"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addWeeks, format, parseISO, startOfDay } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import {
  ArrowUp,
  ArrowDown,
  Calendar as CalendarIcon,
  Eye,
  Loader2,
  Search,
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
import { Checkbox } from "@/components/ui/checkbox";
import { ptFmtTime, ptFmtDateShort } from "@/lib/pt";
import { getCaHolidaysRange } from "@/lib/ca-holidays";

type Location = { id: string; name: string };
type Specialty = { id: string; name: string };
type Doctor = { id: string; name: string };

type Appt = {
  id: string;
  startTime: string;
  caseNumber: string;
  firstInitial: string;
  lastNamePrefix: string;
  status:
    | "SCHEDULED"
    | "KEPT"
    | "NO_SHOW"
    | "CANCELLED"
    | "MOVED"
    | "OTHER";
  scheduledBy: "BRANCH" | "VENDOR";
  doctor: { id: string; name: string };
  specialty: { id: string; name: string };
  location: { id: string; name: string };
};

type SortKey =
  | "office"
  | "date"
  | "time"
  | "case"
  | "claimant"
  | "doctor"
  | "exam"
  | "status";

const ALL = "__all";

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const STATUS_LABEL: Record<Appt["status"], string> = {
  SCHEDULED: "Scheduled",
  KEPT: "Kept",
  NO_SHOW: "No Show",
  CANCELLED: "Cancelled",
  MOVED: "Moved",
  OTHER: "Other",
};

export default function AppointmentsPage() {
  return (
    <Suspense fallback={null}>
      <ScheduledAppointmentsView />
    </Suspense>
  );
}

function ScheduledAppointmentsView() {
  const [chooseBy, setChooseBy] = useState<"office" | "doctor">("office");
  const [locationId, setLocationId] = useState<string>("");
  const [doctorId, setDoctorId] = useState<string>("");
  const [specialtyId, setSpecialtyId] = useState<string>("");
  const [lastName, setLastName] = useState("");
  const [firstInitial, setFirstInitial] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [noShowOnly, setNoShowOnly] = useState(false);

  const [locations, setLocations] = useState<Location[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  const [range, setRange] = useState<DateRange | undefined>(() => {
    const today = startOfDay(new Date());
    return { from: today, to: addWeeks(today, 6) };
  });

  const [results, setResults] = useState<Appt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const caHolidays = useMemo(() => getCaHolidaysRange(2), []);

  useEffect(() => {
    fetch("/api/locations")
      .then((r) => r.json())
      .then((l: Location[]) => setLocations(l))
      .catch(() => {});
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((d: Doctor[]) => setDoctors(d))
      .catch(() => {});
    fetch("/api/specialties")
      .then((r) => r.json())
      .then((s: Specialty[]) => setSpecialties(s))
      .catch(() => {});
  }, []);

  function onSearch() {
    if (!range?.from || !range?.to) {
      setError("Pick a from and to date.");
      return;
    }
    setError(null);
    setLoading(true);
    const qs = new URLSearchParams();
    if (chooseBy === "office" && locationId) qs.set("locationId", locationId);
    if (chooseBy === "doctor" && doctorId) qs.set("doctorId", doctorId);
    if (specialtyId) qs.set("specialtyId", specialtyId);
    qs.set("from", isoDate(range.from));
    qs.set("to", isoDate(range.to));
    if (lastName.trim()) qs.set("lastName", lastName.trim());
    if (firstInitial.trim()) qs.set("firstInitial", firstInitial.trim().charAt(0));
    if (caseNumber.trim()) qs.set("caseNumber", caseNumber.trim());
    if (noShowOnly) qs.set("noShowOnly", "1");

    fetch(`/api/appointments?${qs.toString()}`)
      .then((r) => r.json())
      .then((data: Appt[]) => setResults(data))
      .catch(() => setError("Search failed."))
      .finally(() => setLoading(false));
  }

  const sorted = useMemo(() => {
    if (!results) return null;
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: Appt, b: Appt) => {
      switch (sortKey) {
        case "office":
          return a.location.name.localeCompare(b.location.name) * dir;
        case "date":
        case "time":
          return (
            (new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) *
            dir
          );
        case "case":
          return a.caseNumber.localeCompare(b.caseNumber) * dir;
        case "claimant":
          return (
            `${a.lastNamePrefix},${a.firstInitial}`.localeCompare(
              `${b.lastNamePrefix},${b.firstInitial}`,
            ) * dir
          );
        case "doctor":
          return a.doctor.name.localeCompare(b.doctor.name) * dir;
        case "exam":
          return a.specialty.name.localeCompare(b.specialty.name) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
      }
    };
    return [...results].sort(cmp);
  }, [results, sortKey, sortDir]);

  const fromInput = range?.from ? format(range.from, "MM/dd/yyyy") : "";
  const toInput = range?.to ? format(range.to, "MM/dd/yyyy") : "";

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <PageHeader title="Scheduled Appointments" />

        <div
          className="rounded-lg p-5 mb-6 bg-slate-50"
          style={{ border: "2px solid #C9A55C" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Office / Doctor toggle */}
            <div className="md:col-span-3 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                Search By
              </Label>
              <div className="flex gap-4 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="chooseBy"
                    checked={chooseBy === "office"}
                    onChange={() => setChooseBy("office")}
                  />
                  Office
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="chooseBy"
                    checked={chooseBy === "doctor"}
                    onChange={() => setChooseBy("doctor")}
                  />
                  Doctor
                </label>
              </div>
              {chooseBy === "office" ? (
                <Select
                  value={locationId || ALL}
                  onValueChange={(v) => setLocationId(v === ALL ? "" : (v ?? ""))}
                  items={[
                    { value: ALL, label: "All Offices" },
                    ...locations.map((l) => ({ value: l.id, label: l.name })),
                  ]}
                >
                  <SelectTrigger className="w-full h-10 bg-white">
                    <SelectValue placeholder="All Offices" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Offices</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={doctorId || ALL}
                  onValueChange={(v) => setDoctorId(v === ALL ? "" : (v ?? ""))}
                  items={[
                    { value: ALL, label: "All Doctors" },
                    ...doctors.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                >
                  <SelectTrigger className="w-full h-10 bg-white">
                    <SelectValue placeholder="All Doctors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Doctors</SelectItem>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Specialty */}
            <div className="md:col-span-3 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                Exam Specialty
              </Label>
              <Select
                value={specialtyId || ALL}
                onValueChange={(v) => setSpecialtyId(v === ALL ? "" : (v ?? ""))}
                items={[
                  { value: ALL, label: "All Specialties" },
                  ...specialties.map((s) => ({ value: s.id, label: s.name })),
                ]}
              >
                <SelectTrigger className="w-full h-10 bg-white">
                  <SelectValue placeholder="All Specialties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Specialties</SelectItem>
                  {specialties.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range readouts */}
            <div className="md:col-span-2 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                From Date
              </Label>
              <div className="relative">
                <Input
                  value={fromInput}
                  readOnly
                  placeholder="––/––/––––"
                  className="h-10 pr-9 bg-white"
                />
                <CalendarIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                To Date
              </Label>
              <div className="relative">
                <Input
                  value={toInput}
                  readOnly
                  placeholder="––/––/––––"
                  className="h-10 pr-9 bg-white"
                />
                <CalendarIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="md:col-span-2 flex items-end">
              <Button
                onClick={onSearch}
                disabled={loading}
                className="w-full h-10 text-white font-medium shadow-sm hover:brightness-95"
                style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Search
              </Button>
            </div>

            {/* Search criteria row */}
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                Last Name
              </Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value.slice(0, 5))}
                placeholder="up to 5 letters"
                className="h-10 bg-white"
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                First Initial
              </Label>
              <Input
                value={firstInitial}
                onChange={(e) =>
                  setFirstInitial(e.target.value.slice(0, 1).toUpperCase())
                }
                placeholder="A"
                className="h-10 bg-white"
              />
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                Case Number
              </Label>
              <Input
                value={caseNumber}
                onChange={(e) =>
                  setCaseNumber(e.target.value.replace(/\D/g, ""))
                }
                placeholder="case #"
                className="h-10 bg-white"
              />
            </div>
            <div className="md:col-span-2 flex items-end pb-1">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={noShowOnly}
                  onCheckedChange={(v) => setNoShowOnly(v === true)}
                />
                No-Show Only
              </label>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

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

        {sorted && (
          <ResultsTable
            rows={sorted}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(k) => {
              if (k === sortKey) {
                setSortDir((d) => (d === "asc" ? "desc" : "asc"));
              } else {
                setSortKey(k);
                setSortDir("asc");
              }
            }}
          />
        )}
      </div>
    </AppShell>
  );
}

function ResultsTable({
  rows,
  sortKey,
  sortDir,
  onSort,
}: {
  rows: Appt[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No appointments found.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 text-sm text-slate-600">
        <strong>{rows.length}</strong> result{rows.length === 1 ? "" : "s"}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <Th sortKey="office" current={sortKey} dir={sortDir} onSort={onSort}>
                Office
              </Th>
              <Th sortKey="date" current={sortKey} dir={sortDir} onSort={onSort}>
                Date
              </Th>
              <Th sortKey="time" current={sortKey} dir={sortDir} onSort={onSort}>
                Time
              </Th>
              <Th sortKey="case" current={sortKey} dir={sortDir} onSort={onSort}>
                Case#
              </Th>
              <Th
                sortKey="claimant"
                current={sortKey}
                dir={sortDir}
                onSort={onSort}
              >
                Claimant
              </Th>
              <Th sortKey="doctor" current={sortKey} dir={sortDir} onSort={onSort}>
                Doctor
              </Th>
              <Th sortKey="exam" current={sortKey} dir={sortDir} onSort={onSort}>
                Exam
              </Th>
              <Th
                sortKey="status"
                current={sortKey}
                dir={sortDir}
                onSort={onSort}
              >
                Appt. Status
              </Th>
              <th className="px-3 py-2 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{a.location.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {ptFmtDateShort(a.startTime)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {ptFmtTime(a.startTime)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{a.caseNumber}</td>
                <td className="px-3 py-2">
                  {a.lastNamePrefix}, {a.firstInitial}
                </td>
                <td className="px-3 py-2">{a.doctor.name}</td>
                <td className="px-3 py-2">{a.specialty.name}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={a.status} />
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/appointments/${a.id}`}
                    className="inline-flex items-center gap-1 text-[#0085CA] hover:underline"
                  >
                    <Eye className="size-3.5" />
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  sortKey,
  current,
  dir,
  onSort,
  children,
}: {
  sortKey: SortKey;
  current: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
}) {
  const active = sortKey === current;
  return (
    <th
      className="px-3 py-2 text-left font-semibold cursor-pointer select-none whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {active &&
          (dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          ))}
      </span>
    </th>
  );
}

function StatusBadge({ status }: { status: Appt["status"] }) {
  const color: Record<Appt["status"], string> = {
    SCHEDULED: "bg-blue-50 text-blue-700 ring-blue-200",
    KEPT: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    NO_SHOW: "bg-rose-50 text-rose-700 ring-rose-200",
    CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
    MOVED: "bg-amber-50 text-amber-700 ring-amber-200",
    OTHER: "bg-slate-50 text-slate-600 ring-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${color[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
