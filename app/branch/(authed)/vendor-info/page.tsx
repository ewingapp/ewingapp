import { prisma } from "@/lib/db";
import { BranchPageHeader } from "@/components/branch-shell";

export const dynamic = "force-dynamic";

async function getVendorOrEmpty() {
  const existing = await prisma.vendor.findFirst();
  return existing ?? null;
}

function formatPhone(s: string | null | undefined): string {
  if (!s) return "—";
  const d = s.replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return s;
}

export default async function VendorInfoPage() {
  const [vendor, locations] = await Promise.all([
    getVendorOrEmpty(),
    prisma.location.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <BranchPageHeader title="Vendor Information" />

      <section
        className="rounded-lg p-5 mb-6 bg-slate-50"
        style={{ border: "2px solid #CBD5E1" }}
      >
        <h2 className="font-semibold text-slate-900 mb-3">
          {vendor?.name || "Ewing Diagnostics & Psychological Services"}
        </h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <InfoRow label="Address">
            {vendor?.address ? (
              <>
                {vendor.address}
                {vendor.address2 ? <>, {vendor.address2}</> : null}
                <br />
                {[vendor.city, vendor.state, vendor.zip].filter(Boolean).join(", ")}
              </>
            ) : (
              "—"
            )}
          </InfoRow>
          <InfoRow label="Phone">{formatPhone(vendor?.phone)}</InfoRow>
          <InfoRow label="Fax">{formatPhone(vendor?.fax)}</InfoRow>
          <InfoRow label="Email">
            {vendor?.email ? (
              <a
                href={`mailto:${vendor.email}`}
                className="text-[#06B6D4] hover:underline"
              >
                {vendor.email}
              </a>
            ) : (
              "—"
            )}
          </InfoRow>
          {vendor?.contactName && (
            <InfoRow label="Contact">{vendor.contactName}</InfoRow>
          )}
        </dl>
        {vendor?.description && (
          <p className="mt-4 text-sm text-slate-700 whitespace-pre-wrap">
            {vendor.description}
          </p>
        )}
      </section>

      <h2 className="text-lg font-semibold text-slate-900 mb-3">Our Offices</h2>
      {locations.length === 0 ? (
        <p className="text-sm text-slate-500">No offices listed.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="rounded-lg bg-white p-4"
              style={{ border: "1.5px solid #CBD5E1" }}
            >
              <div className="font-semibold text-slate-900 mb-1">{loc.name}</div>
              <div className="text-sm text-slate-700">
                {loc.address}
                {loc.address2 ? (
                  <>
                    <br />
                    {loc.address2}
                  </>
                ) : null}
                <br />
                {[loc.city, loc.state, loc.zip].filter(Boolean).join(", ")}
              </div>
              {loc.phone && (
                <div className="text-sm text-slate-700 mt-1">
                  Phone: {formatPhone(loc.phone)}
                </div>
              )}
              {loc.contactName && (
                <div className="text-sm text-slate-500 mt-1">
                  Contact: {loc.contactName}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-slate-900">{children}</dd>
    </div>
  );
}
