"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ptFmtTime, ptFmtDateLong } from "@/lib/pt";

type Specialty = { id: string; name: string };
type Branch = { id: string; name: string };

export type SlotInfo = {
  doctorId: string;
  doctorName: string;
  locationId: string;
  locationName: string;
  startTime: Date;
  slotType: "ANY" | "LOOKALIKE" | "PSYCH_TESTING";
};

const formSchema = z.object({
  specialtyId: z.string().min(1, "Choose an exam type"),
  caseNumber: z.string().min(1, "Required"),
  contractNumber: z.string().optional(),
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
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

const EMPTY_FORM: FormValues = {
  specialtyId: "",
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
};

function filterSpecialtiesForSlot(
  doctorSpecialties: Specialty[],
  slotType: SlotInfo["slotType"],
): Specialty[] {
  if (slotType === "LOOKALIKE") {
    return doctorSpecialties.filter((s) => /\bMSE\b/i.test(s.name));
  }
  if (slotType === "PSYCH_TESTING") {
    return doctorSpecialties.filter((s) => /TESTING/i.test(s.name));
  }
  return doctorSpecialties;
}

function formatPhoneDisplay(s: string | undefined, ext?: string): string {
  let base = "—";
  if (s) {
    const d = s.replace(/\D/g, "");
    if (d.length === 10) base = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    else if (d.length === 7) base = `${d.slice(0, 3)}-${d.slice(3)}`;
    else base = s;
  }
  if (ext && ext.trim()) return `${base} ext. ${ext.trim()}`;
  return base;
}

type Confirmation = {
  slot: SlotInfo;
  specialty: Specialty;
  values: FormValues;
};

export function BookSlotDialog({
  open,
  onOpenChange,
  slot,
  doctorSpecialties,
  branches,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: SlotInfo | null;
  doctorSpecialties: Specialty[];
  branches: Branch[];
  onBooked: (info: { caseNumber: string }) => void;
}) {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_FORM,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = form;

  const eligibleSpecialties = useMemo(
    () =>
      slot
        ? filterSpecialtiesForSlot(doctorSpecialties, slot.slotType)
        : [],
    [doctorSpecialties, slot],
  );

  useEffect(() => {
    if (open) {
      reset(EMPTY_FORM);
      setConfirmation(null);
    }
  }, [open, reset]);

  if (!slot) return null;
  const currentSlot = slot;

  async function onSubmit(values: FormValues) {
    const slotId = `${currentSlot.doctorId}_${currentSlot.locationId}_${currentSlot.startTime.toISOString()}`;
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, slotId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError("root", {
        message: body?.error ?? `Booking failed (${res.status})`,
      });
      return;
    }
    const specialty = doctorSpecialties.find((s) => s.id === values.specialtyId);
    if (specialty) {
      setConfirmation({ slot: currentSlot, specialty, values });
    }
    onBooked({ caseNumber: values.caseNumber });
  }

  const slotTypeLabel =
    slot.slotType === "LOOKALIKE"
      ? "LookAlike only"
      : slot.slotType === "PSYCH_TESTING"
      ? "Psych Testing only"
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        {confirmation ? (
          <>
            <div className="ewing-print-area">
              <div className="text-center pb-4 border-b border-slate-200 mb-5">
                <Image
                  src="/ewing-logo.png"
                  alt="Ewing Diagnostics & Psychological Services"
                  width={1181}
                  height={335}
                  className="h-20 w-auto mx-auto"
                />
                <div className="mt-3">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Appointment Confirmation
                  </h2>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Issued {ptFmtDateLong(new Date())} at {ptFmtTime(new Date())}
                  </div>
                </div>
              </div>

              <Section title="Appointment">
                <DetailRow
                  label="Date"
                  value={ptFmtDateLong(confirmation.slot.startTime)}
                />
                <DetailRow
                  label="Time"
                  value={ptFmtTime(confirmation.slot.startTime)}
                />
                <DetailRow label="Doctor" value={confirmation.slot.doctorName} />
                <DetailRow label="Office" value={confirmation.slot.locationName} />
                <DetailRow label="Specialty" value={confirmation.specialty.name} />
              </Section>

              <Section title="Claimant">
                <DetailRow label="Case number" value={confirmation.values.caseNumber} />
                <DetailRow
                  label="Identifier"
                  value={`${confirmation.values.firstInitial.toUpperCase()}. ${confirmation.values.lastNamePrefix.toUpperCase()}`}
                />
                <DetailRow
                  label="Claimant phone"
                  value={formatPhoneDisplay(confirmation.values.claimantPhone)}
                />
                <DetailRow
                  label="Contract number"
                  value={confirmation.values.contractNumber || "—"}
                />
                <DetailRow
                  label="Interpreter"
                  value={confirmation.values.hasInterpreter === "yes" ? "Yes" : "No"}
                />
                <DetailRow
                  label="ODAR case"
                  value={confirmation.values.isOdarCase === "yes" ? "Yes" : "No"}
                />
              </Section>

              <Section title="State">
                <DetailRow label="Branch" value={confirmation.values.stateBranch} />
                <DetailRow label="Analyst" value={confirmation.values.analystName} />
                <DetailRow
                  label="Analyst phone"
                  value={formatPhoneDisplay(
                    confirmation.values.analystPhone,
                    confirmation.values.analystExt,
                  )}
                />
              </Section>

              <Section title="Scheduler">
                <DetailRow label="Name" value={confirmation.values.schedulerName} />
                <DetailRow
                  label="Phone"
                  value={formatPhoneDisplay(
                    confirmation.values.schedulerPhone,
                    confirmation.values.schedulerExt,
                  )}
                />
              </Section>

              {confirmation.values.notes && (
                <div className="mb-4">
                  <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-1 mb-2">
                    Notes
                  </h3>
                  <p className="text-sm whitespace-pre-wrap text-slate-800">
                    {confirmation.values.notes}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="ewing-print-hide flex flex-col-reverse sm:flex-row gap-2 sm:justify-end sm:items-center pt-2 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                onClick={() => window.print()}
                autoFocus
                className="text-white hover:brightness-95"
                style={{ background: "#DC2626", border: "2px solid #0085CA" }}
              >
                <Printer className="size-4" />
                Print
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Book appointment</DialogTitle>
              <DialogDescription>
                {ptFmtDateLong(slot.startTime)} at {ptFmtTime(slot.startTime)} ·{" "}
                {slot.doctorName} · {slot.locationName}
                {slotTypeLabel && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-100 text-violet-800">
                    {slotTypeLabel}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Field label="Exam type" error={errors.specialtyId?.message}>
                <select
                  {...register("specialtyId")}
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <option value="">
                    {eligibleSpecialties.length === 0
                      ? "No matching exams for this doctor"
                      : "Choose…"}
                  </option>
                  {eligibleSpecialties.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Case number" error={errors.caseNumber?.message}>
                  <Input {...register("caseNumber")} />
                </Field>
                <Field label="State branch" error={errors.stateBranch?.message}>
                  <select
                    {...register("stateBranch")}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                  >
                    <option value="">Choose…</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="First initial" error={errors.firstInitial?.message}>
                  <Input maxLength={1} {...register("firstInitial")} />
                </Field>
                <Field
                  label="Last name prefix (5)"
                  error={errors.lastNamePrefix?.message}
                >
                  <Input maxLength={5} {...register("lastNamePrefix")} />
                </Field>

                <Field label="Analyst name" error={errors.analystName?.message}>
                  <Input {...register("analystName")} />
                </Field>
                <PhoneExtField
                  phoneLabel="Analyst phone"
                  phoneRegister={register("analystPhone")}
                  phoneError={errors.analystPhone?.message}
                  extRegister={register("analystExt")}
                  extError={errors.analystExt?.message}
                />

                <Field label="Scheduler name" error={errors.schedulerName?.message}>
                  <Input {...register("schedulerName")} />
                </Field>
                <PhoneExtField
                  phoneLabel="Scheduler phone"
                  phoneRegister={register("schedulerPhone")}
                  phoneError={errors.schedulerPhone?.message}
                  extRegister={register("schedulerExt")}
                  extError={errors.schedulerExt?.message}
                />

                <Field
                  label="Claimant phone (optional)"
                  error={errors.claimantPhone?.message}
                >
                  <Input
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit number"
                    {...register("claimantPhone")}
                  />
                </Field>
                <Field
                  label="Contract number (optional)"
                  error={errors.contractNumber?.message}
                >
                  <Input {...register("contractNumber")} />
                </Field>

                <Field label="Interpreter?" error={errors.hasInterpreter?.message}>
                  <select
                    {...register("hasInterpreter")}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
                <Field label="ODAR case?" error={errors.isOdarCase?.message}>
                  <select
                    {...register("isOdarCase")}
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              </div>

              <Field label="Notes" error={errors.notes?.message}>
                <Textarea rows={3} {...register("notes")} />
              </Field>

              {errors.root?.message && (
                <p className="text-sm text-destructive">{errors.root.message}</p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => reset(EMPTY_FORM)}
                  disabled={isSubmitting}
                  className="sm:mr-auto text-white hover:brightness-95"
                  style={{ background: "#0085CA", border: "2px solid #0085CA" }}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="text-white hover:brightness-95"
                  style={{ background: "#DC2626", border: "2px solid #0085CA" }}
                >
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Book Appointment
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold text-xs text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-1 mb-2">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-slate-900">{value || "—"}</span>
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

type RegisterReturn = ReturnType<ReturnType<typeof useForm<FormValues>>["register"]>;

function PhoneExtField({
  phoneLabel,
  phoneRegister,
  phoneError,
  extRegister,
  extError,
}: {
  phoneLabel: string;
  phoneRegister: RegisterReturn;
  phoneError?: string;
  extRegister: RegisterReturn;
  extError?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{phoneLabel}</Label>
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit number"
          className="flex-1"
          {...phoneRegister}
        />
        <Input
          inputMode="numeric"
          maxLength={10}
          placeholder="ext. (optional)"
          className="w-28"
          {...extRegister}
        />
      </div>
      {(phoneError || extError) && (
        <p className="text-xs text-destructive">{phoneError ?? extError}</p>
      )}
    </div>
  );
}
