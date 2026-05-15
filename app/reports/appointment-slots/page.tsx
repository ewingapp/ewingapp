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

type Doctor = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  active: boolean;
};

type SlotRow = {
  startTime: string;
  endTime: string;
  locationId: string;
  locationName: string;
  slotType: "ANY" | "LOOKALIKE" | "PSYCH_TESTING";
};

type SortKey = "office" | "date" | "time" | "slotType";

function doctorLabel(d: Doctor): string {
  const last = d.lastName.trim();
  const first = d.firstName.trim();
  if (last && first) return `${last}, ${first}`;
  return (last || first || d.name).trim();
}

function slotTypeLabel(t: SlotRow["slotType"]): string {
  switch (t) {
    case "LOOKALIKE":
      return "LookAlike only";
    case "PSYCH_TESTING":
      return "Psych Testing only";
    default:
      return "Any";
  }
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

export default function AppointmentSlotsReportPage() {
  const today = ptTodayIso();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(today);
  const [toDate, setToDate] = useState<string>(() => addDaysIso(today, 45));

  const [rows, setRows] = useState<SlotRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const selectedDoctorLabel = useMemo(() => {
    const d = doctors.find((x) => x.id === doctorId);
    return d ? doctorLabel(d) : "";
  }, [doctors, doctorId]);

  useEffect(() => {
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((data: Doctor[]) => {
        setDoctors(data.filter((d) => d.active));
      })
      .catch(() => setDoctors([]));
  }, []);

  async function runSearch() {
    if (!doctorId) {
      setError("Please choose a doctor.");
      return;
    }
    if (toDate < fromDate) {
      setError("'To Date' must be on or after 'From Date'.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        doctorId,
        from: fromDate,
        to: toDate,
      });
      const res = await fetch(`/api/reports/appointment-slots?${qs}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as SlotRow[];
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

  const sorted = useMemo<SlotRow[]>(() => {
    if (!rows) return [];
    const dir = sortDir === "asc" ? 1 : -1;
    const cmp = (a: SlotRow, b: SlotRow) => {
      switch (sortKey) {
        case "office":
          return a.locationName.localeCompare(b.locationName) * dir;
        case "date":
        case "time":
          return (
            (new Date(a.startTime).getTime() -
              new Date(b.startTime).getTime()) *
            dir
          );
        case "slotType":
          return slotTypeLabel(a.slotType).localeCompare(
            slotTypeLabel(b.slotType),
          ) * dir;
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
    const head = ["Office", "Date", "Time", "Slot Type"];
    const lines = [head.join(",")];
    for (const r of sorted) {
      const cols = [
        r.locationName,
        ptFmtDateShort(r.startTime),
        ptFmtTime(r.startTime),
        slotTypeLabel(r.slotType),
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
    a.download = `appointment-slots-${fromDate}_${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasResults = rows !== null;

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
          Appointment Slots Report
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          All empty appointment slots for the selected doctor within a date
          range. Click any column to sort.
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
                onValueChange={(v) => setDoctorId(v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <span
                    data-slot="select-value"
                    className={selectedDoctorLabel ? "" : "text-muted-foreground"}
                  >
                    {selectedDoctorLabel || "Select a doctor…"}
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

          {error && (
            <p className="text-sm text-destructive mt-3">{error}</p>
          )}
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
                      <Th sortKey="date" current={sortKey} dir={sortDir} onSort={onSort}>
                        Date
                      </Th>
                      <Th sortKey="time" current={sortKey} dir={sortDir} onSort={onSort}>
                        Time
                      </Th>
                      <Th sortKey="slotType" current={sortKey} dir={sortDir} onSort={onSort}>
                        Slot Type
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                          No empty slots in this range.
                        </td>
                      </tr>
                    )}
                    {sorted.map((r, i) => (
                      <tr
                        key={`${r.locationId}_${r.startTime}_${i}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-3 py-2">{r.locationName}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {ptFmtDateShort(r.startTime)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {ptFmtTime(r.startTime)}
                        </td>
                        <td className="px-3 py-2">{slotTypeLabel(r.slotType)}</td>
                      </tr>
                    ))}
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
