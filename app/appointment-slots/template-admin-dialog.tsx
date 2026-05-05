"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

type SlotType = "ANY" | "LOOKALIKE" | "PSYCH_TESTING";

export type TemplateTime = {
  id: string;
  hour: number;
  minute: number;
  slotType: SlotType;
};
export type Template = {
  id: string;
  name: string;
  disableAutoAdj: boolean;
  times: TemplateTime[];
};

const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = 7; h <= 19; h++) {
    const minutes = h < 9 ? [0, 15, 30, 45] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    for (const m of minutes) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      out.push({
        value: `${hh}:${mm}`,
        label: `${h12}:${mm} ${ampm}`,
      });
    }
  }
  return out;
})();

const SLOT_TYPE_LABEL: Record<SlotType, string> = {
  ANY: "Any",
  LOOKALIKE: "LookAlike Only",
  PSYCH_TESTING: "Psych With Testing Only",
};

function timeLabel(hour: number, minute: number) {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

export function TemplateAdminDialog({
  open,
  onOpenChange,
  onTemplatesChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplatesChanged?: () => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDisableAutoAdj, setNewDisableAutoAdj] = useState(false);
  const [creating, setCreating] = useState(false);

  const [addTime, setAddTime] = useState<string>("08:00");
  const [addType, setAddType] = useState<SlotType>("ANY");
  const [adding, setAdding] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data: Template[] = await res.json();
      setTemplates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      void refresh();
    } else {
      setEditingId(null);
      setNewName("");
      setNewDisableAutoAdj(false);
    }
  }, [open]);

  async function onCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          disableAutoAdj: newDisableAutoAdj,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed (${res.status})`);
      }
      const created: Template = await res.json();
      setNewName("");
      setNewDisableAutoAdj(false);
      await refresh();
      setEditingId(created.id);
      onTemplatesChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function onCopyTemplate(t: Template) {
    setBusyId(t.id);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${t.id}/copy`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed (${res.status})`);
      }
      await refresh();
      onTemplatesChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onSaveRename(t: Template) {
    const next = renameValue.trim();
    if (!next || next === t.name) {
      setRenamingId(null);
      return;
    }
    setBusyId(t.id);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${t.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed (${res.status})`);
      }
      setRenamingId(null);
      await refresh();
      onTemplatesChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onDeleteTemplate(t: Template) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed (${res.status})`);
      }
      await refresh();
      onTemplatesChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function onAddTime() {
    if (!editingId) return;
    setAdding(true);
    setError(null);
    try {
      const [hStr, mStr] = addTime.split(":");
      const res = await fetch(`/api/templates/${editingId}/times`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hour: Number(hStr),
          minute: Number(mStr),
          slotType: addType,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed (${res.status})`);
      }
      await refresh();
      onTemplatesChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  }

  async function onDeleteTime(time: TemplateTime) {
    if (!editingId) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/templates/${editingId}/times/${time.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed (${res.status})`);
      }
      await refresh();
      onTemplatesChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const editing = editingId
    ? templates.find((t) => t.id === editingId)
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Template: ${editing.name}` : "Template Admin"}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center text-slate-500 py-6">
            <Loader2 className="size-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : editing ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="size-4" />
              All templates
            </button>

            <div className="border border-slate-300 rounded-md p-3 bg-slate-50">
              <div className="font-semibold text-sm mb-2">Add a time</div>
              <div className="flex items-end gap-2 flex-wrap">
                <div className="space-y-1">
                  <Label className="text-xs">Time</Label>
                  <Select
                    value={addTime}
                    onValueChange={(v) => setAddTime(v ?? "08:00")}
                  >
                    <SelectTrigger className="w-32">
                      <span data-slot="select-value">
                        {TIME_OPTIONS.find((o) => o.value === addTime)?.label ??
                          addTime}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={addType}
                    onValueChange={(v) => setAddType((v as SlotType) ?? "ANY")}
                  >
                    <SelectTrigger className="w-56">
                      <span data-slot="select-value">
                        {SLOT_TYPE_LABEL[addType]}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANY">Any</SelectItem>
                      <SelectItem value="LOOKALIKE">LookAlike Only</SelectItem>
                      <SelectItem value="PSYCH_TESTING">
                        Psych With Testing Only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={onAddTime}
                  disabled={adding}
                  className="text-white hover:brightness-95 h-9"
                  style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
                >
                  {adding ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Add Time
                </Button>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">
                Times ({editing.times.length})
              </div>
              {editing.times.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No times added yet — use the form above.
                </p>
              ) : (
                <table className="w-full text-sm border border-slate-300">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Time</th>
                      <th className="px-3 py-2 font-semibold">Appt Type</th>
                      <th className="px-3 py-2 font-semibold w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editing.times.map((t) => (
                      <tr key={t.id} className="border-t border-slate-200">
                        <td className="px-3 py-1.5 tabular-nums">
                          {timeLabel(t.hour, t.minute)}
                        </td>
                        <td className="px-3 py-1.5">
                          {SLOT_TYPE_LABEL[t.slotType]}
                        </td>
                        <td className="px-3 py-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDeleteTime(t)}
                            className="h-7 text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                          >
                            <Trash2 className="size-3.5" />
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border border-slate-300 rounded-md p-3 bg-slate-50">
              <div className="font-semibold text-sm mb-2">
                Create a new template
              </div>
              <div className="flex items-end gap-2 flex-wrap">
                <div className="space-y-1 flex-1 min-w-48">
                  <Label className="text-xs">Template Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Standard 9-5"
                  />
                </div>
                <label className="flex items-center gap-2 h-9 cursor-pointer">
                  <Checkbox
                    checked={newDisableAutoAdj}
                    onCheckedChange={(v) => setNewDisableAutoAdj(Boolean(v))}
                  />
                  <span className="text-sm text-slate-700">Disable Auto Adj</span>
                </label>
                <Button
                  onClick={onCreate}
                  disabled={creating || !newName.trim()}
                  className="text-white hover:brightness-95 h-9"
                  style={{ background: "#0085CA", border: "2px solid #C9A55C" }}
                >
                  {creating && <Loader2 className="size-4 animate-spin" />}
                  Create Template
                </Button>
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">
                Existing templates ({templates.length})
              </div>
              {templates.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No templates yet. Create one above.
                </p>
              ) : (
                <table className="w-full text-sm border border-slate-300">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Times</th>
                      <th className="px-3 py-2 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id} className="border-t border-slate-200">
                        <td className="px-3 py-1.5 font-medium">
                          {renamingId === t.id ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={renameValue}
                                autoFocus
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void onSaveRename(t);
                                  if (e.key === "Escape") setRenamingId(null);
                                }}
                                className="h-7 text-sm"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void onSaveRename(t)}
                                disabled={busyId === t.id}
                                className="h-7 text-xs"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRenamingId(null)}
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              {t.name}
                              <button
                                type="button"
                                onClick={() => {
                                  setRenameValue(t.name);
                                  setRenamingId(t.id);
                                }}
                                className="text-slate-400 hover:text-slate-700"
                                title="Rename"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums">
                          {t.times.length}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(t.id)}
                              className="h-7 text-xs"
                            >
                              Edit times
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onCopyTemplate(t)}
                              disabled={busyId === t.id}
                              className="h-7 text-xs"
                            >
                              {busyId === t.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Copy className="size-3.5" />
                              )}
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onDeleteTemplate(t)}
                              className="h-7 text-xs text-rose-700 border-rose-200 hover:bg-rose-50"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
