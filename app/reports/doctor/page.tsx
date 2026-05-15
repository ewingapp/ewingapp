"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Download,
  Loader2,
  Search,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ptFmtDateShort, ptFmtTime, ptTodayIso } from "@/lib/pt";

const ALL = "__all__";

type Doctor = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  active: boolean;
};

type Location = { id: string; name: string };

type Appt = {
  id: string;
  startTime: string;
  caseNumber: string;
  firstInitial: string;
  lastNamePrefix: string;
  claimantPhone: string;
  analystName: string;
  stateBranch: string;
  doctor: { id: string; name: string; firstName: string; lastName: string };
  specialty: { id: string; name: string; code: string };
  location: { id: string; name: string };
};

type SortKey =
  | "doctor"
  | "office"
  | "date"
  | "time"
  | "case"
  | "lastName"
  | "firstName"
  | "phone"
  | "analyst"
  | "branch"
  | "exam";

function doctorLabel(d: { firstName: string; lastName: string; name?: string }): string {
  const last = (d.lastName ?? "").trim();
  const first = (d.firstName ?? "").trim();
  if (last && first) return `${last}, ${first}`;
  return (last || first || d.name || "").trim();
}

function examDisplay(s: { code: string; name: string }): string {
  return s.code ? `${s.code}-${s.name}` : s.name;
}

function addDaysIso(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export default function DoctorReportPage() {
  const today = ptTodayIso();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [doctorId, setDoctorId] = useState<string>(ALL);
  const [locationId, setLocationId] = useState<string>(ALL);
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(() => addDaysIso(today, 21));

  const [rows, setRows] = useState<Appt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Track in-flight inline reassignments so we can disable the row while it
  // saves and surface the per-row error if it fails.
  const [pendingByAppt, setPendingByAppt] = useState<Record<string, boolean>>({});
  const [errorByAppt, setErrorByAppt] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((data: Doctor[]) => setDoctors(data.filter((d) => d.active)))
      .catch(() => setDoctors([]));
    fetch("/api/locations")
      .then((r) => r.json())
      .then((data: Location[]) => setLocations(data))
      .catch(() => setLocations([]));
  }, []);

  const selectedDoctorLabel = useMemo(() => {
    if (doctorId === ALL) return "All Doctors";
    const d = doctors.find((x) => x.id === doctorId);
    return d ? doctorLabel(d) : "All Doctors";
  }, [doctors, doctorId]);

  const selectedLocationLabel = useMemo(() => {
    if (locationId === ALL) return "All Offices";
    const l = locations.find((x) => x.id === locationId);
    return l ? l.name : "All Offices";
  }, [locations, locationId]);

  async function runSearch() {
    if (toDate < fromDate) {
      setError("'To Date' must be on or after 'From Date'.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from: fromDate, to: toDate });
      if (doctorId !== ALL) qs.set("doctorId", doctorId);
      if (locationId !== ALL) qs.set("locationId", locationId);
      const res = await fetch(`/api/reports/doctor?${qs}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Appt[];
      setRows(data);
      setErrorByAppt({});
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function resetSearch() {
    setRows(null);
    setError(null);
    setErrorByAppt({});
  }

  async function reassignDoctor(appt: Appt, nextDoctorId: string) {
    if (!nextDoctorId || nextDoctorId === appt.doctor.id) return;
    setPendingByAppt((p) => ({ ...p, [appt.id]: true }));
    setErrorByAppt((p) => {
      const { [appt.id]: _drop, ...rest } = p;
      return rest;
    });
    try {
      const res = await fetch(`/api/appointments/${appt.id}/doctor`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId: nextDoctorId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Reassignment failed");
      }
      const updated = (await res.json()) as { doctor: Appt["doctor"] };
      setRows((prev) =>
        prev
          ? prev.map((r) =>
              r.id === appt.id ? { ...r, doctor: updated.doctor } : r,
            )
          : prev,
      );
    } catch (e) {
      setErrorByAppt((p) => ({
        ...p,
        [appt.id]: e instanceof Error ? e.message : "Reassignment failed",
      }));
    } finally {
      setPendingByAppt((p) => {
        const { [appt.id]: _drop, ...rest } = p;
        return rest;
      });
    }
  }

  const sorted = useMemo<Appt[]>(() => {
    if (!rows) return [];
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: Appt, b: Appt) => {
      switch (sortKey) {
        case "doctor":
          return doctorLabel(a.doctor).localeCompare(doctorLabel(b.doctor)) * dir;
        case "office":
          return a.location.name.localeCompare(b.location.name) * dir;
        case "date":
        case "time":
          return (
            (new Date(a.startTime).getTime() -
              new Date(b.startTime).getTime()) *
            dir
          );
        case "case":
          return a.caseNumber.localeCompare(b.caseNumber) * dir;
        case "lastName":
          return a.lastNamePrefix.localeCompare(b.lastNamePrefix) * dir;
        case "firstName":
          return a.firstInitial.localeCompare(b.firstInitial) * dir;
        case "phone":
          return a.claimantPhone.localeCompare(b.claimantPhone) * dir;
        case "analyst":
          return a.analystName.localeCompare(b.analystName) * dir;
        case "branch":
          return a.stateBranch.localeCompare(b.stateBranch) * dir;
        case "exam":
          return examDisplay(a.specialty).localeCompare(examDisplay(b.specialty)) * dir;
      }
    };
    return [...rows].sort(cmp);
  }, [rows, sortKey, sortDir]);

  function onSort(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  function downloadCsv() {
    if (!sorted.length) return;
    const head = [
      "Doctor",
      "Office",
      "Date",
      "Time",
      "Case #",
      "Last Name",
      "First Name",
      "Phone",
      "Analyst",
      "Branch",
      "Exam",
    ];
    const lines = [head.join(",")];
    for (const a of sorted) {
      const cols = [
        doctorLabel(a.doctor),
        a.location.name,
        ptFmtDateShort(a.startTime),
        ptFmtTime(a.startTime),
        a.caseNumber,
        a.lastNamePrefix,
        a.firstInitial,
        a.claimantPhone,
        a.analystName,
        a.stateBranch,
        examDisplay(a.specialty),
      ].map((v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      });
      lines.push(cols.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doctor-report-${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasResults = rows !== null;

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to Reports
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">
          Doctor Report
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          All appointments for the selected doctor / office within a date
          range. Change a row's doctor inline — the appointment will move to
          the new doctor's schedule.
        </p>

        <div
          className="bg-white rounded-lg shadow-sm p-4 mb-6"
          style={{ border: "1.5px solid #CBD5E1" }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56">
              <Label className="text-xs font-medium text-slate-700 mb-1 block">
                Doctor
              </Label>
              <Select
                value={doctorId}
                onValueChange={(v) => setDoctorId(v ?? ALL)}
              >
                <SelectTrigger className="w-full">
                  <span data-slot="select-value">{selectedDoctorLabel}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All Doctors</SelectItem>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {doctorLabel(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-44">
              <Label className="text-xs font-medium text-slate-700 mb-1 block">
                Office
              </Label>
              <Select
                value={locationId}
                onValueChange={(v) => setLocationId(v ?? ALL)}
              >
                <SelectTrigger className="w-full">
                  <span data-slot="select-value">{selectedLocationLabel}</span>
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
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700 mb-1 block">
                From Date
              </Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-40"
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-700 mb-1 block">
                To Date
              </Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-40"
              />
            </div>

            <button
              type="button"
              onClick={runSearch}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm hover:brightness-95 disabled:opacity-50"
              style={{ background: "#0085CA", border: "2px solid #0085CA" }}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Display Report
            </button>

            {hasResults && (
              <button
                type="button"
                onClick={resetSearch}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
                style={{ border: "1.5px solid #CBD5E1" }}
              >
                Clear
              </button>
            )}
          </div>

          {error && <p className="text-sm text-destructive mt-3">{error}</p>}
        </div>

        {hasResults && (
          <>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Results
                <span className="text-slate-500 font-normal ml-2">
                  ({sorted.length})
                </span>
              </h2>
              <button
                type="button"
                onClick={downloadCsv}
                disabled={!sorted.length}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-white shadow-sm hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#0085CA", border: "2px solid #0085CA" }}
              >
                <Download className="size-3.5" />
                Download CSV
              </button>
            </div>

            <div
              className="bg-white rounded-lg shadow-sm overflow-hidden"
              style={{ border: "1.5px solid #CBD5E1" }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Edit</th>
                      <Th sortKey="doctor" current={sortKey} dir={sortDir} onSort={onSort}>
                        Doctor
                      </Th>
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
                        Case #
                      </Th>
                      <Th sortKey="lastName" current={sortKey} dir={sortDir} onSort={onSort}>
                        Last Name
                      </Th>
                      <Th sortKey="firstName" current={sortKey} dir={sortDir} onSort={onSort}>
                        First Name
                      </Th>
                      <th className="px-3 py-2 text-left font-semibold">DOB</th>
                      <Th sortKey="phone" current={sortKey} dir={sortDir} onSort={onSort}>
                        Phone
                      </Th>
                      <Th sortKey="analyst" current={sortKey} dir={sortDir} onSort={onSort}>
                        Analyst
                      </Th>
                      <Th sortKey="branch" current={sortKey} dir={sortDir} onSort={onSort}>
                        Branch
                      </Th>
                      <Th sortKey="exam" current={sortKey} dir={sortDir} onSort={onSort}>
                        Exam
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 && (
                      <tr>
                        <td colSpan={13} className="px-3 py-6 text-center text-slate-500">
                          No appointments match these filters.
                        </td>
                      </tr>
                    )}
                    {sorted.map((a) => {
                      const pending = !!pendingByAppt[a.id];
                      const rowError = errorByAppt[a.id];
                      return (
                        <tr key={a.id} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-2">
                            <Link
                              href={`/appointments?caseNumber=${encodeURIComponent(a.caseNumber)}`}
                              className="text-sm text-[#0085CA] hover:underline"
                            >
                              Edit
                            </Link>
                          </td>
                          <td className="px-3 py-2 min-w-44">
                            <Select
                              value={a.doctor.id}
                              onValueChange={(v) => v && reassignDoctor(a, v)}
                              disabled={pending}
                            >
                              <SelectTrigger className="w-full">
                                <span data-slot="select-value">
                                  {doctorLabel(a.doctor)}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {doctors.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {doctorLabel(d)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {pending && (
                              <span className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1">
                                <Loader2 className="size-3 animate-spin" />
                                Saving…
                              </span>
                            )}
                            {rowError && (
                              <p className="text-xs text-destructive mt-1">
                                {rowError}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2">{a.location.name}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {ptFmtDateShort(a.startTime)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {ptFmtTime(a.startTime)}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{a.caseNumber}</td>
                          <td className="px-3 py-2">{a.lastNamePrefix}</td>
                          <td className="px-3 py-2">{a.firstInitial}</td>
                          <td className="px-3 py-2 text-slate-400">—</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {a.claimantPhone || (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{a.analystName}</td>
                          <td className="px-3 py-2">{a.stateBranch}</td>
                          <td className="px-3 py-2">{examDisplay(a.specialty)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
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
