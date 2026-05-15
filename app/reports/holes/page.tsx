"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Download,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ptFmtDateLong, ptTodayIso } from "@/lib/pt";
import { getCaHolidaysRange } from "@/lib/ca-holidays";

type Row = {
  doctorId: string;
  doctorName: string;
  doctorFirstName: string;
  doctorLastName: string;
  locationId: string;
  locationName: string;
  scheduledMinutes: number;
  bookedMinutes: number;
  freeMinutes: number;
  appointmentCount: number;
};

type SortKey = "doctor" | "office" | "free" | "booked";

function doctorLabel(r: Row): string {
  const last = (r.doctorLastName ?? "").trim();
  const first = (r.doctorFirstName ?? "").trim();
  if (last && first) return `${last}, ${first}`;
  return (last || first || r.doctorName).trim();
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

function parseIsoDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export default function HolesReportPage() {
  const today = ptTodayIso();
  const [date, setDate] = useState<Date>(() => parseIsoDate(today) ?? new Date());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("doctor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const dateIso = useMemo(() => isoFromDate(date), [date]);
  const caHolidays = useMemo(() => getCaHolidaysRange(2), []);

  async function runReport() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/holes?date=${dateIso}`);
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

  const sorted = useMemo<Row[]>(() => {
    if (!rows) return [];
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: Row, b: Row) => {
      switch (sortKey) {
        case "doctor":
          return doctorLabel(a).localeCompare(doctorLabel(b)) * dir;
        case "office":
          return a.locationName.localeCompare(b.locationName) * dir;
        case "free":
          return (a.freeMinutes - b.freeMinutes) * dir;
        case "booked":
          return (a.appointmentCount - b.appointmentCount) * dir;
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
    const head = ["Doctor", "Office", "Open Time", "Appointments Booked"];
    const lines = [head.join(",")];
    for (const r of sorted) {
      const cols = [
        doctorLabel(r),
        r.locationName,
        fmtMinutes(r.freeMinutes),
        String(r.appointmentCount),
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
    a.download = `holes-${dateIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasResults = rows !== null;

  return (
    <AppShell>
      <div className="max-w-[1100px] mx-auto px-6 py-6">
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to Reports
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900 mb-1">
          Holes Report
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          All doctors who have a hole — at least one appointment booked AND
          still some open time — in their schedule for the chosen day.
        </p>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <div className="shrink-0">
            <div className="text-sm font-medium text-slate-800 mb-2">
              Choose the date:
            </div>
            <div
              className="bg-white rounded-lg shadow-sm p-3 ewing-calendar mb-3"
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
            <button
              type="button"
              onClick={runReport}
              disabled={loading}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm hover:brightness-95 disabled:opacity-50 w-full justify-center"
              style={{ background: "#0085CA", border: "2px solid #0085CA" }}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Go
            </button>
            {error && (
              <p className="text-sm text-destructive mt-3">{error}</p>
            )}
          </div>

          <div className="flex-1 min-w-0 w-full">
            {hasResults && (
              <>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-base font-semibold text-slate-900">
                    Doctors with holes on {ptFmtDateLong(date)}
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
                          <Th sortKey="doctor" current={sortKey} dir={sortDir} onSort={onSort}>
                            Doctor
                          </Th>
                          <Th sortKey="office" current={sortKey} dir={sortDir} onSort={onSort}>
                            Office
                          </Th>
                          <Th sortKey="free" current={sortKey} dir={sortDir} onSort={onSort}>
                            Open Time
                          </Th>
                          <Th sortKey="booked" current={sortKey} dir={sortDir} onSort={onSort}>
                            Booked
                          </Th>
                          <th className="px-3 py-2 text-left font-semibold">Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                              No doctors have holes in their schedule on this date.
                            </td>
                          </tr>
                        )}
                        {sorted.map((r) => (
                          <tr
                            key={`${r.doctorId}__${r.locationId}`}
                            className="border-t border-slate-100"
                          >
                            <td className="px-3 py-2">{doctorLabel(r)}</td>
                            <td className="px-3 py-2">{r.locationName}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {fmtMinutes(r.freeMinutes)}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {r.appointmentCount}
                            </td>
                            <td className="px-3 py-2">
                              <Link
                                href={`/appointments?by=doctor&doctorId=${encodeURIComponent(r.doctorId)}&from=${dateIso}&to=${dateIso}`}
                                className="inline-flex items-center gap-1 text-sm text-[#0085CA] hover:underline"
                              >
                                Go To
                                <ExternalLink className="size-3" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
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
