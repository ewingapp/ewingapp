"use client";

import { FormEvent, Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function VendorLoginPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "vendor", loginId, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Login failed");
      }
      router.push(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell heading="Vendor Login">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="loginId">Login ID</Label>
          <Input
            id="loginId"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
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
          Sign in
        </Button>
      </form>
      <div className="text-center text-sm text-slate-500 mt-6">
        State branch?{" "}
        <Link
          href="/branch/login"
          className="text-[#06B6D4] hover:underline"
        >
          Sign in here
        </Link>
      </div>
    </AuthShell>
  );
}

export function AuthShell({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
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
          className="bg-slate-50 rounded-lg p-6"
          style={{ border: "2px solid #CBD5E1" }}
        >
          <h1 className="text-lg font-semibold text-slate-900 mb-4 text-center">
            {heading}
          </h1>
          {children}
        </div>
      </div>
    </div>
  );
}
