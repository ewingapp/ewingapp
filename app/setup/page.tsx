"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [alreadySetUp, setAlreadySetUp] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then((data: { needsSetup: boolean }) => {
        setAlreadySetUp(!data.needsSetup);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Setup failed");
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Image
            src="/ewing-logo.png"
            alt="Ewing Medical & Psychological Services"
            width={1181}
            height={335}
            priority
            className="h-20 w-auto mx-auto"
          />
        </div>
        <div
          className="bg-white rounded-lg p-6"
          style={{ border: "2px solid #CBD5E1" }}
        >
          <h1 className="text-lg font-semibold text-slate-900 mb-1 text-center">
            First-time setup
          </h1>
          <p className="text-sm text-slate-500 mb-4 text-center">
            Create the vendor login. This page only works once.
          </p>

          {checking ? (
            <p className="text-sm text-slate-500 text-center">Checking…</p>
          ) : alreadySetUp ? (
            <p className="text-sm text-rose-700 text-center">
              Vendor is already set up. Go to{" "}
              <a href="/login" className="text-[#06B6D4] hover:underline">
                /login
              </a>
              .
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="loginId">Vendor login ID</Label>
                <Input
                  id="loginId"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  autoFocus
                  required
                  minLength={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password (8+ chars)</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              {error && <p className="text-sm text-rose-700">{error}</p>}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full text-white"
                style={{ background: "#06B6D4", border: "2px solid #06B6D4" }}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Create vendor login
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
