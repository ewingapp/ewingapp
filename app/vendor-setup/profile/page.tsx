"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Pencil, Save, X } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type NotificationPref = "ALWAYS" | "LIMITED" | "NEVER";

type Vendor = {
  id: string;
  name: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  fax: string;
  email: string;
  loginId: string;
  password: string;
  contactName: string;
  appointmentNotification: NotificationPref;
  description: string;
  newAppointments: boolean;
};

const NOTIFICATION_LABEL: Record<NotificationPref, string> = {
  ALWAYS: "Always (new, rescheduled, cancelled)",
  LIMITED: "Limited (rescheduled and cancelled only)",
  NEVER: "Never",
};

export default function VendorProfilePage() {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [draft, setDraft] = useState<Vendor | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/vendor")
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return (await r.json()) as Vendor;
      })
      .then((v) => {
        setVendor(v);
        setDraft(v);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  function beginEdit() {
    if (!vendor) return;
    setDraft({ ...vendor });
    setEditing(true);
    setError(null);
    setSavedAt(null);
  }

  function cancelEdit() {
    if (!vendor) return;
    setDraft(vendor);
    setEditing(false);
    setError(null);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/vendor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          address: draft.address,
          address2: draft.address2,
          city: draft.city,
          state: draft.state,
          zip: draft.zip,
          phone: draft.phone,
          fax: draft.fax,
          email: draft.email,
          loginId: draft.loginId,
          password: draft.password,
          contactName: draft.contactName,
          appointmentNotification: draft.appointmentNotification,
          description: draft.description,
          newAppointments: draft.newAppointments,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Save failed");
      }
      const updated = (await res.json()) as Vendor;
      setVendor(updated);
      setDraft(updated);
      setEditing(false);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-6">
        <Link
          href="/vendor-setup"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to Vendor Setup
        </Link>
        <PageHeader title="Vendor Profile" />

        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          The <strong>Email</strong> address below is where appointment
          confirmation notifications are sent. Use{" "}
          <strong>Appointment Notification</strong> to control which events
          trigger an email. The <strong>Description</strong> is a single
          paragraph describing your business — Program Technicians can view
          this information.
        </p>

        {loading && (
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && draft && (
          <div
            className="bg-white rounded-lg shadow-sm p-6"
            style={{ border: "1.5px solid #CBD5E1" }}
          >
            {!editing ? (
              <ReadView vendor={draft} onEdit={beginEdit} savedAt={savedAt} />
            ) : (
              <EditView
                draft={draft}
                setDraft={setDraft}
                onCancel={cancelEdit}
                onSave={save}
                saving={saving}
              />
            )}
            {error && (
              <p className="text-sm text-destructive mt-4">{error}</p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-2 sm:gap-4 py-2 border-b border-slate-100 last:border-b-0">
      <div className="text-sm text-slate-600 font-medium pt-1.5">{label}</div>
      <div className="text-sm text-slate-900">{children}</div>
    </div>
  );
}

function ReadView({
  vendor,
  onEdit,
  savedAt,
}: {
  vendor: Vendor;
  onEdit: () => void;
  savedAt: number | null;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-900">Current profile</h2>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-emerald-600">Saved</span>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm hover:brightness-95"
            style={{ background: "#0085CA", border: "2px solid #0085CA" }}
          >
            <Pencil className="size-4" />
            Modify
          </button>
        </div>
      </div>

      <Row label="Name">{vendor.name || <Empty />}</Row>
      <Row label="Address">
        {vendor.address || <Empty />}
        {vendor.address2 && (
          <>
            <br />
            {vendor.address2}
          </>
        )}
      </Row>
      <Row label="City">{vendor.city || <Empty />}</Row>
      <Row label="State">{vendor.state || <Empty />}</Row>
      <Row label="Zipcode">{vendor.zip || <Empty />}</Row>
      <Row label="Phone">{vendor.phone || <Empty />}</Row>
      <Row label="Fax">{vendor.fax || <Empty />}</Row>
      <Row label="Email">
        {vendor.email ? (
          <>
            {vendor.email}
            <span className="ml-2 text-xs text-slate-500">
              (receives appointment notifications)
            </span>
          </>
        ) : (
          <Empty />
        )}
      </Row>
      <Row label="LoginID">{vendor.loginId || <Empty />}</Row>
      <Row label="Password">
        {vendor.password ? "••••••••" : <Empty />}
      </Row>
      <Row label="Contact Name">{vendor.contactName || <Empty />}</Row>
      <Row label="Appointment Notification">
        {NOTIFICATION_LABEL[vendor.appointmentNotification]}
      </Row>
      <Row label="Description">
        {vendor.description ? (
          <p className="whitespace-pre-wrap">{vendor.description}</p>
        ) : (
          <Empty />
        )}
      </Row>
      <Row label="New Appointments">
        {vendor.newAppointments ? "Yes" : "No"}
      </Row>

      <div className="mt-4 pt-4 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
        <p>
          <strong>Notification settings:</strong>{" "}
          <em>Always</em> sends an email on every new, rescheduled, and
          cancelled appointment. <em>Limited</em> sends only on rescheduled
          and cancelled appointments. Cancellations made less than 48 hours
          before the appointment are flagged as late cancels.
        </p>
      </div>
    </>
  );
}

function Empty() {
  return <span className="text-slate-400">—</span>;
}

function EditView({
  draft,
  setDraft,
  onCancel,
  onSave,
  saving,
}: {
  draft: Vendor;
  setDraft: (v: Vendor) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  function update<K extends keyof Vendor>(key: K, value: Vendor[K]) {
    setDraft({ ...draft, [key]: value });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Edit profile</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
            style={{ border: "1.5px solid #CBD5E1" }}
          >
            <X className="size-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm hover:brightness-95 disabled:opacity-50"
            style={{ background: "#0085CA", border: "2px solid #0085CA" }}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <Field label="Name">
          <Input value={draft.name} onChange={(e) => update("name", e.target.value)} />
        </Field>
        <Field label="Address">
          <Input value={draft.address} onChange={(e) => update("address", e.target.value)} />
        </Field>
        <Field label="Address 2">
          <Input value={draft.address2} onChange={(e) => update("address2", e.target.value)} placeholder="Suite, unit, etc. (optional)" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-3">
          <Field label="City">
            <Input value={draft.city} onChange={(e) => update("city", e.target.value)} />
          </Field>
          <Field label="State">
            <Input value={draft.state} onChange={(e) => update("state", e.target.value)} />
          </Field>
          <Field label="Zipcode">
            <Input value={draft.zip} onChange={(e) => update("zip", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Phone">
            <Input value={draft.phone} onChange={(e) => update("phone", e.target.value)} />
          </Field>
          <Field label="Fax">
            <Input value={draft.fax} onChange={(e) => update("fax", e.target.value)} />
          </Field>
        </div>
        <Field
          label="Email"
          hint="Where appointment notifications are sent."
        >
          <Input
            type="email"
            value={draft.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </Field>
        <Field label="Contact Name">
          <Input value={draft.contactName} onChange={(e) => update("contactName", e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="LoginID">
            <Input value={draft.loginId} onChange={(e) => update("loginId", e.target.value)} />
          </Field>
          <Field label="Password">
            <Input
              type="text"
              value={draft.password}
              onChange={(e) => update("password", e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Appointment Notification"
          hint="Always = email on every new, rescheduled, and cancelled appointment. Limited = rescheduled and cancelled only."
        >
          <Select
            value={draft.appointmentNotification}
            onValueChange={(v) =>
              update("appointmentNotification", (v as NotificationPref) ?? "LIMITED")
            }
          >
            <SelectTrigger className="w-full">
              <span data-slot="select-value">
                {NOTIFICATION_LABEL[draft.appointmentNotification]}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALWAYS">{NOTIFICATION_LABEL.ALWAYS}</SelectItem>
              <SelectItem value="LIMITED">{NOTIFICATION_LABEL.LIMITED}</SelectItem>
              <SelectItem value="NEVER">{NOTIFICATION_LABEL.NEVER}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Description"
          hint="A single paragraph describing your business. Program Technicians can view this."
        >
          <Textarea
            value={draft.description}
            onChange={(e) => update("description", e.target.value)}
            rows={4}
          />
        </Field>
        <Field label="">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={draft.newAppointments}
              onCheckedChange={(v) =>
                update("newAppointments", v === true)
              }
            />
            Accepting new appointments
          </label>
        </Field>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-2 sm:gap-4 items-start">
      <Label className="text-sm text-slate-700 font-medium pt-2 sm:pt-2.5">
        {label}
      </Label>
      <div>
        {children}
        {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      </div>
    </div>
  );
}
