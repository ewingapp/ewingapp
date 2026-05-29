import { Mail, Phone } from "lucide-react";
import { BranchPageHeader } from "@/components/branch-shell";

export default function SupportPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <BranchPageHeader title="Support" />

      <SupportBlock
        intro="If you have any questions about the website, please contact:"
        name="Paul Para"
        phone="303-912-9902"
        email="paragonpsp@gmail.com"
      />

      <SupportBlock
        intro="If you have any questions about appointments, please contact:"
        name="Georgette Ewing"
        phone="916-482-6463"
        email="liz@ewingdiagnostics.com"
      />

      <p className="mt-8 text-xs text-slate-500">
        Live chat with our team is coming soon.
      </p>
    </div>
  );
}

function SupportBlock({
  intro,
  name,
  phone,
  email,
}: {
  intro: string;
  name: string;
  phone: string;
  email: string;
}) {
  return (
    <div
      className="rounded-lg p-5 mb-4 bg-slate-50"
      style={{ border: "2px solid #CBD5E1" }}
    >
      <p className="text-slate-800 mb-3">{intro}</p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-2 text-sm">
        <span className="font-semibold text-slate-900">{name}</span>
        <span className="inline-flex items-center gap-1.5 text-slate-700">
          <Phone className="size-4" style={{ color: "#06B6D4" }} />
          <a href={`tel:${phone.replace(/\D/g, "")}`} className="hover:underline">
            {phone}
          </a>
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-700">
          <Mail className="size-4" style={{ color: "#06B6D4" }} />
          <a href={`mailto:${email}`} className="text-[#06B6D4] hover:underline">
            {email}
          </a>
        </span>
      </div>
    </div>
  );
}
