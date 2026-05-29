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
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(
            (body && typeof body.error === "string" && body.error) ||
              `Request failed (HTTP ${r.status})`,
          );
        }
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
          Click <strong>Modify</strong> to add or change the data below. The{" "}
          <strong>Email</strong> address is where appointment confirmation
          notifications are sent. Under <strong>Description</strong> you can
          add a single paragraph describing your business — Program
          Technicians are able to view this information.
        </p>

        {loading && (
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && !draft && error && (
          <div
            className="bg-white rounded-lg shadow-sm p-6"
            style={{ border: "1.5px solid #fca5a5", background: "#fef2f2" }}
          >
            <h2 className="text-base font-semibold text-rose-900 mb-2">
              Couldn&apos;t load vendor profile
            </h2>
            <p className="text-sm text-rose-800 mb-3 break-all">{error}</p>
            <p className="text-xs text-rose-700 leading-relaxed">
              This usually means the <code>Vendor</code> table doesn&apos;t
              exist in the database yet. From the project root run{" "}
              <code className="bg-rose-100 px-1 py-0.5 rounded">npm run db:push</code>{" "}
              to apply the latest schema, then reload this page.
            </p>
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

function TR({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="text-left align-top font-semibold text-slate-800 bg-slate-50 px-3 py-2 w-56"
        style={{ border: "1px solid #CBD5E1" }}
      >
        {label}
      </th>
      <td
        className="align-top text-slate-900 px-3 py-2"
        style={{ border: "1px solid #CBD5E1" }}
      >
        {children}
      </td>
    </tr>
  );
}

function NOTIFICATION_SHORT(p: NotificationPref): string {
  switch (p) {
    case "ALWAYS":
      return "Always";
    case "LIMITED":
      return "Limited";
    case "NEVER":
      return "Never";
  }
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
      <table className="w-full text-sm border-collapse">
        <tbody>
          <TR label="Name:">{vendor.name || <Empty />}</TR>
          <TR label="Address:">
            {vendor.address || <Empty />}
            {vendor.address2 && (
              <>
                <br />
                {vendor.address2}
              </>
            )}
          </TR>
          <TR label="City:">{vendor.city || <Empty />}</TR>
          <TR label="State:">{vendor.state || <Empty />}</TR>
          <TR label="Zipcode:">{vendor.zip || <Empty />}</TR>
          <TR label="Phone:">{vendor.phone || <Empty />}</TR>
          <TR label="Fax:">{vendor.fax || <Empty />}</TR>
          <TR label="Email:">{vendor.email || <Empty />}</TR>
          <TR label="LoginID:">{vendor.loginId || <Empty />}</TR>
          <TR label="Password:">
            {vendor.password || <Empty />}
          </TR>
          <TR label="Contact Name:">{vendor.contactName || <Empty />}</TR>
          <TR label={<>Appointment Notification<sup>*</sup>:</>}>
            {NOTIFICATION_SHORT(vendor.appointmentNotification)}
          </TR>
          <TR label="Description:">
            {vendor.description ? (
              <span className="whitespace-pre-wrap">{vendor.description}</span>
            ) : (
              <Empty />
            )}
          </TR>
          <TR label={<>New Appointments<sup>**</sup>:</>}>
            {vendor.newAppointments ? "True" : "False"}
          </TR>
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm hover:brightness-95"
          style={{ background: "#06B6D4", border: "2px solid #06B6D4" }}
        >
          <Pencil className="size-4" />
          Modify
        </button>
        {savedAt && <span className="text-xs text-emerald-600">Saved</span>}
      </div>

      <div className="mt-4 text-xs text-slate-600 leading-relaxed space-y-1">
        <p>
          <sup>*</sup>If <strong>Always</strong>, a message is sent to the email
          specified above whenever a new appointment is created, an appointment
          is rescheduled, or an appointment is canceled. If{" "}
          <strong>Limited</strong>, messages are sent only for rescheduled and
          cancelled appointments. Cancellations made less than 48 hours before
          the appointment are flagged as late cancels in the message subject.
        </p>
        <p>
          <sup>**</sup>If <strong>True</strong>, the practice is accepting new
          appointments. If <strong>False</strong>, no new appointments will be
          booked.
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
            style={{ background: "#06B6D4", border: "2px solid #06B6D4" }}
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
        <Field label="City">
          <Input value={draft.city} onChange={(e) => update("city", e.target.value)} />
        </Field>
        <Field label="State">
          <Input
            value={draft.state}
            onChange={(e) => update("state", e.target.value)}
            className="w-24"
          />
        </Field>
        <Field label="Zipcode">
          <Input
            value={draft.zip}
            onChange={(e) => update("zip", e.target.value)}
            className="w-40"
          />
        </Field>
        <Field label="Phone">
          <Input
            value={draft.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="w-56"
          />
        </Field>
        <Field label="Fax">
          <Input
            value={draft.fax}
            onChange={(e) => update("fax", e.target.value)}
            className="w-56"
          />
        </Field>
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
        <Field label="LoginID">
          <Input
            value={draft.loginId}
            onChange={(e) => update("loginId", e.target.value)}
            className="w-56"
          />
        </Field>
        <Field label="Password">
          <Input
            type="text"
            value={draft.password}
            onChange={(e) => update("password", e.target.value)}
            className="w-56"
          />
        </Field>
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
