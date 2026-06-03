import { Mail, Phone } from "lucide-react";
import { BranchPageHeader } from "@/components/branch-shell";

export default function SupportPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <BranchPageHeader title="Support" />

      <div
        className="rounded-lg p-5 mb-4 bg-slate-50"
        style={{ border: "2px solid #CBD5E1" }}
      >
        <p className="text-slate-800 mb-3">
          If you have any questions, please contact:
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-2 text-sm">
          <span className="font-semibold text-slate-900">
            Ewing Medical Services Inc
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <Phone className="size-4" style={{ color: "#06B6D4" }} />
            <a href="tel:9164826463" className="hover:underline">
              916-482-6463
            </a>
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <Mail className="size-4" style={{ color: "#06B6D4" }} />
            <a
              href="mailto:georgette@ewingmed.com"
              className="text-[#06B6D4] hover:underline"
            >
              georgette@ewingmed.com
            </a>
          </span>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-500">
        Live chat with our team is coming soon.
      </p>
    </div>
  );
}
