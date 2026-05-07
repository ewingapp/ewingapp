"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

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
import { ptFmtTime, PT_TZ } from "@/lib/pt";

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
  analystPhone: z.string().regex(/^\d{1,15}$/, "Digits only"),
  schedulerName: z.string().min(1, "Required"),
  schedulerPhone: z.string().regex(/^\d{1,15}$/, "Digits only"),
  claimantPhone: z
    .string()
    .regex(/^\d{1,15}$/, "Digits only")
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
  schedulerName: "",
  schedulerPhone: "",
  claimantPhone: "",
  hasInterpreter: "no",
  isOdarCase: "no",
  notes: "",
};

const PT_DATE_LONG = new Intl.DateTimeFormat("en-US", {
  timeZone: PT_TZ,
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

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
    if (open) reset(EMPTY_FORM);
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
    onBooked({ caseNumber: values.caseNumber });
    onOpenChange(false);
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Book appointment</DialogTitle>
          <DialogDescription>
            {PT_DATE_LONG.format(slot.startTime)} at {ptFmtTime(slot.startTime)} ·{" "}
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
            <Field
              label="Analyst phone or ext."
              error={errors.analystPhone?.message}
            >
              <Input inputMode="numeric" {...register("analystPhone")} />
            </Field>

            <Field label="Scheduler name" error={errors.schedulerName?.message}>
              <Input {...register("schedulerName")} />
            </Field>
            <Field
              label="Scheduler phone or ext."
              error={errors.schedulerPhone?.message}
            >
              <Input inputMode="numeric" {...register("schedulerPhone")} />
            </Field>

            <Field
              label="Claimant phone (optional)"
              error={errors.claimantPhone?.message}
            >
              <Input inputMode="numeric" {...register("claimantPhone")} />
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
              style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
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
              style={{ background: "#DC2626", border: "2px solid #C9A55C" }}
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Book Appointment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
