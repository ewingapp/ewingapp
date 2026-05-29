"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { ArrowLeft, ArrowUp, ArrowDown, Download, Loader2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ptFmtDateShort, ptFmtTime, ptTodayIso } from "@/lib/pt";
import { getCaHolidaysRange } from "@/lib/ca-holidays";

type Appt = {
  id: string;
  startTime: string;
  createdAt: string;
  caseNumber: string;
  firstInitial: string;
  lastNamePrefix: string;
  doctor: { id: string; name: string; firstName: string; lastName: string };
  specialty: { id: string; name: string; code: string };
  location: { id: string; name: string };
};

type SortKey = "clinic" | "claimant" | "date" | "time" | "doctor" | "exam";

function doctorDisplay(d: { firstName: string; lastName: string }): string {
  const last = d.lastName.trim();
  const first = d.firstName.trim();
  if (last && first) return `${last}, ${first}`;
  return (last || first).trim();
}

function examDisplay(s: { code: string; name: string }): string {
  return s.code ? `${s.code}-${s.name}` : s.name;
}

function parseIsoDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export default function AppointmentsMadeReportPage() {
  const todayIso = ptTodayIso();
  const [date, setDate] = useState<Date>(() => parseIsoDate(todayIso) ?? new Date());
  const [rows, setRows] = useState<Appt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("clinic");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const dateIso = useMemo(() => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [date]);

  const caHolidays = useMemo(() => getCaHolidaysRange(2), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/reports/appointments-made?date=${dateIso}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return (await r.json()) as Appt[];
      })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setRows([]);
          setError(e instanceof Error ? e.message : "Failed to load report");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateIso]);

  const sorted = useMemo<Appt[]>(() => {
    if (!rows) return [];
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: Appt, b: Appt) => {
      switch (sortKey) {
        case "clinic":
          return a.location.name.localeCompare(b.location.name) * dir;
        case "claimant":
          return (
            `${a.lastNamePrefix},${a.firstInitial}`.localeCompare(
              `${b.lastNamePrefix},${b.firstInitial}`,
            ) * dir
          );
        case "date":
        case "time":
          return (
            (new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) *
            dir
          );
        case "doctor":
          return doctorDisplay(a.doctor).localeCompare(doctorDisplay(b.doctor)) * dir;
        case "exam":
          return examDisplay(a.specialty).localeCompare(examDisplay(b.specialty)) * dir;
      }
    };
    return [...rows].sort(cmp);
  }, [rows, sortKey, sortDir]);

  function onSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  function downloadCsv() {
    if (!sorted.length) return;
    const head = ["Clinic", "Claimant", "Date", "Time", "Doctor", "Exam", "Tests"];
    const lines = [head.join(",")];
    for (const a of sorted) {
      const cols = [
        a.location.name,
        `${a.lastNamePrefix}, ${a.firstInitial}`,
        ptFmtDateShort(a.startTime),
        ptFmtTime(a.startTime),
        doctorDisplay(a.doctor),
        examDisplay(a.specialty),
        "",
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
    a.download = `appointments-made-${dateIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to Reports
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">
          Appointments Made Report
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          All appointments scheduled on the selected date. Click any column to
          sort.
        </p>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="shrink-0">
            <div className="text-sm font-medium text-slate-800 mb-2">
              Choose the date:
            </div>
            <div
              className="bg-white rounded-lg shadow-sm p-3 ewing-calendar"
              style={{ border: "1.5px solid #CBD5E1" }}
            >
              <DayPicker
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                weekStartsOn={0}
                modifiers={{ holiday: caHolidays }}
                modifiersClassNames={{ holiday: "rdp-day-holiday" }}
              />
            </div>
          </div>

          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Appointments made on{" "}
                {ptFmtDateShort(
                  new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                )}
                {rows ? (
                  <span className="text-slate-500 font-normal ml-2">
                    ({rows.length})
                  </span>
                ) : null}
              </h2>
              <button
                type="button"
                onClick={downloadCsv}
                disabled={!sorted.length}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-white shadow-sm hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#06B6D4", border: "2px solid #06B6D4" }}
              >
                <Download className="size-3.5" />
                Download CSV
              </button>
            </div>

            {error && (
              <p className="text-sm text-destructive mb-3">{error}</p>
            )}

            <div
              className="bg-white rounded-lg shadow-sm overflow-hidden"
              style={{ border: "1.5px solid #CBD5E1" }}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <Th sortKey="clinic" current={sortKey} dir={sortDir} onSort={onSort}>
                        Clinic
                      </Th>
                      <Th sortKey="claimant" current={sortKey} dir={sortDir} onSort={onSort}>
                        Claimant
                      </Th>
                      <Th sortKey="date" current={sortKey} dir={sortDir} onSort={onSort}>
                        Date
                      </Th>
                      <Th sortKey="time" current={sortKey} dir={sortDir} onSort={onSort}>
                        Time
                      </Th>
                      <Th sortKey="doctor" current={sortKey} dir={sortDir} onSort={onSort}>
                        Doctor
                      </Th>
                      <Th sortKey="exam" current={sortKey} dir={sortDir} onSort={onSort}>
                        Exam
                      </Th>
                      <th className="px-3 py-2 text-left font-semibold">Tests</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                          <Loader2 className="size-4 animate-spin inline mr-2" />
                          Loading…
                        </td>
                      </tr>
                    )}
                    {!loading && sorted.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                          No appointments were scheduled on this date.
                        </td>
                      </tr>
                    )}
                    {!loading &&
                      sorted.map((a) => (
                        <tr key={a.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{a.location.name}</td>
                          <td className="px-3 py-2">
                            {a.lastNamePrefix}, {a.firstInitial}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {ptFmtDateShort(a.startTime)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {ptFmtTime(a.startTime)}
                          </td>
                          <td className="px-3 py-2">{doctorDisplay(a.doctor)}</td>
                          <td className="px-3 py-2">{examDisplay(a.specialty)}</td>
                          <td className="px-3 py-2 text-slate-400">—</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
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
