"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, KeyRound } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Branch = {
  id: string;
  name: string;
  loginId: string | null;
  hasPassword: boolean;
};

function suggestLoginId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function BranchLoginsPage() {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/branches")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Load failed"))))
      .then((data: Branch[]) => setBranches(data))
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Load failed"));
  }, []);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <PageHeader title="Branch Logins" />
        <p className="text-sm text-slate-600 mb-6">
          Each State branch gets one shared login. Set a login ID and password
          per branch; analysts at that branch use those credentials at{" "}
          <span className="font-mono">/branch/login</span>.
        </p>

        {loadError && (
          <p className="text-sm text-rose-700 mb-4">{loadError}</p>
        )}

        {!branches ? (
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : (
          <div className="space-y-3">
            {branches.map((b) => (
              <BranchRow
                key={b.id}
                branch={b}
                onSaved={(updated) =>
                  setBranches((curr) =>
                    curr ? curr.map((x) => (x.id === updated.id ? updated : x)) : curr,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function BranchRow({
  branch,
  onSaved,
}: {
  branch: Branch;
  onSaved: (b: Branch) => void;
}) {
  const [loginId, setLoginId] = useState(branch.loginId ?? suggestLoginId(branch.name));
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    setSavedMsg(null);
    try {
      const res = await fetch(`/api/branches/${branch.id}/credentials`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password: password || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Save failed");
      }
      const data: Branch = await res.json();
      onSaved(data);
      setPassword("");
      setSavedMsg(password ? "Saved — password updated" : "Saved");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-lg p-4 bg-white"
      style={{ border: "1.5px solid #CBD5E1" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-semibold text-slate-900">{branch.name}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
            <KeyRound className="size-3.5" />
            {branch.hasPassword ? "Password set" : "No password set yet"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`loginId-${branch.id}`} className="text-xs uppercase tracking-wide text-slate-500">
            Login ID
          </Label>
          <Input
            id={`loginId-${branch.id}`}
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="e.g. la-west"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`password-${branch.id}`} className="text-xs uppercase tracking-wide text-slate-500">
            {branch.hasPassword ? "New password (optional)" : "Password"}
          </Label>
          <Input
            id={`password-${branch.id}`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={branch.hasPassword ? "Leave blank to keep current" : "8+ chars"}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-white"
            style={{ background: "#06B6D4", border: "2px solid #06B6D4" }}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
          {savedMsg && <span className="text-xs text-emerald-700">{savedMsg}</span>}
          {err && <span className="text-xs text-rose-700">{err}</span>}
        </div>
      </div>
    </div>
  );
}
