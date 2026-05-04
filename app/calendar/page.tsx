"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Office = { id: string; name: string };
type Schedule = {
  id: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  doctor: { id: string; name: string };
};
type Appointment = {
  id: string;
  doctorId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  caseNumber: string;
  firstInitial: string;
  lastNamePrefix: string;
  specialty: { id: string; name: string };
};

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 19;
const PX_PER_MIN = 1.4;
const COLUMN_MIN_WIDTH = 180;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function topPx(iso: string, dayStart: Date): number {
  const ms = new Date(iso).getTime() - dayStart.getTime();
  return (ms / 60_000) * PX_PER_MIN;
}

function heightPx(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return (ms / 60_000) * PX_PER_MIN;
}

export default function CalendarPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [locationId, setLocationId] = useState<string>("");
  const [date, setDate] = useState<string>(todayIso());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/locations")
      .then((r) => r.json())
      .then((offs: Office[]) => {
        if (cancelled) return;
        setOffices(offs);
        if (offs.length && !locationId) setLocationId(offs[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!locationId || !date) return;
    setError(null);
    Promise.all([
      fetch(`/api/schedules?locationId=${locationId}&date=${date}`).then((r) =>
        r.json(),
      ),
      fetch(
        `/api/appointments?locationId=${locationId}&from=${date}&to=${date}`,
      )
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]).then(([sch, appts]: [Schedule[], Appointment[]]) => {
      setSchedules(sch);
      setAppointments(Array.isArray(appts) ? appts : []);
    });
  }, [locationId, date]);

  const dayStart = useMemo(() => {
    const d = new Date(`${date}T00:00:00`);
    d.setHours(DAY_START_HOUR, 0, 0, 0);
    return d;
  }, [date]);

  const dayHeightPx = (DAY_END_HOUR - DAY_START_HOUR) * 60 * PX_PER_MIN;

  const timeMarks = useMemo(() => {
    const marks: { label: string; topPx: number }[] = [];
    for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      marks.push({
        label: `${h12} ${ampm}`,
        topPx: (h - DAY_START_HOUR) * 60 * PX_PER_MIN,
      });
    }
    return marks;
  }, []);

  const doctorColumns = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const s of schedules) map.set(s.doctorId, s.doctor);
    for (const a of appointments) {
      if (!map.has(a.doctorId)) {
        map.set(a.doctorId, { id: a.doctorId, name: "(unknown)" });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [schedules, appointments]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <PageHeader title="Calendar" />

        <div className="flex items-end gap-4 mb-6">
          <div className="space-y-1.5">
            <Label className="text-xs">Office</Label>
            <Select
              value={locationId}
              onValueChange={(v) => setLocationId(v ?? "")}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Choose office" />
              </SelectTrigger>
              <SelectContent>
                {offices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center text-slate-500 py-12">
            <Loader2 className="size-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : doctorColumns.length === 0 ? (
          <div className="bg-white rounded-lg border shadow-sm px-4 py-12 text-center text-sm text-slate-500">
            No doctors are scheduled at this office on this date. Add open
            windows on the{" "}
            <a className="text-sky-700 underline" href="/appointment-slots">
              Appointment Slots
            </a>{" "}
            page.
          </div>
        ) : (
          <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
            <div className="flex">
              <div className="w-16 border-r bg-slate-50 sticky left-0 z-10">
                <div className="h-10 border-b" />
                <div className="relative" style={{ height: dayHeightPx }}>
                  {timeMarks.map((m) => (
                    <div
                      key={m.label}
                      className="absolute -translate-y-1/2 right-2 text-[11px] text-slate-500 tabular-nums"
                      style={{ top: m.topPx }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 flex">
                {doctorColumns.map((doc) => {
                  const docSchedules = schedules.filter(
                    (s) => s.doctorId === doc.id,
                  );
                  const docAppts = appointments.filter(
                    (a) => a.doctorId === doc.id,
                  );
                  return (
                    <div
                      key={doc.id}
                      className="border-r last:border-r-0"
                      style={{ minWidth: COLUMN_MIN_WIDTH, flex: 1 }}
                    >
                      <div className="h-10 border-b px-3 flex items-center text-sm font-semibold text-slate-700 bg-slate-50">
                        {doc.name}
                      </div>
                      <div
                        className="relative"
                        style={{ height: dayHeightPx }}
                      >
                        {timeMarks.map((m) => (
                          <div
                            key={m.label}
                            className="absolute left-0 right-0 border-t border-slate-100"
                            style={{ top: m.topPx }}
                          />
                        ))}
                        {docSchedules.map((s) => (
                          <div
                            key={s.id}
                            className="absolute left-1 right-1 rounded-sm bg-emerald-50/70 border border-emerald-200"
                            style={{
                              top: topPx(s.startTime, dayStart),
                              height: heightPx(s.startTime, s.endTime),
                            }}
                            title={`Open: ${fmtTime(s.startTime)} – ${fmtTime(s.endTime)}`}
                          />
                        ))}
                        {docAppts.map((a) => (
                          <div
                            key={a.id}
                            className="absolute left-1 right-1 rounded-sm bg-sky-100 border border-sky-300 px-1.5 py-0.5 text-[11px] text-sky-900 overflow-hidden"
                            style={{
                              top: topPx(a.startTime, dayStart),
                              height: heightPx(a.startTime, a.endTime),
                            }}
                            title={`${fmtTime(a.startTime)} – ${fmtTime(a.endTime)} · ${a.specialty.name} · #${a.caseNumber}`}
                          >
                            <div className="font-semibold tabular-nums">
                              {fmtTime(a.startTime)}
                            </div>
                            <div className="truncate">{a.specialty.name}</div>
                            <div className="truncate text-sky-700">
                              #{a.caseNumber}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-500 mt-3">
          <span className="inline-block size-3 align-middle bg-emerald-50 border border-emerald-200 rounded-sm mr-1.5" />
          Open window
          <span className="inline-block size-3 align-middle bg-sky-100 border border-sky-300 rounded-sm ml-4 mr-1.5" />
          Booked appointment
        </p>
      </div>
    </AppShell>
  );
}
