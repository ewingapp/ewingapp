import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          Welcome to Ewing Diagnostics &amp; Psychological Services
        </h1>
        <p className="text-slate-600">
          Use the tabs above to manage your schedule.
        </p>
      </div>
    </AppShell>
  );
}
