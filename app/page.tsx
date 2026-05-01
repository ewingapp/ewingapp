import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const cards = [
  { href: "/schedule", title: "Schedule New Appointment", description: "Book a slot for a claimant", accent: "bg-blue-600" },
  { href: "/appointments", title: "View Appointments", description: "Filter, update status, cancel", accent: "bg-emerald-600" },
  { href: "/reschedule", title: "Reschedule", description: "Move an existing appointment", accent: "bg-amber-600" },
  { href: "/reports", title: "Reports", description: "Daily and weekly breakdowns", accent: "bg-purple-600" },
  { href: "/admin", title: "Admin", description: "Locations, doctors, specialties, branches", accent: "bg-slate-700" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold">CA</div>
          <div>
            <div className="font-semibold">California State Scheduling</div>
            <div className="text-xs text-slate-500">Prototype</div>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
        <p className="text-slate-500 mb-6">Pick a workflow to get started.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Link key={c.href} href={c.href}>
              <Card className="hover:shadow-md hover:border-slate-300 transition cursor-pointer h-full">
                <CardHeader>
                  <div className={`w-10 h-10 ${c.accent} rounded-lg mb-3`} />
                  <CardTitle>{c.title}</CardTitle>
                  <CardDescription>{c.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
