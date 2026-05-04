"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { Loader2, Plus } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type Office = { id: string; name: string };
type Doctor = {
  id: string;
  name: string;
  active: boolean;
  locations: { id: string; name: string }[];
};
type Schedule = {
  id: string;
  doctorId: string;
  locationId: string;
  startTime: string;
  endTime: string;
  doctor: { id: string; name: string };
  location: { id: string; name: string };
};
type Appointment = {
  id: string;
  doctorId: string;
  locationId: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  caseNumber: string;
  firstInitial: string;
  lastNamePrefix: string;
  specialty: { id: string; name: string };
};

type SlotRow = {
  key: string;
  startTime: Date;
  endTime: Date;
  windowId: string;
  locationId: string;
  locationName: string;
  status: "OPEN" | "BOOKED";
  appointment?: Appointment;
};

type Mode = "TIME" | "RANGE" | "TEMPLATE";

const TIME_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 7; h <= 19; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

function fmtTime12(hhmm: string): string {
  const [hStr, m] = hhmm.split(":");
  let h = Number(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.padStart(2, "0")} ${ampm}`;
}

function fmtTimeISO(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function dateIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function combineDateTime(date: Date, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const out = new Date(date);
  out.setHours(h, m, 0, 0);
  return out.toISOString();
}

function computeSlotRows(
  windows: Schedule[],
  appointments: Appointment[],
  gridMin: number,
): SlotRow[] {
  const rows: SlotRow[] = [];
  const sortedAppts = [...appointments].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  for (const w of windows) {
    let cursor = new Date(w.startTime).getTime();
    const winEnd = new Date(w.endTime).getTime();
    while (cursor + gridMin * 60_000 <= winEnd + 1) {
      const slotStart = new Date(cursor);
      const slotEndDefault = new Date(cursor + gridMin * 60_000);
      const overlap = sortedAppts.find((a) => {
        const aStart = new Date(a.startTime).getTime();
        const aEnd = new Date(a.endTime).getTime();
        return aStart < slotEndDefault.getTime() && aEnd > cursor;
      });
      if (overlap) {
        rows.push({
          key: `${w.id}_${overlap.id}`,
          startTime: new Date(overlap.startTime),
          endTime: new Date(overlap.endTime),
          windowId: w.id,
          locationId: w.locationId,
          locationName: w.location.name,
          status: "BOOKED",
          appointment: overlap,
        });
        cursor = new Date(overlap.endTime).getTime();
      } else {
        rows.push({
          key: `${w.id}_${cursor}`,
          startTime: slotStart,
          endTime: slotEndDefault,
          windowId: w.id,
          locationId: w.locationId,
          locationName: w.location.name,
          status: "OPEN",
        });
        cursor += gridMin * 60_000;
      }
    }
  }
  rows.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return rows;
}

export default function AppointmentSlotsPage() {
  const router = useRouter();
  const [offices, setOffices] = useState<Office[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [locationId, setLocationId] = useState<string>("");
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [doctorId, setDoctorId] = useState<string>("");
  const [duration, setDuration] = useState<number>(30);

  const [mode, setMode] = useState<Mode>("TIME");
  const [timeValue, setTimeValue] = useState<string>("09:00");
  const [rangeFrom, setRangeFrom] = useState<string>("09:00");
  const [rangeTo, setRangeTo] = useState<string>("17:00");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/doctors").then((r) => r.json()),
    ])
      .then(([offs, docs]: [Office[], Doctor[]]) => {
        if (cancelled) return;
        setOffices(offs);
        setDoctors(docs);
        if (offs.length && !locationId) setLocationId(offs[0].id);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load"),
      )
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eligibleDoctors = useMemo(() => {
    if (!locationId) return [];
    return doctors
      .filter(
        (d) =>
          d.active &&
          Array.isArray(d.locations) &&
          d.locations.some((l) => l?.id === locationId),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [doctors, locationId]);

  useEffect(() => {
    if (!eligibleDoctors.find((d) => d.id === doctorId)) {
      setDoctorId(eligibleDoctors[0]?.id ?? "");
    }
  }, [eligibleDoctors, doctorId]);

  async function refreshSlots() {
    if (!doctorId || !date) {
      setSchedules([]);
      setAppointments([]);
      return;
    }
    const dayIso = dateIso(date);
    const [s, a] = await Promise.all([
      fetch(`/api/schedules?doctorId=${doctorId}&date=${dayIso}`).then((r) =>
        r.ok ? r.json() : [],
      ),
      fetch(`/api/appointments?doctorId=${doctorId}&from=${dayIso}&to=${dayIso}`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]);
    setSchedules(s);
    setAppointments(a);
  }

  useEffect(() => {
    void refreshSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, date]);

  async function postWindow(startIso: string, endIso: string) {
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        doctorId,
        locationId,
        startTime: startIso,
        endTime: endIso,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `Failed (${res.status})`);
    }
  }

  async function onAdd() {
    if (!doctorId || !locationId) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "TIME") {
        const start = new Date(combineDateTime(date, timeValue));
        const end = new Date(start.getTime() + duration * 60_000);
        await postWindow(start.toISOString(), end.toISOString());
        setInfo("1 appointment slot was added.");
      } else if (mode === "RANGE") {
        const start = new Date(combineDateTime(date, rangeFrom));
        const end = new Date(combineDateTime(date, rangeTo));
        if (end <= start) {
          throw new Error("Range end must be after start.");
        }
        const totalMin = (end.getTime() - start.getTime()) / 60_000;
        const count = Math.floor(totalMin / duration);
        await postWindow(start.toISOString(), end.toISOString());
        setInfo(`${count} appointment slot${count === 1 ? "" : "s"} were added.`);
      } else {
        throw new Error("Templates aren't built yet — coming soon.");
      }
      await refreshSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteSlot(row: SlotRow) {
    if (row.status === "BOOKED") return;
    if (!confirm(`Delete the ${fmtTimeISO(row.startTime)} slot?`)) return;
    setDeletingKey(row.key);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/schedules/delete-slot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          windowId: row.windowId,
          slotStart: row.startTime.toISOString(),
          slotEnd: row.endTime.toISOString(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed (${res.status})`);
      }
      await refreshSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingKey(null);
    }
  }

  function onMakeAppointment(row: SlotRow) {
    const params = new URLSearchParams({
      locationId: row.locationId,
      from: dateIso(row.startTime),
      to: dateIso(row.startTime),
    });
    router.push(`/schedule?${params.toString()}`);
  }

  const slotRows = useMemo(
    () => computeSlotRows(schedules, appointments, duration),
    [schedules, appointments, duration],
  );

  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const selectedOfficeName =
    offices.find((o) => o.id === locationId)?.name ?? "Choose office";
  const selectedDoctorName =
    doctors.find((d) => d.id === doctorId)?.name ??
    (eligibleDoctors.length === 0
      ? "No doctors at this office"
      : "Choose doctor");

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-6 py-6">
        <PageHeader title="Add Appointment Slots" />

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 mb-4">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 mb-4">
            {info}
          </div>
        )}

        {loading ? (
          <div className="flex items-center text-slate-500 py-12">
            <Loader2 className="size-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : (
          <>
            <div className="border-2 border-slate-700 bg-white mb-3 text-sm">
              <Row label="Office:">
                <Select
                  value={locationId}
                  onValueChange={(v) => setLocationId(v ?? "")}
                >
                  <SelectTrigger className="w-56">
                    <span data-slot="select-value">{selectedOfficeName}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {offices.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>

              <Row label="Day:">
                <DayPicker
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  weekStartsOn={0}
                  className="rdp-custom"
                />
              </Row>

              <Row label="Doctor:">
                <div className="flex items-center gap-3 flex-wrap">
                  <Select
                    value={doctorId}
                    onValueChange={(v) => setDoctorId(v ?? "")}
                    disabled={eligibleDoctors.length === 0}
                  >
                    <SelectTrigger className="w-56">
                      <span data-slot="select-value">{selectedDoctorName}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleDoctors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-slate-700 inline-flex items-center gap-1">
                    Appt Duration:
                    <Input
                      type="number"
                      min={5}
                      max={240}
                      step={5}
                      value={duration}
                      onChange={(e) =>
                        setDuration(Number(e.target.value) || 30)
                      }
                      className="inline-block w-16 h-8"
                    />
                    Minutes
                  </span>
                </div>
              </Row>

              <Row
                label={
                  <ModeRadio
                    active={mode === "TIME"}
                    onSelect={() => setMode("TIME")}
                    label="Time:"
                  />
                }
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Select
                    value={timeValue}
                    onValueChange={(v) => setTimeValue(v ?? "09:00")}
                  >
                    <SelectTrigger className="w-28">
                      <span data-slot="select-value">
                        {fmtTime12(timeValue)}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {fmtTime12(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-slate-600">Manual:</span>
                  <Input
                    type="time"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    step={300}
                    className="w-24 h-8"
                  />
                </div>
              </Row>

              <Row
                label={
                  <ModeRadio
                    active={mode === "RANGE"}
                    onSelect={() => setMode("RANGE")}
                    label="Range:"
                  />
                }
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">From:</span>
                  <Select
                    value={rangeFrom}
                    onValueChange={(v) => setRangeFrom(v ?? "09:00")}
                  >
                    <SelectTrigger className="w-28">
                      <span data-slot="select-value">
                        {fmtTime12(rangeFrom)}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {fmtTime12(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="font-semibold ml-2">To:</span>
                  <Select
                    value={rangeTo}
                    onValueChange={(v) => setRangeTo(v ?? "17:00")}
                  >
                    <SelectTrigger className="w-28">
                      <span data-slot="select-value">
                        {fmtTime12(rangeTo)}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {fmtTime12(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </Row>

              <Row
                label={
                  <ModeRadio
                    active={mode === "TEMPLATE"}
                    onSelect={() => setMode("TEMPLATE")}
                    label="Template:"
                  />
                }
              >
                <span className="text-slate-500 italic text-xs">
                  Templates not yet available.
                </span>
              </Row>
            </div>

            <div className="flex items-center gap-2 mb-6">
              <Button
                onClick={onAdd}
                disabled={
                  saving || !doctorId || !locationId || mode === "TEMPLATE"
                }
                className="text-white hover:brightness-95 h-9"
                style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add Appointment Slot(s)
              </Button>
              <Button variant="outline" disabled className="h-9">
                Add Recurring Appointment Slots
              </Button>
            </div>

            <h2 className="font-semibold text-slate-900 mb-2">
              Appointment slots for{" "}
              {selectedDoctor?.name ?? "—"} on{" "}
              {date.toLocaleDateString(undefined, {
                month: "numeric",
                day: "numeric",
                year: "numeric",
              })}
              :
            </h2>

            {slotRows.length === 0 ? (
              <div className="bg-white rounded border border-slate-300 px-4 py-4 text-sm text-slate-500">
                There are no Appointment Slots for this doctor on this day.
              </div>
            ) : (
              <div className="bg-white border border-slate-300 overflow-hidden text-sm">
                <table className="w-full">
                  <thead
                    className="text-left text-white"
                    style={{ background: "#5B7295" }}
                  >
                    <tr>
                      <th className="px-3 py-2 font-semibold w-20"></th>
                      <th className="px-3 py-2 font-semibold">Time</th>
                      <th className="px-3 py-2 font-semibold">
                        Appointment Status
                      </th>
                      <th className="px-3 py-2 font-semibold">Office</th>
                      <th className="px-3 py-2 font-semibold">Actions</th>
                      <th className="px-3 py-2 font-semibold">Appt Made</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slotRows.map((row, i) => {
                      const isOtherOffice = row.locationId !== locationId;
                      return (
                        <tr
                          key={row.key}
                          className={`border-b border-slate-200 last:border-b-0 ${
                            i % 2 === 1 ? "bg-slate-50" : ""
                          }`}
                        >
                          <td className="px-3 py-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onDeleteSlot(row)}
                              disabled={
                                row.status === "BOOKED" ||
                                deletingKey === row.key
                              }
                              className="h-7 text-xs"
                            >
                              {deletingKey === row.key ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                "Delete"
                              )}
                            </Button>
                          </td>
                          <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">
                            {fmtTimeISO(row.startTime)}
                          </td>
                          <td className="px-3 py-1.5">
                            {row.status === "OPEN" ? (
                              <span className="text-emerald-700 font-medium">
                                Open
                              </span>
                            ) : (
                              <span className="text-slate-700 font-medium">
                                Booked ({row.appointment?.specialty.name})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {row.locationName}
                            {isOtherOffice && (
                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                                other
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onMakeAppointment(row)}
                              disabled={row.status === "BOOKED"}
                              className="h-7 text-xs"
                            >
                              Make Appointment
                            </Button>
                          </td>
                          <td className="px-3 py-1.5 tabular-nums">
                            {row.appointment
                              ? `#${row.appointment.caseNumber}`
                              : ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Row({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex border-b border-slate-700 last:border-b-0">
      <div className="w-28 shrink-0 border-r border-slate-700 px-2 py-1.5 font-bold text-slate-900 flex items-center">
        {label}
      </div>
      <div className="flex-1 px-2 py-1.5 flex items-center">{children}</div>
    </div>
  );
}

function ModeRadio({
  active,
  onSelect,
  label,
}: {
  active: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input
        type="radio"
        checked={active}
        onChange={onSelect}
        className="size-4"
      />
      <span className="font-bold text-slate-900">{label}</span>
    </label>
  );
}
