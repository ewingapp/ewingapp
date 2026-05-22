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
import {
  ptFmtDateShort,
  ptFmtTime,
  ptTodayIso,
} from "@/lib/pt";
import { isLateCancel } from "@/lib/late-cancel";

type Appt = {
  id: string;
  startTime: string;
  caseNumber: string;
  status: string;
  cancelledBy: "BRANCH" | "VENDOR" | null;
  cancelledByName: string;
  cancelledAt: string | null;
  isLateCancellation: boolean;
  statusNote: string;
  doctor: { id: string; name: string; firstName: string; lastName: string };
  location: { id: string; name: string };
};

type SortKey = "office" | "doctor" | "date" | "time" | "case" | "status";

function doctorLabel(d: { firstName: string; lastName: string; name?: string }): string {
  const last = (d.lastName ?? "").trim();
  const first = (d.firstName ?? "").trim();
  if (last && first) return `${last}, ${first}`;
  return (last || first || d.name || "").trim();
}

function notesPlain(a: Appt): string {
  const parts: string[] = [];
  if (a.cancelledBy === "BRANCH") {
    parts.push(`Canceled by ${a.cancelledByName || "Branch"}`);
  } else if (a.cancelledBy === "VENDOR") {
    parts.push(
      a.statusNote
        ? `Vendor canceled. Reason: ${a.statusNote}`
        : `Vendor canceled${a.cancelledByName ? ` (${a.cancelledByName})` : ""}`,
    );
  } else if (a.statusNote) {
    parts.push(a.statusNote);
  }
  if (a.cancelledAt) {
    parts.push(`on ${ptFmtDateShort(a.cancelledAt)} ${ptFmtTime(a.cancelledAt)}`);
  }
  if (isLateCancel(a)) parts.push("Canceled < 48 hours");
  return parts.join("; ");
}

export default function CancellationReportPage() {
  const today = ptTodayIso();
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
    if (!m) return today;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setDate(d.getDate() + 10);
    const y = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  });

  const [rows, setRows] = useState<Appt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
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
      const res = await fetch(`/api/reports/cancellations?${qs}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Appt[];
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

  const sorted = useMemo<Appt[]>(() => {
    if (!rows) return [];
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: Appt, b: Appt) => {
      switch (sortKey) {
        case "office":
          return a.location.name.localeCompare(b.location.name) * dir;
        case "doctor":
          return doctorLabel(a.doctor).localeCompare(doctorLabel(b.doctor)) * dir;
        case "date":
        case "time":
          return (
            (new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) *
            dir
          );
        case "case":
          return a.caseNumber.localeCompare(b.caseNumber) * dir;
        case "status":
          // Group late cancels first when asc; alphabetical fallback by case#.
          return (
            (Number(isLateCancel(b)) - Number(isLateCancel(a))) * dir ||
            a.caseNumber.localeCompare(b.caseNumber) * dir
          );
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
      "Office",
      "Doctor",
      "Date",
      "Time",
      "Case Number",
      "Status",
      "Notes",
    ];
    const lines = [head.join(",")];
    for (const a of sorted) {
      const cols = [
        a.location.name,
        doctorLabel(a.doctor),
        ptFmtDateShort(a.startTime),
        ptFmtTime(a.startTime),
        a.caseNumber,
        isLateCancel(a) ? "Canceled (< 48h)" : "Canceled",
        notesPlain(a),
      ].map((v) => {
        const s = String(v ?? "");
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      });
      lines.push(cols.join(","));
    }
    // UTF-8 BOM + CRLF so Excel parses cleanly.
    const csv = "﻿" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cancellations-${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasResults = rows !== null;

  return (
    <AppShell>
      <div className="max-w-[1200px] mx-auto px-6 py-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to Reports
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">
          Cancellation Report
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          All cancelled appointments within a date range. Rows cancelled less
          than 48 hours before the appointment are highlighted in red.
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
              Start Search
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
                      <Th sortKey="office" current={sortKey} dir={sortDir} onSort={onSort}>
                        Office
                      </Th>
                      <Th sortKey="doctor" current={sortKey} dir={sortDir} onSort={onSort}>
                        Doctor
                      </Th>
                      <Th sortKey="date" current={sortKey} dir={sortDir} onSort={onSort}>
                        Date
                      </Th>
                      <Th sortKey="time" current={sortKey} dir={sortDir} onSort={onSort}>
                        Time
                      </Th>
                      <Th sortKey="case" current={sortKey} dir={sortDir} onSort={onSort}>
                        Case Number
                      </Th>
                      <Th sortKey="status" current={sortKey} dir={sortDir} onSort={onSort}>
                        Status
                      </Th>
                      <th className="px-3 py-2 text-left font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                          No cancelled appointments in this range.
                        </td>
                      </tr>
                    )}
                    {sorted.map((a) => {
                      const late = isLateCancel(a);
                      return (
                        <tr
                          key={a.id}
                          className={`border-t border-slate-100 align-top ${late ? "bg-rose-50" : ""}`}
                        >
                          <td className="px-3 py-2">{a.location.name}</td>
                          <td className="px-3 py-2">{doctorLabel(a.doctor)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {ptFmtDateShort(a.startTime)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {ptFmtTime(a.startTime)}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{a.caseNumber}</td>
                          <td className="px-3 py-2">
                            <span
                              className={
                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset " +
                                (late
                                  ? "bg-rose-100 text-rose-800 ring-rose-300"
                                  : "bg-slate-100 text-slate-700 ring-slate-200")
                              }
                              title={
                                late
                                  ? "Cancelled less than 48 hours before the appointment"
                                  : undefined
                              }
                            >
                              Canceled{late ? " • < 48h" : ""}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs leading-snug max-w-[28rem]">
                            <NotesCell appt={a} late={late} />
                          </td>
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

function NotesCell({ appt, late }: { appt: Appt; late: boolean }) {
  const lines: React.ReactNode[] = [];
  if (appt.cancelledBy === "BRANCH") {
    lines.push(`Canceled by ${appt.cancelledByName || "Branch"}`);
  } else if (appt.cancelledBy === "VENDOR") {
    lines.push(
      appt.statusNote
        ? `Vendor canceled. Reason: ${appt.statusNote}`
        : `Vendor canceled${appt.cancelledByName ? ` (${appt.cancelledByName})` : ""}`,
    );
  } else if (appt.statusNote) {
    lines.push(appt.statusNote);
  }
  if (appt.cancelledAt) {
    lines.push(
      <span className="text-slate-500">
        on {ptFmtDateShort(appt.cancelledAt)} {ptFmtTime(appt.cancelledAt)}
      </span>,
    );
  }
  return (
    <div className="space-y-0.5">
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
      {late && (
        <div className="text-rose-700 font-semibold">Canceled &lt; 48 hours</div>
      )}
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
