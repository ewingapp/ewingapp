"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Plus, Trash2, ArrowLeft } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Doctor = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  suffix: string;
  certStatus: string;
  languages: string;
  claimantAges: string;
  remarks: string;
  allowVCE: boolean;
  active: boolean;
  notes: string;
};

const formSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  suffix: z.string(),
  certStatus: z.string().min(1, "Required"),
  languages: z.string(),
  claimantAges: z.string(),
  remarks: z.string(),
  allowVCE: z.boolean(),
  active: z.boolean(),
  notes: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

const EMPTY_FORM: FormValues = {
  firstName: "",
  lastName: "",
  suffix: "",
  certStatus: "BC",
  languages: "",
  claimantAges: "",
  remarks: "",
  allowVCE: false,
  active: true,
  notes: "",
};

const CERT_OPTIONS = ["BC", "BE", "Licensed", "PhD", "MD", "Other"];

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Doctor | null>(null);
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
      const res = await fetch("/api/doctors");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data: Doctor[] = await res.json();
      setDoctors(data);
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

  function openEdit(d: Doctor) {
    setEditing(d);
    form.reset({
      firstName: d.firstName,
      lastName: d.lastName,
      suffix: d.suffix,
      certStatus: d.certStatus || "BC",
      languages: d.languages,
      claimantAges: d.claimantAges,
      remarks: d.remarks,
      allowVCE: d.allowVCE,
      active: d.active,
      notes: d.notes,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const url = editing ? `/api/doctors/${editing.id}` : "/api/doctors";
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

  async function onDelete(d: Doctor) {
    const label = d.lastName || d.name || "this doctor";
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeletingId(d.id);
    setError(null);
    try {
      const res = await fetch(`/api/doctors/${d.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Delete failed (${res.status})`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <PageHeader
          title="Doctors"
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
              : `${doctors.length} doctor${doctors.length === 1 ? "" : "s"}`}
          </p>
          <Button
            onClick={openAdd}
            className="text-white hover:brightness-95"
            style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
          >
            <Plus className="size-4" />
            Add Doctor
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500 bg-slate-50">
              <tr className="border-b">
                <th className="px-3 py-2 font-medium">Last Name</th>
                <th className="px-3 py-2 font-medium">First Name</th>
                <th className="px-3 py-2 font-medium">Suffix</th>
                <th className="px-3 py-2 font-medium">Languages</th>
                <th className="px-3 py-2 font-medium">Cert</th>
                <th className="px-3 py-2 font-medium">Claimant Ages</th>
                <th className="px-3 py-2 font-medium">Remarks</th>
                <th className="px-3 py-2 font-medium text-center">VCE</th>
                <th className="px-3 py-2 font-medium text-center">Active</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                    <Loader2 className="size-5 animate-spin inline mr-2" />
                    Loading doctors…
                  </td>
                </tr>
              ) : doctors.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">
                    No doctors yet. Click <strong>Add Doctor</strong> to get started.
                  </td>
                </tr>
              ) : (
                doctors.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 even:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {d.lastName || (d.name && !d.firstName ? d.name : "—")}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{d.firstName || "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{d.suffix || "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{d.languages || "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{d.certStatus || "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{d.claimantAges || "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{d.remarks || "—"}</td>
                    <td className="px-3 py-2 text-center text-slate-700">
                      {d.allowVCE ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          d.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {d.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(d)}
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDelete(d)}
                          disabled={deletingId === d.id}
                          title="Delete"
                          className="text-rose-700 border-rose-200 hover:bg-rose-50"
                        >
                          {deletingId === d.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit doctor" : "Add doctor"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" error={form.formState.errors.firstName?.message}>
                <Input {...form.register("firstName")} />
              </Field>
              <Field label="Last name" error={form.formState.errors.lastName?.message}>
                <Input {...form.register("lastName")} />
              </Field>

              <Field label="Suffix" error={form.formState.errors.suffix?.message}>
                <Input maxLength={10} placeholder="MD, DO, PhD…" {...form.register("suffix")} />
              </Field>
              <Field label="Certification" error={form.formState.errors.certStatus?.message}>
                <select
                  {...form.register("certStatus")}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  {CERT_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Languages" error={form.formState.errors.languages?.message}>
                <Input
                  placeholder="e.g. Spanish, Mandarin"
                  {...form.register("languages")}
                />
              </Field>
              <Field
                label="Claimant ages"
                error={form.formState.errors.claimantAges?.message}
              >
                <Input
                  placeholder="e.g. 18+, all ages, No ODAR"
                  {...form.register("claimantAges")}
                />
              </Field>
            </div>

            <Field label="Remarks" error={form.formState.errors.remarks?.message}>
              <Input
                placeholder="Short note shown in the doctor list"
                {...form.register("remarks")}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Controller
                control={form.control}
                name="allowVCE"
                render={({ field }) => (
                  <label className="flex items-center gap-2.5 rounded-lg border border-input px-3 h-10 cursor-pointer hover:bg-slate-50">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(Boolean(v))}
                    />
                    <span className="text-sm text-slate-700">Allow VCE</span>
                  </label>
                )}
              />
              <Controller
                control={form.control}
                name="active"
                render={({ field }) => (
                  <label className="flex items-center gap-2.5 rounded-lg border border-input px-3 h-10 cursor-pointer hover:bg-slate-50">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(Boolean(v))}
                    />
                    <span className="text-sm text-slate-700">Active</span>
                  </label>
                )}
              />
            </div>

            <Field label="Internal notes" error={form.formState.errors.notes?.message}>
              <Textarea rows={3} {...form.register("notes")} />
            </Field>

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
                {editing ? "Save changes" : "Add doctor"}
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
