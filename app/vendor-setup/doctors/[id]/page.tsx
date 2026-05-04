"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Clock,
  Loader2,
  Save,
  Stethoscope,
} from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type Category = "PSYCH" | "MEDICAL" | "SLP";

type DurationOverride = {
  id: string;
  specialtyId: string;
  durationMinutes: number;
};

type Doctor = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  suffix: string;
  active: boolean;
  locations: { id: string; name: string }[];
  specialties: { id: string; name: string; code: string; category: Category }[];
  exams: { id: string; code: string; name: string; category: Category }[];
  overrides: DurationOverride[];
};

type Office = { id: string; name: string; city: string };
type Specialty = {
  id: string;
  name: string;
  code: string;
  category: Category;
  durationMinutes: number;
};
type Exam = { id: string; code: string; name: string; category: Category };

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "PSYCH", label: "Psych" },
  { value: "MEDICAL", label: "Medical" },
  { value: "SLP", label: "SLP" },
];

export default function DoctorSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  const [locationIds, setLocationIds] = useState<Set<string>>(new Set());
  const [specialtyIds, setSpecialtyIds] = useState<Set<string>>(new Set());
  const [examIds, setExamIds] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/doctors/${id}`).then((r) => {
        if (!r.ok) throw new Error(`Failed to load doctor (${r.status})`);
        return r.json();
      }),
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/specialties").then((r) => r.json()),
      fetch("/api/exams").then((r) => r.json()),
    ])
      .then(([d, locs, specs, exs]: [Doctor, Office[], Specialty[], Exam[]]) => {
        if (cancelled) return;
        setDoctor(d);
        setOffices(locs);
        setSpecialties(specs);
        setExams(exs);
        setLocationIds(new Set(d.locations.map((l) => l.id)));
        setSpecialtyIds(new Set(d.specialties.map((s) => s.id)));
        setExamIds(new Set(d.exams.map((e) => e.id)));
        setOverrides(
          new Map(
            (d.overrides ?? []).map((o) => [o.specialtyId, o.durationMinutes]),
          ),
        );
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const dirty = useMemo(() => {
    if (!doctor) return false;
    const set = (ids: { id: string }[]) => new Set(ids.map((x) => x.id));
    const savedOverrides = new Map(
      (doctor.overrides ?? []).map((o) => [o.specialtyId, o.durationMinutes]),
    );
    if (savedOverrides.size !== overrides.size) return true;
    for (const [k, v] of overrides) {
      if (savedOverrides.get(k) !== v) return true;
    }
    return (
      !sameSet(set(doctor.locations), locationIds) ||
      !sameSet(set(doctor.specialties), specialtyIds) ||
      !sameSet(set(doctor.exams), examIds)
    );
  }, [doctor, locationIds, specialtyIds, examIds, overrides]);

  function toggle(setter: typeof setLocationIds, id: string) {
    setter((curr) => {
      const next = new Set(curr);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSavedAt(null);
  }

  async function onSave() {
    if (!doctor) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctors/${doctor.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationIds: [...locationIds],
          specialtyIds: [...specialtyIds],
          examIds: [...examIds],
          durationOverrides: [...overrides.entries()].map(
            ([specialtyId, durationMinutes]) => ({
              specialtyId,
              durationMinutes,
            }),
          ),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }
      const updated: Doctor = await res.json();
      setDoctor(updated);
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const doctorLabel = doctor
    ? [doctor.firstName, doctor.lastName, doctor.suffix].filter(Boolean).join(" ") ||
      doctor.name
    : "";

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PageHeader
          title={doctor ? `Setup: ${doctorLabel}` : "Doctor Setup"}
          trailing={
            <Link
              href="/vendor-setup/doctors"
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="size-4" />
              Doctors
            </Link>
          }
        />

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
        ) : doctor ? (
          <>
            <div className="bg-white border rounded-lg shadow-sm p-4 mb-6 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                {locationIds.size} office{locationIds.size === 1 ? "" : "s"} ·{" "}
                {specialtyIds.size} specialt{specialtyIds.size === 1 ? "y" : "ies"} ·{" "}
                {examIds.size} exam{examIds.size === 1 ? "" : "s"} assigned
                {savedAt && !dirty && (
                  <span className="ml-3 text-emerald-700">
                    Saved at {savedAt.toLocaleTimeString()}
                  </span>
                )}
                {dirty && (
                  <span className="ml-3 text-amber-700">Unsaved changes</span>
                )}
              </div>
              <Button
                onClick={onSave}
                disabled={saving || !dirty}
                className="text-white hover:brightness-95"
                style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save assignments
              </Button>
            </div>

            <Section
              title="Offices"
              icon={Building2}
              empty="No offices defined yet. Add some on the Offices page."
              count={locationIds.size}
              total={offices.length}
            >
              {offices.map((o) => (
                <CheckRow
                  key={o.id}
                  checked={locationIds.has(o.id)}
                  onToggle={() => toggle(setLocationIds, o.id)}
                  label={o.name}
                  hint={o.city}
                />
              ))}
            </Section>

            <GroupedSection
              title="Specialties"
              icon={Stethoscope}
              empty="No specialties in the catalog."
              count={specialtyIds.size}
              total={specialties.length}
              groups={CATEGORIES.map((cat) => ({
                label: cat.label,
                items: specialties
                  .filter((s) => s.category === cat.value)
                  .map((s) => ({
                    id: s.id,
                    label: s.name,
                    hint: s.code ? `Code ${s.code}` : "",
                  })),
              }))}
              isChecked={(id) => specialtyIds.has(id)}
              onToggle={(id) => toggle(setSpecialtyIds, id)}
            />

            <GroupedSection
              title="Exams"
              icon={ClipboardList}
              empty="No exams in the catalog."
              count={examIds.size}
              total={exams.length}
              groups={CATEGORIES.map((cat) => ({
                label: cat.label,
                items: exams
                  .filter((e) => e.category === cat.value)
                  .map((e) => ({ id: e.id, label: e.name, hint: e.code })),
              }))}
              isChecked={(id) => examIds.has(id)}
              onToggle={(id) => toggle(setExamIds, id)}
            />

            <DurationOverridesSection
              specialties={specialties.filter((s) => specialtyIds.has(s.id))}
              overrides={overrides}
              onChange={(specialtyId, value) => {
                setOverrides((curr) => {
                  const next = new Map(curr);
                  if (value == null) next.delete(specialtyId);
                  else next.set(specialtyId, value);
                  return next;
                });
                setSavedAt(null);
              }}
            />
          </>
        ) : (
          <p className="text-sm text-slate-500">Doctor not found.</p>
        )}
      </div>
    </AppShell>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  total,
  empty,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  total: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border rounded-lg shadow-sm mb-6">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span
            className="grid place-items-center size-7 rounded text-white"
            style={{ background: "#0085CA" }}
          >
            <Icon className="size-4" />
          </span>
          <h2 className="font-semibold text-slate-900">{title}</h2>
        </div>
        <span className="text-xs text-slate-500">
          {count} of {total} assigned
        </span>
      </header>
      <div className="p-2">
        {total === 0 ? (
          <p className="text-sm text-slate-500 px-2 py-4">{empty}</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">{children}</ul>
        )}
      </div>
    </section>
  );
}

function GroupedSection({
  title,
  icon: Icon,
  count,
  total,
  empty,
  groups,
  isChecked,
  onToggle,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  total: number;
  empty: string;
  groups: { label: string; items: { id: string; label: string; hint?: string }[] }[];
  isChecked: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const visibleGroups = groups.filter((g) => g.items.length > 0);
  return (
    <section className="bg-white border rounded-lg shadow-sm mb-6">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span
            className="grid place-items-center size-7 rounded text-white"
            style={{ background: "#0085CA" }}
          >
            <Icon className="size-4" />
          </span>
          <h2 className="font-semibold text-slate-900">{title}</h2>
        </div>
        <span className="text-xs text-slate-500">
          {count} of {total} assigned
        </span>
      </header>
      <div className="p-2">
        {total === 0 ? (
          <p className="text-sm text-slate-500 px-2 py-4">{empty}</p>
        ) : (
          <div className="space-y-3">
            {visibleGroups.map((g) => (
              <div key={g.label}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 pt-1 pb-1.5">
                  {g.label}
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {g.items.map((item) => (
                    <CheckRow
                      key={item.id}
                      checked={isChecked(item.id)}
                      onToggle={() => onToggle(item.id)}
                      label={item.label}
                      hint={item.hint}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CheckRow({
  checked,
  onToggle,
  label,
  hint,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <li>
      <label className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-slate-50 cursor-pointer">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
        />
        <span className="text-sm text-slate-800">{label}</span>
        {hint && (
          <span className="ml-auto text-xs text-slate-500 tabular-nums">{hint}</span>
        )}
      </label>
    </li>
  );
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function DurationOverridesSection({
  specialties,
  overrides,
  onChange,
}: {
  specialties: Specialty[];
  overrides: Map<string, number>;
  onChange: (specialtyId: string, value: number | null) => void;
}) {
  const sorted = [...specialties].sort((a, b) => {
    const order: Record<Category, number> = { PSYCH: 0, MEDICAL: 1, SLP: 2 };
    if (a.category !== b.category)
      return (order[a.category] ?? 9) - (order[b.category] ?? 9);
    return a.name.localeCompare(b.name);
  });

  return (
    <section className="bg-white border rounded-lg shadow-sm mb-6">
      <header className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span
            className="grid place-items-center size-7 rounded text-white"
            style={{ background: "#0085CA" }}
          >
            <Clock className="size-4" />
          </span>
          <h2 className="font-semibold text-slate-900">Custom durations</h2>
        </div>
        <span className="text-xs text-slate-500">
          {overrides.size} override{overrides.size === 1 ? "" : "s"}
        </span>
      </header>
      <div className="p-2">
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500 px-2 py-4">
            Assign specialties above to set per-doctor duration overrides.
          </p>
        ) : (
          <ul className="divide-y">
            {sorted.map((s) => {
              const current = overrides.get(s.id);
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-800 truncate">{s.name}</div>
                    <div className="text-xs text-slate-500">
                      Default {s.durationMinutes} min
                    </div>
                  </div>
                  <Input
                    type="number"
                    min={5}
                    max={240}
                    step={5}
                    value={current ?? ""}
                    placeholder={`${s.durationMinutes}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") onChange(s.id, null);
                      else {
                        const n = Number(v);
                        if (Number.isFinite(n)) onChange(s.id, n);
                      }
                    }}
                    className="w-24 text-right tabular-nums"
                  />
                  <span className="text-xs text-slate-500 w-7">min</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
