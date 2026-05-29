"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search } from "lucide-react";

import { BranchPageHeader } from "@/components/branch-shell";
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
import { ptFmtDateShort, ptFmtTime, ptFmtDateLong } from "@/lib/pt";
import { isLateCancel } from "@/lib/late-cancel";

type Appt = {
  id: string;
  startTime: string;
  caseNumber: string;
  firstInitial: string;
  lastNamePrefix: string;
  status:
    | "SCHEDULED"
    | "KEPT"
    | "NO_SHOW"
    | "CANCELLED"
    | "MOVED"
    | "OTHER";
  scheduledBy: "BRANCH" | "VENDOR";
  cancelledBy: "BRANCH" | "VENDOR" | null;
  cancelledByName: string;
  cancelledAt: string | null;
  isLateCancellation: boolean;
  movedBy: "BRANCH" | "VENDOR" | null;
  movedByName: string;
  movedAt: string | null;
  statusNote: string;
  stateBranch: string;
  doctor: { id: string; name: string; firstName: string; lastName: string };
  specialty: { id: string; name: string };
  location: { id: string; name: string };
};

const STATUS_LABEL: Record<Appt["status"], string> = {
  SCHEDULED: "Scheduled",
  KEPT: "Kept",
  NO_SHOW: "No Show",
  CANCELLED: "Cancelled",
  MOVED: "Moved",
  OTHER: "Other",
};

function doctorDisplay(d: { firstName: string; lastName: string }): string {
  return `${d.firstName} ${d.lastName}`.trim();
}

export default function ExistingAppointmentsPage() {
  const [caseNumber, setCaseNumber] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [results, setResults] = useState<Appt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appt | null>(null);

  function applyUpdated(updated: Appt) {
    setResults((prev) =>
      prev ? prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)) : prev,
    );
  }

  useEffect(() => {
    if (!submitted) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/appointments?caseNumber=${encodeURIComponent(submitted)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((data: Appt[]) => setResults(data))
      .catch((e) => {
        if (e?.name !== "AbortError") setError("Search failed.");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [submitted]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = caseNumber.trim();
    if (!trimmed) {
      setError("Enter a case number.");
      return;
    }
    setError(null);
    setSubmitted(trimmed);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <BranchPageHeader title="Existing Appointment Search" />

      <form
        onSubmit={onSubmit}
        className="rounded-lg p-5 mb-6 bg-slate-50 flex flex-wrap items-end gap-4"
        style={{ border: "2px solid #CBD5E1" }}
      >
        <div className="flex-1 min-w-[200px] max-w-xs space-y-1.5">
          <Label htmlFor="caseNumber" className="text-xs uppercase tracking-wide text-slate-500">
            Case Number
          </Label>
          <Input
            id="caseNumber"
            value={caseNumber}
            onChange={(e) => setCaseNumber(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 155666"
            className="h-10 bg-white"
            autoFocus
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="h-10 text-white font-medium shadow-sm hover:brightness-95"
          style={{ background: "#06B6D4", border: "2px solid #06B6D4" }}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Search
        </Button>
      </form>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {results && <ResultsTable rows={results} onCancelClick={setCancelTarget} />}

      <CancelDialog
        target={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={(updated) => {
          applyUpdated(updated);
          setCancelTarget(null);
        }}
      />
    </div>
  );
}

function ResultsTable({
  rows,
  onCancelClick,
}: {
  rows: Appt[];
  onCancelClick: (appt: Appt) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No appointments found for that case number.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
        <span className="text-sm text-slate-600">
          <strong>{rows.length}</strong> result{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <Th>Office</Th>
              <Th>Date</Th>
              <Th>Time</Th>
              <Th>Case#</Th>
              <Th>Claimant</Th>
              <Th>Doctor</Th>
              <Th>Exam</Th>
              <Th>Appt. Status</Th>
              <th className="px-3 py-2 text-left font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2">{a.location.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {ptFmtDateShort(a.startTime)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {ptFmtTime(a.startTime)}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{a.caseNumber}</td>
                <td className="px-3 py-2">
                  {a.lastNamePrefix}, {a.firstInitial}
                </td>
                <td className="px-3 py-2">{doctorDisplay(a.doctor)}</td>
                <td className="px-3 py-2">{a.specialty.name}</td>
                <td className="px-3 py-2">
                  <StatusCell appt={a} />
                </td>
                <td className="px-3 py-2">
                  <ActionGroup appt={a} onCancelClick={onCancelClick} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">
      {children}
    </th>
  );
}

function ActionGroup({
  appt,
  onCancelClick,
}: {
  appt: Appt;
  onCancelClick: (appt: Appt) => void;
}) {
  const cancelDisabled = appt.status === "CANCELLED" || appt.status === "MOVED";
  const moveDisabled = appt.status === "MOVED" || appt.status === "CANCELLED";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        <ActionLink href={`/appointments/${appt.id}`}>View</ActionLink>
        <ActionLink href={`/appointments/${appt.id}/edit`}>Edit</ActionLink>
        <ActionButton
          disabled={cancelDisabled}
          onClick={() => onCancelClick(appt)}
        >
          Cancel
        </ActionButton>
        <ActionLink href={`/reschedule/${appt.id}`} disabled={moveDisabled}>
          Move
        </ActionLink>
      </div>
      {appt.status === "CANCELLED" && appt.cancelledAt && (
        <div className="text-[11px] leading-tight text-slate-600 max-w-[14rem]">
          Cancelled by {appt.cancelledBy === "BRANCH" ? "Branch" : "Vendor"}
          {appt.cancelledByName && ` (${appt.cancelledByName})`} on{" "}
          {ptFmtDateShort(appt.cancelledAt)} {ptFmtTime(appt.cancelledAt)}
          {appt.statusNote && (
            <div className="text-slate-500">Reason: {appt.statusNote}</div>
          )}
        </div>
      )}
      {appt.status === "MOVED" && appt.movedAt && (
        <div className="text-[11px] leading-tight text-slate-600 max-w-[14rem]">
          Moved by {appt.movedBy === "BRANCH" ? "Branch" : "Vendor"}
          {appt.movedByName && ` (${appt.movedByName})`} on{" "}
          {ptFmtDateShort(appt.movedAt)} {ptFmtTime(appt.movedAt)}
          {appt.statusNote && (
            <div className="text-slate-500">{appt.statusNote}</div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        className="inline-flex items-center px-2 py-1 rounded text-xs text-slate-400 bg-slate-50 cursor-not-allowed"
        style={{ border: "1.5px solid #06B6D4", opacity: 0.5 }}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center px-2 py-1 rounded text-xs text-slate-700 hover:bg-slate-50 hover:text-[#06B6D4]"
      style={{ border: "1.5px solid #06B6D4" }}
    >
      {children}
    </Link>
  );
}

function ActionButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center px-2 py-1 rounded text-xs text-slate-700 hover:bg-slate-50 hover:text-[#06B6D4] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
      style={{ border: "1.5px solid #06B6D4" }}
    >
      {children}
    </button>
  );
}

function StatusCell({ appt }: { appt: Appt }) {
  const color: Record<Appt["status"], string> = {
    SCHEDULED: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    KEPT: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    NO_SHOW: "bg-rose-50 text-rose-700 ring-rose-200",
    CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
    MOVED: "bg-amber-50 text-amber-700 ring-amber-200",
    OTHER: "bg-slate-50 text-slate-600 ring-slate-200",
  };
  const late = isLateCancel(appt);
  const className =
    appt.status === "CANCELLED" && late
      ? "bg-rose-100 text-rose-800 ring-rose-300"
      : color[appt.status];
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${className} w-fit`}
        title={appt.status === "CANCELLED" && late ? "Cancelled < 48 hours before appointment" : undefined}
      >
        {STATUS_LABEL[appt.status]}
        {appt.status === "CANCELLED" && late && (
          <span className="ml-1 font-semibold">• &lt; 48h</span>
        )}
      </span>
      {appt.statusNote && appt.status !== "CANCELLED" && appt.status !== "MOVED" && (
        <span className="text-[11px] text-slate-500 max-w-[14rem] leading-tight">
          {appt.statusNote}
        </span>
      )}
    </div>
  );
}

function CancelDialog({
  target,
  onClose,
  onCancelled,
}: {
  target: Appt | null;
  onClose: () => void;
  onCancelled: (updated: Appt) => void;
}) {
  const [reason, setReason] = useState("");
  const [cancelledByName, setCancelledByName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setReason("");
      setCancelledByName("");
      setErr(null);
    }
  }, [target]);

  async function submit() {
    if (!target) return;
    if (!cancelledByName.trim()) {
      setErr("Cancelled by is required.");
      return;
    }
    if (!reason.trim()) {
      setErr("Reason is required.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/appointments/${target.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          cancelledByName: cancelledByName.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to cancel");
      }
      const updated = await res.json();
      onCancelled({ ...target, ...updated });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel appointment</DialogTitle>
          <DialogDescription>
            {target && (
              <>
                {ptFmtDateLong(target.startTime)} at {ptFmtTime(target.startTime)} —{" "}
                {target.lastNamePrefix}, {target.firstInitial} (Case #
                {target.caseNumber}) with {doctorDisplay(target.doctor)} at{" "}
                {target.location.name}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="cancelled-by" className="text-sm">
              Cancelled by <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="cancelled-by"
              value={cancelledByName}
              onChange={(e) => setCancelledByName(e.target.value)}
              placeholder="Your name"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason" className="text-sm">
              Reason for cancellation <span className="text-rose-600">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="e.g. Claimant unavailable; conflicting appointment; …"
            />
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Keep appointment
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="text-white font-medium"
            style={{ background: "#06B6D4", border: "2px solid #06B6D4" }}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Cancel appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
