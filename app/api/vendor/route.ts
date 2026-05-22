import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// Vendor is a singleton — there is one row. GET returns it (creating an
// empty placeholder on first access). PUT updates fields in place.

const updateSchema = z.object({
  name: z.string().max(200).optional(),
  address: z.string().max(200).optional(),
  address2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zip: z.string().max(20).optional(),
  phone: z.string().max(40).optional(),
  fax: z.string().max(40).optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  loginId: z.string().max(100).optional(),
  password: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  appointmentNotification: z.enum(["ALWAYS", "LIMITED", "NEVER"]).optional(),
  description: z.string().max(5000).optional(),
  newAppointments: z.boolean().optional(),
});

async function getOrCreateVendor() {
  const existing = await prisma.vendor.findFirst();
  if (existing) return existing;
  return prisma.vendor.create({ data: {} });
}

function schemaErrorResponse(err: unknown) {
  const msg = err instanceof Error ? err.message : "";
  // Prisma raises P2021 ("table does not exist") before the migration runs.
  // Surface a clearer hint so the UI can tell the user what to do.
  if (/does not exist|P2021|relation .* does not exist/i.test(msg)) {
    return NextResponse.json(
      {
        error:
          "Vendor table is missing — run `npm run db:push` to apply the latest Prisma schema.",
      },
      { status: 503 },
    );
  }
  console.error("[api/vendor]", err);
  return NextResponse.json(
    { error: msg || "Unexpected error" },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const vendor = await getOrCreateVendor();
    return NextResponse.json(vendor);
  } catch (err) {
    return schemaErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  const json = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const vendor = await getOrCreateVendor();
    const updated = await prisma.vendor.update({
      where: { id: vendor.id },
      data: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return schemaErrorResponse(err);
  }
}
