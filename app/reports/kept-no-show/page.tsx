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
import { ptFmtDateShort, ptFmtTime, ptTodayIso } from "@/lib/pt";

type Appt = {
  id: string;
  startTime: string;
  caseNumber: string;
  firstInitial: string;
  lastNamePrefix: string;
  stateBranch: string;
  statusNote: string;
  doctor: { id: string; name: string; firstName: string; lastName: string };
  specialty: { id: string; name: string; code: string };
  location: { id: string; name: string };
};

type Result = {
  keptCount: number;
  noShowCount: number;
  noShows: Appt[];
};

type SortKey =
  | "office"
  | "doctor"
  | "date"
  | "time"
  | "case"
  | "claimant"
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

function fmtRangeLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[2]}/${m[3]}/${m[1]}`;
}

export default function KeptNoShowReportPage() {
  const today = ptTodayIso();
  const [fromDate, setFromDate] = useState<string>(() => addDaysIso(today, -14));
  const [toDate, setToDate] = useState<string>(today);

  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showNoShows, setShowNoShows] = useState(false);
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
      const res = await fetch(`/api/reports/kept-no-show?${qs}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Result;
      setResult(data);
      setShowNoShows(false);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  function resetSearch() {
    setResult(null);
    setShowNoShows(false);
    setError(null);
  }

  const sortedNoShows = useMemo<Appt[]>(() => {
    if (!result) return [];
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
            (new Date(a.startTime).getTime() -
              new Date(b.startTime).getTime()) *
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
        case "branch":
          return a.stateBranch.localeCompare(b.stateBranch) * dir;
        case "exam":
          return examDisplay(a.specialty).localeCompare(examDisplay(b.specialty)) * dir;
      }
    };
    return [...result.noShows].sort(cmp);
  }, [result, sortKey, sortDir]);

  function onSort(k: SortKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  function downloadNoShowsCsv() {
    if (!sortedNoShows.length) return;
    const head = [
      "Office",
      "Doctor",
      "Date",
      "Time",
      "Case #",
      "Claimant",
      "Branch",
      "Exam",
      "Note",
    ];
    const lines = [head.join(",")];
    for (const a of sortedNoShows) {
      const cols = [
        a.location.name,
        doctorLabel(a.doctor),
        ptFmtDateShort(a.startTime),
        ptFmtTime(a.startTime),
        a.caseNumber,
        `${a.lastNamePrefix}, ${a.firstInitial}`,
        a.stateBranch,
        examDisplay(a.specialty),
        a.statusNote,
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
    a.download = `no-shows-${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasResults = result !== null;

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
          Kept and No-Show Report
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          A count of all kept and no-show appointments in a date range. Click
          &ldquo;Display NoShows&rdquo; after running the search for the
          detail rows.
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
            <div
              className="bg-white rounded-lg shadow-sm p-4 mb-4"
              style={{ border: "1.5px solid #CBD5E1" }}
            >
              <p className="text-sm text-slate-800">
                From <span className="font-medium">{fmtRangeLabel(fromDate)}</span>{" "}
                To <span className="font-medium">{fmtRangeLabel(toDate)}</span>:{" "}
                Kept Appointments:{" "}
                <span className="font-semibold tabular-nums">
                  {result.keptCount}
                </span>
                , NoShow Appointments:{" "}
                <span className="font-semibold tabular-nums text-rose-700">
                  {result.noShowCount}
                </span>
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNoShows((v) => !v)}
                  disabled={result.noShowCount === 0}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-white shadow-sm hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "#0085CA", border: "2px solid #0085CA" }}
                >
                  {showNoShows ? "Hide NoShows" : "Display NoShows"}
                </button>
                {showNoShows && result.noShowCount > 0 && (
                  <button
                    type="button"
                    onClick={downloadNoShowsCsv}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50"
                    style={{ border: "1.5px solid #CBD5E1" }}
                  >
                    <Download className="size-3.5" />
                    Download CSV
                  </button>
                )}
              </div>
            </div>

            {showNoShows && result.noShowCount > 0 && (
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
                          Case #
                        </Th>
                        <Th sortKey="claimant" current={sortKey} dir={sortDir} onSort={onSort}>
                          Claimant
                        </Th>
                        <Th sortKey="branch" current={sortKey} dir={sortDir} onSort={onSort}>
                          Branch
                        </Th>
                        <Th sortKey="exam" current={sortKey} dir={sortDir} onSort={onSort}>
                          Exam
                        </Th>
                        <th className="px-3 py-2 text-left font-semibold">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedNoShows.map((a) => (
                        <tr key={a.id} className="border-t border-slate-100">
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
                            {a.lastNamePrefix}, {a.firstInitial}
                          </td>
                          <td className="px-3 py-2">{a.stateBranch}</td>
                          <td className="px-3 py-2">{examDisplay(a.specialty)}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 max-w-[20rem]">
                            {a.statusNote || (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
