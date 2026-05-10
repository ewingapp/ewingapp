"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addWeeks, parseISO, startOfDay } from "date-fns";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Download,
  Loader2,
  Search,
  X,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ptFmtTime,
  ptFmtDateShort,
  ptFmtDateLong,
  ptDateIso,
  ptTodayIso,
} from "@/lib/pt";
import { getCaHolidaysRange } from "@/lib/ca-holidays";

type Location = { id: string; name: string };
type Specialty = { id: string; name: string };
type Doctor = { id: string; name: string; firstName: string; lastName: string };

type Branch = { id: string; name: string };

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
  cancelledBy: "BRANCH" | "VENDOR" | null;
  cancelledAt: string | null;
  statusNote: string;
  stateBranch: string;
  doctor: { id: string; name: string; firstName: string; lastName: string };
  specialty: { id: string; name: string };
  location: { id: string; name: string };
};

function doctorDisplay(d: { firstName: string; lastName: string }): string {
  return `${d.firstName} ${d.lastName}`.trim();
}

type SortKey =
  | "office"
  | "date"
  | "time"
  | "case"
  | "claimant"
  | "doctor"
  | "exam"
  | "branch"
  | "status";

const ALL = "__all";

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatMmDdYyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

function csvEscape(value: string | null | undefined): string {
  const s = value ?? "";
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: Appt[], includeBranch: boolean) {
  const headers = [
    "Office",
    "Date",
    "Time",
    "Case#",
    "Claimant",
    "Doctor",
    "Exam",
    ...(includeBranch ? ["Branch"] : []),
    "Status",
    "Status Note",
    "Scheduled By",
    "Cancelled By",
    "Cancelled At",
  ];
  const lines = [headers.map(csvEscape).join(",")];
  for (const a of rows) {
    lines.push(
      [
        a.location.name,
        ptFmtDateShort(a.startTime),
        ptFmtTime(a.startTime),
        a.caseNumber,
        `${a.lastNamePrefix}, ${a.firstInitial}`,
        doctorDisplay(a.doctor),
        a.specialty.name,
        ...(includeBranch ? [a.stateBranch] : []),
        STATUS_LABEL[a.status],
        a.statusNote ?? "",
        a.scheduledBy,
        a.cancelledBy ?? "",
        a.cancelledAt
          ? `${ptFmtDateShort(a.cancelledAt)} ${ptFmtTime(a.cancelledAt)}`
          : "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  const csv = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const stamp = isoDate(new Date());
  link.download = `scheduled-appointments-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  const router = useRouter();
  const urlParams = useSearchParams();

  const [chooseBy, setChooseBy] = useState<"office" | "doctor">(
    () => (urlParams.get("by") === "doctor" ? "doctor" : "office"),
  );
  const [locationId, setLocationId] = useState<string>(
    () => urlParams.get("locationId") ?? "",
  );
  const [doctorId, setDoctorId] = useState<string>(
    () => urlParams.get("doctorId") ?? "",
  );
  const [specialtyId, setSpecialtyId] = useState<string>(
    () => urlParams.get("specialtyId") ?? "",
  );
  const [lastName, setLastName] = useState(() => urlParams.get("lastName") ?? "");
  const [firstInitial, setFirstInitial] = useState(
    () => urlParams.get("firstInitial") ?? "",
  );
  const [caseNumber, setCaseNumber] = useState(
    () => urlParams.get("caseNumber") ?? "",
  );
  const [includeBranch, setIncludeBranch] = useState(
    () => urlParams.get("includeBranch") === "1",
  );
  const [noShowOnly, setNoShowOnly] = useState(
    () => urlParams.get("noShowOnly") === "1",
  );
  const [showBranchInResults, setShowBranchInResults] = useState(
    () => urlParams.get("includeBranch") === "1",
  );

  const [locations, setLocations] = useState<Location[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);

  const [range, setRange] = useState<DateRange | undefined>(() => {
    const fromParam = urlParams.get("from");
    const toParam = urlParams.get("to");
    if (fromParam && toParam) {
      try {
        return { from: parseISO(fromParam), to: parseISO(toParam) };
      } catch {
        // fall through to default
      }
    }
    const today = startOfDay(new Date());
    return { from: today, to: addWeeks(today, 6) };
  });
  const fromDate = range?.from ? isoDate(range.from) : "";
  const toDate = range?.to ? isoDate(range.to) : "";

  const caHolidays = useMemo(() => getCaHolidaysRange(2), []);

  const [results, setResults] = useState<Appt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [cancelTarget, setCancelTarget] = useState<Appt | null>(null);

  function applyUpdated(updated: Appt) {

    setResults((prev) =>
      prev ? prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)) : prev,
    );
  }

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
    if (!fromDate || !toDate) {
      setError("Pick a from and to date.");
      return;
    }
    if (fromDate > toDate) {
      setError("From date must be before To date.");
      return;
    }
    setError(null);

    const qs = new URLSearchParams();
    qs.set("by", chooseBy);
    if (chooseBy === "office" && locationId) qs.set("locationId", locationId);
    if (chooseBy === "doctor" && doctorId) qs.set("doctorId", doctorId);
    if (specialtyId) qs.set("specialtyId", specialtyId);
    qs.set("from", fromDate);
    qs.set("to", toDate);
    if (lastName.trim()) qs.set("lastName", lastName.trim());
    if (firstInitial.trim()) qs.set("firstInitial", firstInitial.trim().charAt(0));
    if (caseNumber.trim()) qs.set("caseNumber", caseNumber.trim());
    if (noShowOnly) qs.set("noShowOnly", "1");
    if (includeBranch) qs.set("includeBranch", "1");

    router.push(`/appointments?${qs.toString()}`);
  }

  function onChangeSearch() {
    router.push("/appointments");
  }

  useEffect(() => {
    const by = urlParams.get("by");
    if (by === "office" || by === "doctor") setChooseBy(by);
    setLocationId(urlParams.get("locationId") ?? "");
    setDoctorId(urlParams.get("doctorId") ?? "");
    setSpecialtyId(urlParams.get("specialtyId") ?? "");
    setLastName(urlParams.get("lastName") ?? "");
    setFirstInitial(urlParams.get("firstInitial") ?? "");
    setCaseNumber(urlParams.get("caseNumber") ?? "");
    setNoShowOnly(urlParams.get("noShowOnly") === "1");
    setIncludeBranch(urlParams.get("includeBranch") === "1");
    setShowBranchInResults(urlParams.get("includeBranch") === "1");

    const fromParam = urlParams.get("from");
    const toParam = urlParams.get("to");
    if (fromParam && toParam) {
      try {
        setRange({ from: parseISO(fromParam), to: parseISO(toParam) });
      } catch {
        // ignore — keep existing range
      }
    }

    if (!fromParam || !toParam) {
      setResults(null);
      return;
    }

    const apiQs = new URLSearchParams();
    if (by === "doctor") {
      const did = urlParams.get("doctorId");
      if (did) apiQs.set("doctorId", did);
    } else {
      const lid = urlParams.get("locationId");
      if (lid) apiQs.set("locationId", lid);
    }
    const sid = urlParams.get("specialtyId");
    if (sid) apiQs.set("specialtyId", sid);
    apiQs.set("from", fromParam);
    apiQs.set("to", toParam);
    const ln = urlParams.get("lastName");
    if (ln) apiQs.set("lastName", ln);
    const fi = urlParams.get("firstInitial");
    if (fi) apiQs.set("firstInitial", fi);
    const cn = urlParams.get("caseNumber");
    if (cn) apiQs.set("caseNumber", cn);
    if (urlParams.get("noShowOnly") === "1") apiQs.set("noShowOnly", "1");

    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/appointments?${apiQs.toString()}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: Appt[]) => setResults(data))
      .catch((e) => {
        if (e?.name !== "AbortError") setError("Search failed.");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [urlParams]);

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
          return doctorDisplay(a.doctor).localeCompare(doctorDisplay(b.doctor)) * dir;
        case "exam":
          return a.specialty.name.localeCompare(b.specialty.name) * dir;
        case "branch":
          return a.stateBranch.localeCompare(b.stateBranch) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
      }
    };
    return [...results].sort(cmp);
  }, [results, sortKey, sortDir]);

  const hasResults = sorted !== null;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <PageHeader
          title="Scheduled Appointments"
          trailing={
            hasResults ? (
              <button
                type="button"
                onClick={onChangeSearch}
                className="inline-flex items-center gap-1 text-sm text-slate-700 hover:text-[#0085CA]"
              >
                <ArrowLeft className="size-4" />
                Change search
              </button>
            ) : undefined
          }
        />

        {!hasResults && (
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
                    ...doctors.map((d) => ({ value: d.id, label: doctorDisplay(d) })),
                  ]}
                >
                  <SelectTrigger className="w-full h-10 bg-white">
                    <SelectValue placeholder="All Doctors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All Doctors</SelectItem>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {doctorDisplay(d)}
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

            {/* Date range readouts (driven by the calendar below) */}
            <div className="md:col-span-2 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                From Date
              </Label>
              <Input
                value={fromDate ? formatMmDdYyyy(fromDate) : ""}
                readOnly
                placeholder="––/––/––––"
                className="h-10 bg-white"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-slate-500">
                To Date
              </Label>
              <Input
                value={toDate ? formatMmDdYyyy(toDate) : ""}
                readOnly
                placeholder="––/––/––––"
                className="h-10 bg-white"
              />
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
            <div className="md:col-span-2 space-y-1.5">
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
            <div className="md:col-span-2 space-y-1.5">
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
            <div className="md:col-span-6 flex items-end pb-1 gap-6">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={noShowOnly}
                  onCheckedChange={(v) => setNoShowOnly(v === true)}
                />
                No-Show Only
              </label>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={includeBranch}
                  onCheckedChange={(v) => setIncludeBranch(v === true)}
                />
                Include Branch
              </label>
            </div>
          </div>
        </div>
        )}

        {!hasResults && (
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
        )}

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

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
            onCancelClick={setCancelTarget}
            onStatusUpdated={applyUpdated}
            showBranch={showBranchInResults}
          />
        )}

        <CancelDialog
          target={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={(updated) => {
            applyUpdated(updated);
            setCancelTarget(null);
          }}
        />
      </div>
    </AppShell>
  );
}

function ResultsTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  onCancelClick,
  onStatusUpdated,
  showBranch,
}: {
  rows: Appt[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  onCancelClick: (appt: Appt) => void;
  onStatusUpdated: (updated: Appt) => void;
  showBranch: boolean;
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
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
        <span className="text-sm text-slate-600">
          <strong>{rows.length}</strong> result{rows.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => downloadCsv(rows, showBranch)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-white shadow-sm hover:brightness-95"
          style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
        >
          <Download className="size-3.5" />
          Download CSV
        </button>
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
              {showBranch && (
                <Th sortKey="branch" current={sortKey} dir={sortDir} onSort={onSort}>
                  Branch
                </Th>
              )}
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
                <td className="px-3 py-2">{doctorDisplay(a.doctor)}</td>
                <td className="px-3 py-2">{a.specialty.name}</td>
                {showBranch && (
                  <td className="px-3 py-2 whitespace-nowrap">{a.stateBranch}</td>
                )}
                <td className="px-3 py-2">
                  <StatusCell appt={a} onUpdated={onStatusUpdated} />
                </td>
                <td className="px-3 py-2">
                  <ActionGroup appt={a} onCancelClick={onCancelClick} />
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

function ActionGroup({
  appt,
  onCancelClick,
}: {
  appt: Appt;
  onCancelClick: (appt: Appt) => void;
}) {
  const cancelDisabled =
    appt.status === "CANCELLED" || appt.status === "MOVED";
  const moveDisabled = appt.status === "MOVED" || appt.status === "CANCELLED";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        <ActionLink href={`/appointments/${appt.id}`}>View</ActionLink>
        <ActionLink href={`/appointments/${appt.id}/edit`}>Edit</ActionLink>
        <ActionButton
          disabled={cancelDisabled}
          onClick={() => onCancelClick(appt)}
        >
          Cancel
        </ActionButton>
        <ActionLink href={`/reschedule/${appt.id}`} disabled={moveDisabled}>
          Move
        </ActionLink>
      </div>
      {appt.status === "CANCELLED" && appt.cancelledAt && (
        <div className="text-[11px] leading-tight text-slate-600 max-w-[14rem]">
          Cancelled by {appt.cancelledBy === "BRANCH" ? "Branch" : "Vendor"} on{" "}
          {ptFmtDateShort(appt.cancelledAt)} {ptFmtTime(appt.cancelledAt)}
          {appt.statusNote && (
            <div className="text-slate-500">Reason: {appt.statusNote}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        className="inline-flex items-center px-2 py-1 rounded text-xs text-slate-400 bg-slate-50 cursor-not-allowed"
        style={{ border: "1.5px solid #C9A55C", opacity: 0.5 }}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center px-2 py-1 rounded text-xs text-slate-700 hover:bg-slate-50 hover:text-[#0085CA]"
      style={{ border: "1.5px solid #C9A55C" }}
    >
      {children}
    </Link>
  );
}

function ActionButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center px-2 py-1 rounded text-xs text-slate-700 hover:bg-slate-50 hover:text-[#0085CA] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
      style={{ border: "1.5px solid #C9A55C" }}
    >
      {children}
    </button>
  );
}

function CancelDialog({
  target,
  onClose,
  onCancelled,
}: {
  target: Appt | null;
  onClose: () => void;
  onCancelled: (updated: Appt) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setReason("");
      setErr(null);
    }
  }, [target]);

  async function submit() {
    if (!target) return;
    if (!reason.trim()) {
      setErr("Reason is required.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/appointments/${target.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to cancel");
      }
      const updated = await res.json();
      onCancelled({ ...target, ...updated });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel appointment</DialogTitle>
          <DialogDescription>
            {target && (
              <>
                {ptFmtDateLong(target.startTime)} at {ptFmtTime(target.startTime)} —{" "}
                {target.lastNamePrefix}, {target.firstInitial} (Case #
                {target.caseNumber}) with {doctorDisplay(target.doctor)} at{" "}
                {target.location.name}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason" className="text-sm">
            Reason for cancellation <span className="text-rose-600">*</span>
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="e.g. Branch requested cancellation; claimant unavailable; …"
          />
          <p className="text-xs text-slate-500">
            This note is visible to the State branch.
          </p>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Keep appointment
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="text-white font-medium"
            style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
            Cancel appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatusCell({
  appt,
  onUpdated,
}: {
  appt: Appt;
  onUpdated: (updated: Appt) => void;
}) {
  const terminal =
    appt.status === "CANCELLED" || appt.status === "MOVED" || appt.status === "OTHER";
  const apptDay = ptDateIso(new Date(appt.startTime));
  const today = ptTodayIso();
  const editable = !terminal && apptDay <= today;

  const savedStatus =
    appt.status === "KEPT" || appt.status === "NO_SHOW" ? appt.status : "SCHEDULED";
  const [pendingStatus, setPendingStatus] = useState<
    "SCHEDULED" | "KEPT" | "NO_SHOW"
  >(savedStatus);
  const [pendingNote, setPendingNote] = useState(appt.statusNote ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setPendingStatus(savedStatus);
    setPendingNote(appt.statusNote ?? "");
  }, [savedStatus, appt.statusNote]);

  const dirty =
    pendingStatus !== savedStatus || pendingNote !== (appt.statusNote ?? "");

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/appointments/${appt.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: pendingStatus, note: pendingNote.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
      const updated = await res.json();
      onUpdated({ ...appt, ...updated });
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!editable) {
    return (
      <div className="flex flex-col gap-1">
        <StatusBadge status={appt.status} />
        {appt.statusNote && appt.status !== "CANCELLED" && (
          <span className="text-[11px] text-slate-500 max-w-[14rem] leading-tight">
            {appt.statusNote}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[12rem]">
      <select
        value={pendingStatus}
        onChange={(e) =>
          setPendingStatus(e.target.value as "SCHEDULED" | "KEPT" | "NO_SHOW")
        }
        disabled={saving}
        className="h-8 rounded border border-slate-300 bg-white px-2 text-xs hover:border-[#0085CA] focus:outline-none focus:ring-2 focus:ring-[#0085CA]/30 disabled:opacity-60"
      >
        <option value="SCHEDULED">Scheduled</option>
        <option value="KEPT">Kept</option>
        <option value="NO_SHOW">No Show</option>
      </select>
      <Input
        value={pendingNote}
        onChange={(e) => setPendingNote(e.target.value)}
        disabled={saving}
        placeholder="Note for branch (optional)"
        className="h-8 text-xs"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
        >
          {saving ? <Loader2 className="size-3 animate-spin" /> : null}
          Save
        </button>
        {savedAt && !dirty && !err && (
          <span className="text-[11px] text-emerald-600">Saved</span>
        )}
        {err && (
          <span className="text-[11px] text-rose-600 leading-tight">{err}</span>
        )}
      </div>
    </div>
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
