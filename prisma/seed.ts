import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const LOCATIONS = [
  "Fresno",
  "Livermore",
  "Modesto",
  "Roseville",
  "Sacramento",
  "San Diego",
  "Santa Rosa",
  "Stockton",
  "VCE_EXAMS",
  "Visalia",
];

const BRANCHES = [
  "Central Valley",
  "Covina",
  "Glendale",
  "La Jolla",
  "LA State Programs",
  "Los Angeles East",
  "Los Angeles South",
  "Los Angeles West",
  "Main Contact",
  "Oakland",
  "Oakland State Programs",
  "Other",
  "Rancho Bernardo",
  "Renew Scheduler",
  "Roseville",
  "Sacramento",
  "San Diego",
  "Sierra",
  "Stockton",
];

async function reset() {
  console.log("Resetting tables…");
  await prisma.appointment.deleteMany();
  await prisma.doctorSchedule.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.location.deleteMany();
  await prisma.specialty.deleteMany();
  await prisma.stateBranch.deleteMany();
}

async function main() {
  const force = process.argv.includes("--force") || process.env.RESET === "1";
  const existingLocations = await prisma.location.findMany({ select: { name: true } });
  const looksFresh = existingLocations.length === 0;
  const looksLikeOldPlaceholder = existingLocations.some((l) =>
    ["Helotes Office", "San Antonio Downtown", "Austin North"].includes(l.name),
  );

  if (!looksFresh && !looksLikeOldPlaceholder && !force) {
    console.log(
      `Database has ${existingLocations.length} locations that don't look like the old TX placeholders. Skipping. Pass --force to reset anyway.`,
    );
    return;
  }

  if (!looksFresh) {
    await reset();
  }

  console.log("Seeding locations…");
  const locations = await Promise.all(
    LOCATIONS.map((name) =>
      prisma.location.create({
        data: {
          name,
          address: "Address TBD",
          city: name === "VCE_EXAMS" ? "—" : name,
          state: "CA",
          zip: "00000",
          phone: "0000000000",
        },
      }),
    ),
  );
  const byName = Object.fromEntries(locations.map((l) => [l.name, l]));

  console.log("Seeding specialties…");
  const specialties = await Promise.all([
    prisma.specialty.create({ data: { name: "PSYCH EVAL", category: "PSYCH" } }),
    prisma.specialty.create({ data: { name: "MSE PSYCH", category: "PSYCH" } }),
    prisma.specialty.create({ data: { name: "ORTHO IME", category: "MEDICAL" } }),
    prisma.specialty.create({ data: { name: "INTERNAL MEDICINE IME", category: "MEDICAL" } }),
    prisma.specialty.create({ data: { name: "NEURO IME", category: "MEDICAL" } }),
  ]);
  const [psychEval, msePsych, orthoIME, intMedIME, neuroIME] = specialties;

  console.log("Seeding doctors…");
  const doctors = await Promise.all([
    prisma.doctor.create({
      data: {
        name: "Dr. Patel",
        notes: "Does not see patients under 16.",
        specialties: { connect: [{ id: psychEval.id }, { id: msePsych.id }] },
        locations: { connect: [{ id: byName["Sacramento"].id }, { id: byName["Stockton"].id }, { id: byName["Modesto"].id }] },
      },
    }),
    prisma.doctor.create({
      data: {
        name: "Dr. Nguyen",
        notes: "No EKG available at all locations.",
        specialties: { connect: [{ id: orthoIME.id }] },
        locations: { connect: [{ id: byName["Fresno"].id }, { id: byName["Visalia"].id }, { id: byName["Roseville"].id }] },
      },
    }),
    prisma.doctor.create({
      data: {
        name: "Dr. Garcia",
        notes: "Spanish-speaking. Prefers AM appointments.",
        specialties: { connect: [{ id: intMedIME.id }] },
        locations: { connect: [{ id: byName["Sacramento"].id }, { id: byName["Stockton"].id }] },
      },
    }),
    prisma.doctor.create({
      data: {
        name: "Dr. Chen",
        notes: "Wheelchair-accessible exam room.",
        specialties: { connect: [{ id: neuroIME.id }, { id: intMedIME.id }] },
        locations: { connect: [{ id: byName["San Diego"].id }, { id: byName["Visalia"].id }, { id: byName["Fresno"].id }] },
      },
    }),
    prisma.doctor.create({
      data: {
        name: "Dr. Williams",
        notes: "Trauma-informed. 60-min psych evals only.",
        specialties: { connect: [{ id: psychEval.id }] },
        locations: { connect: [{ id: byName["Livermore"].id }, { id: byName["Santa Rosa"].id }] },
      },
    }),
    prisma.doctor.create({
      data: {
        name: "Dr. Okafor",
        notes: "No Friday appointments.",
        specialties: { connect: [{ id: msePsych.id }, { id: orthoIME.id }] },
        locations: { connect: [{ id: byName["Fresno"].id }, { id: byName["Modesto"].id }] },
      },
    }),
  ]);

  console.log("Seeding state branches…");
  await prisma.stateBranch.createMany({
    data: BRANCHES.map((name) => ({ name })),
  });

  console.log(`✓ Seeded ${doctors.length} doctors, ${locations.length} locations, ${BRANCHES.length} branches.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
