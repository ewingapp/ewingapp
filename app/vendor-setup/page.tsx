import Link from "next/link";
import { Stethoscope, Building2, ListChecks, Users, BadgeCheck } from "lucide-react";

import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  ready: boolean;
}[] = [
  {
    href: "/vendor-setup/doctors",
    title: "Doctors",
    description: "Add, edit, or remove doctors. Set certification, languages, ages, and active status.",
    icon: Stethoscope,
    ready: true,
  },
  {
    href: "/vendor-setup/offices",
    title: "Offices",
    description: "Add, edit, or remove the office locations where appointments are held.",
    icon: Building2,
    ready: true,
  },
  {
    href: "/vendor-setup/specialties",
    title: "Specialties & Exams",
    description: "Manage the specialties and exam types each doctor can perform.",
    icon: ListChecks,
    ready: false,
  },
  {
    href: "/vendor-setup/profile",
    title: "Vendor Profile",
    description: "Company name, address, contact info, and description.",
    icon: BadgeCheck,
    ready: false,
  },
  {
    href: "/vendor-setup/roles",
    title: "Roles & Logins",
    description: "Manage user logins and what each role can access.",
    icon: Users,
    ready: false,
  },
];

export default function VendorSetupPage() {
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <PageHeader title="Vendor Setup" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const card = (
              <Card
                className={`h-full transition ${
                  s.ready
                    ? "hover:shadow-md hover:border-slate-300 cursor-pointer"
                    : "opacity-60 cursor-not-allowed"
                }`}
              >
                <CardHeader>
                  <div
                    className="grid place-items-center size-10 rounded-lg mb-3 text-white"
                    style={{ background: "#0085CA" }}
                  >
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="flex items-center gap-2">
                    {s.title}
                    {!s.ready && (
                      <span className="text-[10px] uppercase tracking-wide font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        Coming soon
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
              </Card>
            );
            return s.ready ? (
              <Link key={s.href} href={s.href}>
                {card}
              </Link>
            ) : (
              <div key={s.href}>{card}</div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
