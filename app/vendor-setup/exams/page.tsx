"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Download, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = "PSYCH" | "MEDICAL" | "SLP";
type Exam = {
  id: string;
  code: string;
  name: string;
  category: Category;
  durationMinutes: number;
  active: boolean;
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "PSYCH", label: "Psych" },
  { value: "MEDICAL", label: "Medical" },
  { value: "SLP", label: "SLP" },
];

const formSchema = z.object({
  code: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  category: z.enum(["PSYCH", "MEDICAL", "SLP"]),
  durationMinutes: z.number().int().min(5).max(240),
  active: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

const EMPTY_FORM: FormValues = {
  code: "",
  name: "",
  category: "MEDICAL",
  durationMinutes: 30,
  active: true,
};

function csvEscape(value: string | boolean): string {
  const s = typeof value === "boolean" ? (value ? "Yes" : "No") : value;
  return `"${String(s).replace(/"/g, '""')}"`;
}

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Exam | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/exams");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data: Exam[] = await res.json();
      setExams(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    form.reset(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(e: Exam) {
    setEditing(e);
    form.reset({
      code: e.code,
      name: e.name,
      category: e.category,
      durationMinutes: e.durationMinutes,
      active: e.active,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const url = editing ? `/api/exams/${editing.id}` : "/api/exams";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Save failed (${res.status})`);
      }
      setDialogOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(e: Exam) {
    if (!confirm(`Delete exam "${e.code}"? This cannot be undone.`)) return;
    setDeletingId(e.id);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${e.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Delete failed (${res.status})`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const grouped = useMemo(() => {
    const out: Record<Category, Exam[]> = { PSYCH: [], MEDICAL: [], SLP: [] };
    for (const e of exams) out[e.category]?.push(e);
    return out;
  }, [exams]);

  function exportCsv() {
    const rows = [
      ["Category", "Code", "Name", "Duration (min)", "Active"],
      ...exams.map(
        (e) =>
          [e.category, e.code, e.name, String(e.durationMinutes), e.active] as const,
      ),
    ];
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exams-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PageHeader
          title="Exams"
          trailing={
            <Link
              href="/vendor-setup"
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="size-4" />
              Vendor Setup
            </Link>
          }
        />

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-600">
            {loading
              ? "Loading…"
              : `${exams.length} exam${exams.length === 1 ? "" : "s"}`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={loading || exams.length === 0}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
            <Button
              onClick={openAdd}
              className="text-white hover:brightness-95"
              style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
            >
              <Plus className="size-4" />
              Add Exam
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-lg border shadow-sm px-3 py-8 text-center text-slate-500">
            <Loader2 className="size-5 animate-spin inline mr-2" />
            Loading exams…
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-white rounded-lg border shadow-sm px-3 py-8 text-center text-slate-500">
            No exams yet. Click <strong>Add Exam</strong> to start.
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((cat) => {
              const items = grouped[cat.value];
              if (items.length === 0) return null;
              return (
                <section
                  key={cat.value}
                  className="bg-white rounded-lg border shadow-sm overflow-x-auto"
                >
                  <header className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      {cat.label}
                    </h2>
                    <span className="text-xs text-slate-500">
                      {items.length} exam{items.length === 1 ? "" : "s"}
                    </span>
                  </header>
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50/50">
                      <tr className="border-b">
                        <th className="px-3 py-2 font-medium">Code</th>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium text-right">Duration</th>
                        <th className="px-3 py-2 font-medium text-center">Active</th>
                        <th className="px-3 py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b last:border-0 even:bg-slate-50/50"
                        >
                          <td className="px-3 py-2 font-medium text-slate-900 tabular-nums">
                            {e.code}
                          </td>
                          <td className="px-3 py-2 text-slate-700 uppercase">
                            {e.name}
                          </td>
                          <td className="px-3 py-2 text-slate-700 tabular-nums text-right">
                            {e.durationMinutes} min
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                e.active
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {e.active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(e)}
                                title="Edit"
                              >
                                <Pencil className="size-3.5" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onDelete(e)}
                                disabled={deletingId === e.id}
                                title="Delete"
                                className="text-rose-700 border-rose-200 hover:bg-rose-50"
                              >
                                {deletingId === e.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit exam" : "Add exam"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Field label="Category" error={form.formState.errors.category?.message}>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Field label="Code" error={form.formState.errors.code?.message}>
              <Input
                placeholder="e.g. 99204-INTERNIST"
                {...form.register("code")}
              />
            </Field>

            <Field label="Name" error={form.formState.errors.name?.message}>
              <Input
                placeholder="e.g. INTERNIST"
                className="uppercase"
                {...form.register("name")}
              />
            </Field>

            <Field
              label="Default duration (minutes)"
              error={form.formState.errors.durationMinutes?.message}
            >
              <Input
                type="number"
                min={5}
                max={240}
                step={5}
                placeholder="30"
                {...form.register("durationMinutes", { valueAsNumber: true })}
              />
            </Field>

            <Controller
              control={form.control}
              name="active"
              render={({ field }) => (
                <div className="space-y-1.5">
                  <Label className="text-xs">Active</Label>
                  <label className="flex items-center gap-2.5 rounded-lg border border-input px-3 h-9 cursor-pointer hover:bg-slate-50">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(Boolean(v))}
                    />
                    <span className="text-sm text-slate-700">
                      Available for assignment to doctors
                    </span>
                  </label>
                </div>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="text-white hover:brightness-95"
                style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save changes" : "Add exam"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
