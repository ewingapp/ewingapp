"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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

type Office = {
  id: string;
  name: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  contactName: string;
  active: boolean;
};

const formSchema = z.object({
  name: z.string().min(1, "Required"),
  address: z.string(),
  address2: z.string(),
  city: z.string().min(1, "Required"),
  state: z.string(),
  zip: z.string(),
  phone: z.string(),
  contactName: z.string(),
  active: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

const EMPTY_FORM: FormValues = {
  name: "",
  address: "",
  address2: "",
  city: "",
  state: "CA",
  zip: "",
  phone: "",
  contactName: "",
  active: true,
};

function formatPhoneDisplay(s: string): string {
  if (!s) return "";
  const d = s.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return s;
}

export default function OfficesPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Office | null>(null);
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
      const res = await fetch("/api/locations");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data: Office[] = await res.json();
      setOffices(data);
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

  function openEdit(o: Office) {
    setEditing(o);
    form.reset({
      name: o.name,
      address: o.address,
      address2: o.address2,
      city: o.city,
      state: o.state || "CA",
      zip: o.zip,
      phone: o.phone,
      contactName: o.contactName,
      active: o.active,
    });
    setDialogOpen(true);
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const url = editing ? `/api/locations/${editing.id}` : "/api/locations";
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

  async function onDelete(o: Office) {
    if (!confirm(`Delete office "${o.name}"? This cannot be undone.`)) return;
    setDeletingId(o.id);
    setError(null);
    try {
      const res = await fetch(`/api/locations/${o.id}`, { method: "DELETE" });
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
          title="Offices"
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
              : `${offices.length} office${offices.length === 1 ? "" : "s"}`}
          </p>
          <Button
            onClick={openAdd}
            className="text-white hover:brightness-95"
            style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
          >
            <Plus className="size-4" />
            Add Office
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
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Address</th>
                <th className="px-3 py-2 font-medium">City</th>
                <th className="px-3 py-2 font-medium">State</th>
                <th className="px-3 py-2 font-medium">Zip</th>
                <th className="px-3 py-2 font-medium">Phone</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium text-center">Active</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    <Loader2 className="size-5 animate-spin inline mr-2" />
                    Loading offices…
                  </td>
                </tr>
              ) : offices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                    No offices yet. Click <strong>Add Office</strong> to get started.
                  </td>
                </tr>
              ) : (
                offices.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 even:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-900">{o.name}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {[o.address, o.address2].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{o.city || "—"}</td>
                    <td className="px-3 py-2 text-slate-700">{o.state || "—"}</td>
                    <td className="px-3 py-2 text-slate-700 tabular-nums">{o.zip || "—"}</td>
                    <td className="px-3 py-2 text-slate-700 tabular-nums whitespace-nowrap">
                      {formatPhoneDisplay(o.phone) || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{o.contactName || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          o.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {o.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(o)}
                          title="Edit"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onDelete(o)}
                          disabled={deletingId === o.id}
                          title="Delete"
                          className="text-rose-700 border-rose-200 hover:bg-rose-50"
                        >
                          {deletingId === o.id ? (
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
            <DialogTitle>{editing ? "Edit office" : "Add office"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Office name" error={form.formState.errors.name?.message}>
              <Input
                placeholder="e.g. Sacramento, Roseville"
                {...form.register("name")}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Address line 1" error={form.formState.errors.address?.message}>
                <Input {...form.register("address")} />
              </Field>
              <Field label="Address line 2" error={form.formState.errors.address2?.message}>
                <Input
                  placeholder="Suite, floor (optional)"
                  {...form.register("address2")}
                />
              </Field>

              <Field label="City" error={form.formState.errors.city?.message}>
                <Input {...form.register("city")} />
              </Field>
              <Field label="State" error={form.formState.errors.state?.message}>
                <Input maxLength={2} {...form.register("state")} />
              </Field>

              <Field label="Zip" error={form.formState.errors.zip?.message}>
                <Input maxLength={10} {...form.register("zip")} />
              </Field>
              <Field label="Phone" error={form.formState.errors.phone?.message}>
                <Input
                  inputMode="numeric"
                  placeholder="Digits only"
                  {...form.register("phone")}
                />
              </Field>

              <Field
                label="Contact name"
                error={form.formState.errors.contactName?.message}
              >
                <Input {...form.register("contactName")} />
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
                        Show this office in scheduling
                      </span>
                    </label>
                  </div>
                )}
              />
            </div>

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
                {editing ? "Save changes" : "Add office"}
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
