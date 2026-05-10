"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ptFmtDateLong, ptFmtTime } from "@/lib/pt";

const formSchema = z.object({
  caseNumber: z.string().min(1, "Required").max(50),
  contractNumber: z.string().optional().or(z.literal("")),
  firstInitial: z.string().length(1, "1 letter"),
  lastNamePrefix: z.string().min(1, "Required").max(5, "Max 5 letters"),
  stateBranch: z.string().min(1, "Required"),
  analystName: z.string().min(1, "Required"),
  analystPhone: z.string().regex(/^\d{10}$/, "10 digits"),
  analystExt: z
    .string()
    .regex(/^\d{0,10}$/, "Digits only")
    .optional()
    .or(z.literal("")),
  schedulerName: z.string().min(1, "Required"),
  schedulerPhone: z.string().regex(/^\d{10}$/, "10 digits"),
  schedulerExt: z
    .string()
    .regex(/^\d{0,10}$/, "Digits only")
    .optional()
    .or(z.literal("")),
  claimantPhone: z
    .string()
    .regex(/^\d{10}$/, "10 digits")
    .optional()
    .or(z.literal("")),
  hasInterpreter: z.enum(["yes", "no"]),
  isOdarCase: z.enum(["yes", "no"]),
  notes: z.string().optional().or(z.literal("")),
});
type FormValues = z.infer<typeof formSchema>;

type Branch = { id: string; name: string };
type Appt = {
  id: string;
  startTime: string;
  caseNumber: string;
  firstInitial: string;
  lastNamePrefix: string;
  stateBranch: string;
  analystName: string;
  analystPhone: string;
  analystExt: string;
  schedulerName: string;
  schedulerPhone: string;
  schedulerExt: string;
  claimantPhone: string;
  contractNumber: string;
  hasInterpreter: string;
  isOdarCase: string;
  notes: string;
  status: string;
  doctor: { name: string; firstName: string; lastName: string };
  specialty: { name: string };
  location: { name: string };
};

export default function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [appt, setAppt] = useState<Appt | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      caseNumber: "",
      contractNumber: "",
      firstInitial: "",
      lastNamePrefix: "",
      stateBranch: "",
      analystName: "",
      analystPhone: "",
      analystExt: "",
      schedulerName: "",
      schedulerPhone: "",
      schedulerExt: "",
      claimantPhone: "",
      hasInterpreter: "no",
      isOdarCase: "no",
      notes: "",
    },
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/appointments/${id}`).then(async (r) => {
        if (!r.ok) {
          throw new Error(
            r.status === 404 ? "Appointment not found" : "Failed to load appointment",
          );
        }
        return r.json() as Promise<Appt>;
      }),
      fetch("/api/branches").then((r) => r.json() as Promise<Branch[]>),
    ])
      .then(([a, bs]) => {
        if (cancelled) return;
        setAppt(a);
        setBranches(bs);
        form.reset({
          caseNumber: a.caseNumber,
          contractNumber: a.contractNumber ?? "",
          firstInitial: a.firstInitial,
          lastNamePrefix: a.lastNamePrefix,
          stateBranch: a.stateBranch,
          analystName: a.analystName,
          analystPhone: a.analystPhone,
          analystExt: a.analystExt ?? "",
          schedulerName: a.schedulerName,
          schedulerPhone: a.schedulerPhone,
          schedulerExt: a.schedulerExt ?? "",
          claimantPhone: a.claimantPhone ?? "",
          hasInterpreter: (a.hasInterpreter === "yes" ? "yes" : "no"),
          isOdarCase: (a.isOdarCase === "yes" ? "yes" : "no"),
          notes: a.notes ?? "",
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [id, form]);

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
      router.push(`/appointments/${id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  const terminal =
    appt?.status === "CANCELLED" || appt?.status === "MOVED";

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link
          href={`/appointments/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-3"
        >
          <ArrowLeft className="size-4" />
          Back to appointment
        </Link>
        <PageHeader title="Edit Appointment" />

        {loadError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {loadError}
          </div>
        )}

        {!appt && !loadError && (
          <div className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        )}

        {appt && (
          <>
            <div
              className="rounded-lg p-4 mb-6 bg-slate-50 text-sm"
              style={{ border: "2px solid #C9A55C" }}
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-2">
                <Read label="Date" value={ptFmtDateLong(appt.startTime)} />
                <Read label="Time" value={ptFmtTime(appt.startTime)} />
                <Read label="Doctor" value={`${appt.doctor.firstName} ${appt.doctor.lastName}`.trim()} />
                <Read label="Office" value={appt.location.name} />
                <Read label="Exam" value={appt.specialty.name} />
              </div>
              <p className="text-xs text-slate-500 mt-2">
                To change date, time, doctor, office, or exam type, use{" "}
                <Link
                  href={`/reschedule/${id}`}
                  className="text-[#0085CA] hover:underline"
                >
                  Reschedule
                </Link>
                .
              </p>
            </div>

            {terminal && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 mb-4">
                This appointment is {appt.status.toLowerCase()} and cannot be edited.
              </div>
            )}

            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Case number" error={form.formState.errors.caseNumber?.message}>
                  <Input disabled={terminal} {...form.register("caseNumber")} />
                </Field>
                <Field label="State branch" error={form.formState.errors.stateBranch?.message}>
                  <select
                    disabled={terminal}
                    {...form.register("stateBranch")}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-60"
                  >
                    <option value="">Choose…</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="First initial" error={form.formState.errors.firstInitial?.message}>
                  <Input disabled={terminal} maxLength={1} {...form.register("firstInitial")} />
                </Field>
                <Field label="Last name prefix (5)" error={form.formState.errors.lastNamePrefix?.message}>
                  <Input disabled={terminal} maxLength={5} {...form.register("lastNamePrefix")} />
                </Field>

                <Field label="Analyst name" error={form.formState.errors.analystName?.message}>
                  <Input disabled={terminal} {...form.register("analystName")} />
                </Field>
                <PhoneExtField
                  phoneLabel="Analyst phone"
                  disabled={terminal}
                  phoneRegister={form.register("analystPhone")}
                  phoneError={form.formState.errors.analystPhone?.message}
                  extRegister={form.register("analystExt")}
                  extError={form.formState.errors.analystExt?.message}
                />

                <Field label="Scheduler name" error={form.formState.errors.schedulerName?.message}>
                  <Input disabled={terminal} {...form.register("schedulerName")} />
                </Field>
                <PhoneExtField
                  phoneLabel="Scheduler phone"
                  disabled={terminal}
                  phoneRegister={form.register("schedulerPhone")}
                  phoneError={form.formState.errors.schedulerPhone?.message}
                  extRegister={form.register("schedulerExt")}
                  extError={form.formState.errors.schedulerExt?.message}
                />

                <Field label="Claimant phone (optional)" error={form.formState.errors.claimantPhone?.message}>
                  <Input
                    disabled={terminal}
                    inputMode="numeric"
                    maxLength={10}
                    {...form.register("claimantPhone")}
                  />
                </Field>
                <Field label="Contract number (optional)" error={form.formState.errors.contractNumber?.message}>
                  <Input disabled={terminal} {...form.register("contractNumber")} />
                </Field>

                <Field label="Interpreter?" error={form.formState.errors.hasInterpreter?.message}>
                  <select
                    disabled={terminal}
                    {...form.register("hasInterpreter")}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-60"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
                <Field label="ODAR case?" error={form.formState.errors.isOdarCase?.message}>
                  <select
                    disabled={terminal}
                    {...form.register("isOdarCase")}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-60"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              </div>

              <Field label="Notes" error={form.formState.errors.notes?.message}>
                <Textarea disabled={terminal} rows={3} {...form.register("notes")} />
              </Field>

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/appointments/${id}`)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || terminal}
                  className="text-white font-medium"
                  style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save changes
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Read({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-medium text-slate-900">{value}</div>
    </div>
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

function PhoneExtField({
  phoneLabel,
  phoneRegister,
  phoneError,
  extRegister,
  extError,
  disabled,
}: {
  phoneLabel: string;
  phoneRegister: ReturnType<ReturnType<typeof useForm<FormValues>>["register"]>;
  phoneError?: string;
  extRegister: ReturnType<ReturnType<typeof useForm<FormValues>>["register"]>;
  extError?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{phoneLabel}</Label>
      <div className="flex gap-2">
        <Input
          disabled={disabled}
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit number"
          className="flex-1"
          {...phoneRegister}
        />
        <Input
          disabled={disabled}
          inputMode="numeric"
          maxLength={10}
          placeholder="ext"
          className="w-24"
          {...extRegister}
        />
      </div>
      {(phoneError || extError) && (
        <p className="text-xs text-destructive">{phoneError ?? extError}</p>
      )}
    </div>
  );
}
