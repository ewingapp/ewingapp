"use client";

import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { Loader2, Plus, Trash2 } from "lucide-react";

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
  return `${h}:${m} ${ampm}`;
}

function fmtTimeISO(iso: string): string {
  const d = new Date(iso);
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

export default function AppointmentSlotsPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function refreshSchedules() {
    if (!doctorId || !date) {
      setSchedules([]);
      return;
    }
    const res = await fetch(
      `/api/schedules?doctorId=${doctorId}&date=${dateIso(date)}`,
    );
    if (res.ok) setSchedules(await res.json());
  }

  useEffect(() => {
    void refreshSchedules();
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
    try {
      if (mode === "TIME") {
        const start = new Date(combineDateTime(date, timeValue));
        const end = new Date(start.getTime() + duration * 60_000);
        await postWindow(start.toISOString(), end.toISOString());
      } else if (mode === "RANGE") {
        const start = combineDateTime(date, rangeFrom);
        const end = combineDateTime(date, rangeTo);
        if (new Date(end) <= new Date(start)) {
          throw new Error("Range end must be after start");
        }
        await postWindow(start, end);
      } else if (mode === "TEMPLATE") {
        throw new Error("Templates aren't built yet — coming soon.");
      }
      await refreshSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(s: Schedule) {
    if (
      !confirm(
        `Delete this open window (${fmtTimeISO(s.startTime)} – ${fmtTimeISO(s.endTime)} at ${s.location.name})?`,
      )
    )
      return;
    setDeletingId(s.id);
    setError(null);
    try {
      const res = await fetch(`/api/schedules/${s.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed (${res.status})`);
      }
      await refreshSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const selectedOfficeName =
    offices.find((o) => o.id === locationId)?.name ?? "";

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PageHeader title="Add Appointment Slots" />

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
        ) : (
          <>
            <div className="border-2 border-slate-300 bg-white rounded-md overflow-hidden mb-6">
              <Row label="Office">
                <Select
                  value={locationId}
                  onValueChange={(v) => setLocationId(v ?? "")}
                >
                  <SelectTrigger className="w-64">
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
              </Row>

              <Row label="Day">
                <DayPicker
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  weekStartsOn={0}
                  className="rdp-custom"
                />
              </Row>

              <Row label="Doctor">
                <div className="flex items-center gap-3 flex-wrap">
                  <Select
                    value={doctorId}
                    onValueChange={(v) => setDoctorId(v ?? "")}
                    disabled={eligibleDoctors.length === 0}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue
                        placeholder={
                          eligibleDoctors.length === 0
                            ? "No doctors at this office"
                            : "Choose doctor"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleDoctors.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-slate-700">
                    Appt Duration:{" "}
                    <Input
                      type="number"
                      min={5}
                      max={240}
                      step={5}
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value) || 30)}
                      className="inline-block w-20 mx-1 align-middle"
                    />
                    Minutes
                  </span>
                </div>
              </Row>

              <Row label="">
                <ModeRow
                  active={mode === "TIME"}
                  onSelect={() => setMode("TIME")}
                  label="Time:"
                >
                  <Select value={timeValue} onValueChange={(v) => setTimeValue(v ?? "09:00")}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {fmtTime12(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-slate-600 ml-2">Manual:</span>
                  <Input
                    type="time"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    step={300}
                    className="w-28 ml-1"
                  />
                </ModeRow>
              </Row>

              <Row label="">
                <ModeRow
                  active={mode === "RANGE"}
                  onSelect={() => setMode("RANGE")}
                  label="Range:"
                >
                  <span className="text-sm font-medium">From:</span>
                  <Select value={rangeFrom} onValueChange={(v) => setRangeFrom(v ?? "09:00")}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {fmtTime12(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm font-medium ml-3">To:</span>
                  <Select value={rangeTo} onValueChange={(v) => setRangeTo(v ?? "17:00")}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {fmtTime12(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ModeRow>
              </Row>

              <Row label="">
                <ModeRow
                  active={mode === "TEMPLATE"}
                  onSelect={() => setMode("TEMPLATE")}
                  label="Template:"
                >
                  <Select disabled value="" onValueChange={() => {}}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Coming soon" />
                    </SelectTrigger>
                    <SelectContent />
                  </Select>
                  <span className="text-xs text-slate-500 ml-2 italic">
                    Templates not yet available
                  </span>
                </ModeRow>
              </Row>
            </div>

            <div className="flex items-center gap-3 mb-8">
              <Button
                onClick={onAdd}
                disabled={saving || !doctorId || !locationId || mode === "TEMPLATE"}
                className="text-white hover:brightness-95"
                style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add Appointment Slot(s)
              </Button>
              <Button variant="outline" disabled title="Coming soon">
                Add Recurring Appointment Slots
              </Button>
            </div>

            <h2 className="font-semibold text-slate-900 mb-3">
              Appointment slots for{" "}
              {selectedDoctor?.name ?? "—"} on{" "}
              {date.toLocaleDateString(undefined, {
                month: "numeric",
                day: "numeric",
                year: "numeric",
              })}
            </h2>
            {schedules.length === 0 ? (
              <div className="bg-white rounded-lg border shadow-sm px-4 py-6 text-sm text-slate-500">
                There are no Appointment Slots for this doctor on this day.
              </div>
            ) : (
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b">
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Office</th>
                      <th className="px-3 py-2 font-medium text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map((s) => {
                      const isOtherOffice = s.locationId !== locationId;
                      return (
                        <tr
                          key={s.id}
                          className={`border-b last:border-0 ${
                            isOtherOffice ? "bg-amber-50/50" : ""
                          }`}
                        >
                          <td className="px-3 py-2 tabular-nums text-slate-800">
                            {fmtTimeISO(s.startTime)} – {fmtTimeISO(s.endTime)}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {s.location.name}
                            {isOtherOffice && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                                other office
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onDelete(s)}
                              disabled={deletingId === s.id}
                              className="text-rose-700 border-rose-200 hover:bg-rose-50"
                            >
                              {deletingId === s.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                              Delete
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-slate-500 mt-3">
              Selected office: <strong>{selectedOfficeName}</strong>. Slots from
              the doctor&apos;s other offices show with an amber badge.
            </p>
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
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex border-b last:border-b-0">
      <div className="w-32 shrink-0 bg-white border-r px-3 py-3 font-bold text-slate-900">
        {label && `${label}:`}
      </div>
      <div className="flex-1 px-3 py-3">{children}</div>
    </div>
  );
}

function ModeRow({
  active,
  onSelect,
  label,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="radio"
          checked={active}
          onChange={onSelect}
          className="size-4"
        />
        <span className="font-bold text-slate-900">{label}</span>
      </label>
      {children}
    </div>
  );
}
