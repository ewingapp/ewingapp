"use client";

import { useMemo, useState } from "react";
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
import { ptTodayIso } from "@/lib/pt";

type Row = {
  doctorId: string;
  doctorName: string;
  doctorFirstName: string;
  doctorLastName: string;
  totalSlots: number;
  // The shared /api/reports/total-slots endpoint returns this field as
  // "scheduled"; this report displays it as "Total Appointments".
  scheduled: number;
  pctFilled: number;
};

type SortKey = "doctor" | "total" | "appointments" | "pct";

function doctorLabel(r: Row): string {
  const last = (r.doctorLastName ?? "").trim();
  const first = (r.doctorFirstName ?? "").trim();
  if (last && first) return `${last}, ${first}`;
  return (last || first || r.doctorName).trim();
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

export default function DoctorSchedulingReportPage() {
  const today = ptTodayIso();
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(() => addDaysIso(today, 5));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("doctor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  async function runSearch() {
    if (toDate < fromDate) {
      setError("'To Date' must be on or after 'From Date'.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams({ from: fromDate, to: toDate });
      const res = await fetch(`/api/reports/total-slots?${qs}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Row[];
      setRows(data);
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
  }

  const sorted = useMemo<Row[]>(() => {
    if (!rows) return [];
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: Row, b: Row) => {
      switch (sortKey) {
        case "doctor":
          return doctorLabel(a).localeCompare(doctorLabel(b)) * dir;
        case "total":
          return (a.totalSlots - b.totalSlots) * dir;
        case "appointments":
          return (a.scheduled - b.scheduled) * dir;
        case "pct":
          return (a.pctFilled - b.pctFilled) * dir;
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
    const head = ["Doctor", "Total Slots", "Total Appointments", "% Scheduled"];
    const lines = [head.join(",")];
    for (const r of sorted) {
      const cols = [
        doctorLabel(r),
        String(r.totalSlots),
        String(r.scheduled),
        String(r.pctFilled),
      ].map((v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      });
      lines.push(cols.join(","));
    }
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doctor-scheduling-${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasResults = rows !== null;
  const totals = useMemo(() => {
    if (!sorted.length) return null;
    const tot = sorted.reduce((s, r) => s + r.totalSlots, 0);
    const sch = sorted.reduce((s, r) => s + r.scheduled, 0);
    const pct = tot > 0 ? Math.round((sch / tot) * 100) : 0;
    return { tot, sch, pct, empty: tot - sch };
  }, [sorted]);

  function pctClass(p: number): string {
    if (p >= 90) return "text-emerald-700 font-semibold";
    if (p >= 70) return "text-emerald-700";
    if (p >= 40) return "text-amber-700";
    return "text-rose-700";
  }

  return (
    <AppShell>
      <div className="max-w-[1000px] mx-auto px-6 py-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to Reports
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">
          Doctor Scheduling Report
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          For each active doctor with schedules in the date range: total slots
          created and total appointments booked, plus the percentage of created
          slots that were filled.
        </p>

        <div
          className="bg-white rounded-lg shadow-sm p-4 mb-6"
          style={{ border: "1.5px solid #CBD5E1" }}
        >
          <div className="flex flex-wrap items-end gap-3">
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
              {hasResults ? "New Search" : "Start Search"}
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
                Search Results
                <span className="text-slate-500 font-normal ml-2">
                  ({sorted.length} doctor{sorted.length === 1 ? "" : "s"}
                  {totals ? `, ${totals.empty} empty slots` : ""})
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
                      <Th sortKey="doctor" current={sortKey} dir={sortDir} onSort={onSort}>
                        Doctor
                      </Th>
                      <Th sortKey="total" current={sortKey} dir={sortDir} onSort={onSort}>
                        Total Slots
                      </Th>
                      <Th sortKey="appointments" current={sortKey} dir={sortDir} onSort={onSort}>
                        Total Appointments
                      </Th>
                      <Th sortKey="pct" current={sortKey} dir={sortDir} onSort={onSort}>
                        % Scheduled
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          No doctors have schedules in this range.
                        </td>
                      </tr>
                    )}
                    {sorted.map((r) => (
                      <tr key={r.doctorId} className="border-t border-slate-100">
                        <td className="px-3 py-2">{doctorLabel(r)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.totalSlots}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.scheduled}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${pctClass(r.pctFilled)}`}>
                          {r.pctFilled}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {totals && (
                    <tfoot className="bg-slate-50 text-slate-700">
                      <tr className="border-t border-slate-200">
                        <td className="px-3 py-2 font-semibold">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">
                          {totals.tot}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">
                          {totals.sch}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${pctClass(totals.pct)}`}>
                          {totals.pct}
                        </td>
                      </tr>
                    </tfoot>
                  )}
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
