"use client";

import { useEffect, useMemo, useState } from "react";
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

type Office = { id: string; name: string; city: string };
type Doctor = {
  id: string;
  name: string;
  active: boolean;
  locations: { id: string }[];
};
type Schedule = {
  id: string;
  doctorId: string;
  locationId: string;
  startTime: string;
  endTime: string;
  doctor: { id: string; name: string };
};

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

function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export default function AppointmentSlotsPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [locationId, setLocationId] = useState<string>("");
  const [date, setDate] = useState<string>(todayIso());
  const [doctorId, setDoctorId] = useState<string>("");
  const [fromTime, setFromTime] = useState<string>("08:00");
  const [toTime, setToTime] = useState<string>("17:00");

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

  useEffect(() => {
    if (!locationId || !date) return;
    fetch(`/api/schedules?locationId=${locationId}&date=${date}`)
      .then((r) => r.json())
      .then((s: Schedule[]) => setSchedules(s))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load schedules"),
      );
  }, [locationId, date]);

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

  const grouped = useMemo(() => {
    const map = new Map<string, { doctor: { id: string; name: string }; items: Schedule[] }>();
    for (const s of schedules) {
      const k = s.doctor.id;
      if (!map.has(k)) map.set(k, { doctor: s.doctor, items: [] });
      map.get(k)!.items.push(s);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.doctor.name.localeCompare(b.doctor.name),
    );
  }, [schedules]);

  async function refreshSchedules() {
    const res = await fetch(`/api/schedules?locationId=${locationId}&date=${date}`);
    if (res.ok) setSchedules(await res.json());
  }

  async function onAdd() {
    if (!doctorId || !locationId || !date || !fromTime || !toTime) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doctorId,
          locationId,
          startTime: combineDateTime(date, fromTime),
          endTime: combineDateTime(date, toTime),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed (${res.status})`);
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
        `Delete this open window for ${s.doctor.name} (${fmtTime(s.startTime)} – ${fmtTime(s.endTime)})?`,
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

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PageHeader title="Appointment Slots" />

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
            <section className="bg-white border rounded-lg shadow-sm p-5 mb-6">
              <h2 className="font-semibold text-slate-900 mb-4">
                Add open window
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field label="Office">
                  <Select
                    value={locationId}
                    onValueChange={(v) => setLocationId(v ?? "")}
                  >
                    <SelectTrigger>
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
                </Field>

                <Field label="Date">
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>

                <Field label="Doctor">
                  <Select
                    value={doctorId}
                    onValueChange={(v) => setDoctorId(v ?? "")}
                    disabled={eligibleDoctors.length === 0}
                  >
                    <SelectTrigger>
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
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="From">
                    <Input
                      type="time"
                      value={fromTime}
                      step={300}
                      onChange={(e) => setFromTime(e.target.value)}
                    />
                  </Field>
                  <Field label="To">
                    <Input
                      type="time"
                      value={toTime}
                      step={300}
                      onChange={(e) => setToTime(e.target.value)}
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={onAdd}
                  disabled={
                    saving ||
                    !doctorId ||
                    !locationId ||
                    !date ||
                    !fromTime ||
                    !toTime
                  }
                  className="text-white hover:brightness-95"
                  style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Add window
                </Button>
              </div>
            </section>

            <section>
              <h2 className="font-semibold text-slate-900 mb-3">
                Existing windows on{" "}
                {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </h2>
              {grouped.length === 0 ? (
                <div className="bg-white rounded-lg border shadow-sm px-4 py-6 text-sm text-slate-500">
                  No open windows yet for this office on this date. Add one
                  above.
                </div>
              ) : (
                <div className="space-y-3">
                  {grouped.map((g) => (
                    <div
                      key={g.doctor.id}
                      className="bg-white rounded-lg border shadow-sm overflow-hidden"
                    >
                      <header className="px-4 py-2.5 border-b bg-slate-50 text-sm font-semibold text-slate-700">
                        {g.doctor.name}
                      </header>
                      <ul>
                        {g.items.map((s) => (
                          <li
                            key={s.id}
                            className="flex items-center justify-between px-4 py-2 border-b last:border-0 text-sm"
                          >
                            <span className="text-slate-800 tabular-nums">
                              {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                            </span>
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
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
