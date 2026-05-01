import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.location.count();
  if (existing > 0) {
    console.log(`Database already has ${existing} locations — skipping seed.`);
    return;
  }

  console.log("Seeding locations…");
  const locations = await Promise.all([
    prisma.location.create({ data: { name: "Helotes Office", address: "100 Bandera", city: "Helotes", state: "TX", zip: "78023", phone: "2105551001" } }),
    prisma.location.create({ data: { name: "San Antonio Downtown", address: "200 Houston St", city: "San Antonio", state: "TX", zip: "78205", phone: "2105551002" } }),
    prisma.location.create({ data: { name: "Austin North", address: "300 Mopac", city: "Austin", state: "TX", zip: "78759", phone: "5125551003" } }),
  ]);
  const [helotes, sanAntonio, austin] = locations;

  console.log("Seeding specialties…");
  const specialties = await Promise.all([
    prisma.specialty.create({ data: { name: "Psych Eval" } }),
    prisma.specialty.create({ data: { name: "MSE Psych" } }),
    prisma.specialty.create({ data: { name: "Ortho IME" } }),
    prisma.specialty.create({ data: { name: "Internal Medicine IME" } }),
    prisma.specialty.create({ data: { name: "Neuro IME" } }),
  ]);
  const [psychEval, msePsych, orthoIME, intMedIME, neuroIME] = specialties;

  console.log("Seeding doctors…");
  const doctors = await Promise.all([
    prisma.doctor.create({
      data: {
        name: "Dr. Patel",
        notes: "Does not see patients under 16.",
        specialties: { connect: [{ id: psychEval.id }, { id: msePsych.id }] },
        locations: { connect: [{ id: helotes.id }, { id: sanAntonio.id }] },
      },
    }),
    prisma.doctor.create({
      data: {
        name: "Dr. Nguyen",
        notes: "No EKG available at Helotes.",
        specialties: { connect: [{ id: orthoIME.id }] },
        locations: { connect: [{ id: helotes.id }, { id: austin.id }] },
      },
    }),
    prisma.doctor.create({
      data: {
        name: "Dr. Garcia",
        notes: "Spanish-speaking. Prefers AM appointments.",
        specialties: { connect: [{ id: intMedIME.id }] },
        locations: { connect: [{ id: sanAntonio.id }] },
      },
    }),
    prisma.doctor.create({
      data: {
        name: "Dr. Chen",
        notes: "Wheelchair-accessible exam room.",
        specialties: { connect: [{ id: neuroIME.id }, { id: intMedIME.id }] },
        locations: { connect: [{ id: sanAntonio.id }, { id: austin.id }] },
      },
    }),
    prisma.doctor.create({
      data: {
        name: "Dr. Williams",
        notes: "Trauma-informed. 60-min psych evals only.",
        specialties: { connect: [{ id: psychEval.id }] },
        locations: { connect: [{ id: austin.id }] },
      },
    }),
    prisma.doctor.create({
      data: {
        name: "Dr. Okafor",
        notes: "No Friday appointments.",
        specialties: { connect: [{ id: msePsych.id }, { id: orthoIME.id }] },
        locations: { connect: [{ id: helotes.id }] },
      },
    }),
  ]);

  console.log("Seeding state branches…");
  await prisma.stateBranch.createMany({
    data: [
      { name: "DDS Sacramento" },
      { name: "DDS San Diego" },
      { name: "DDS Oakland" },
      { name: "DDS Fresno" },
      { name: "DIR Oakland" },
      { name: "DIR Los Angeles" },
      { name: "EDD Sacramento" },
      { name: "CalHR Sacramento" },
    ],
  });

  console.log("Generating slots for next 30 weekdays…");
  const docsWithRels = await prisma.doctor.findMany({ include: { specialties: true, locations: true } });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const slotsToCreate: { doctorId: string; locationId: string; specialtyId: string; startTime: Date; endTime: Date }[] = [];

  for (let d = 0; d < 30; d++) {
    const day = new Date(today);
    day.setDate(day.getDate() + d);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;

    for (const doc of docsWithRels) {
      for (const loc of doc.locations) {
        for (const spec of doc.specialties) {
          // 8:00 + 8:30 (30-min slots)
          for (const m of [0, 30]) {
            const start = new Date(day);
            start.setHours(8, m, 0, 0);
            const end = new Date(start);
            end.setMinutes(end.getMinutes() + 30);
            slotsToCreate.push({ doctorId: doc.id, locationId: loc.id, specialtyId: spec.id, startTime: start, endTime: end });
          }
          // 9:00 - 18:00 in 10-min increments
          for (let h = 9; h < 18; h++) {
            for (let m = 0; m < 60; m += 10) {
              const start = new Date(day);
              start.setHours(h, m, 0, 0);
              const end = new Date(start);
              end.setMinutes(end.getMinutes() + 10);
              slotsToCreate.push({ doctorId: doc.id, locationId: loc.id, specialtyId: spec.id, startTime: start, endTime: end });
            }
          }
        }
      }
    }
  }

  console.log(`Inserting ${slotsToCreate.length} slots…`);
  // Batch in chunks to avoid query size limits
  const chunk = 1000;
  for (let i = 0; i < slotsToCreate.length; i += chunk) {
    await prisma.slot.createMany({ data: slotsToCreate.slice(i, i + chunk) });
  }

  console.log(`✓ Seeded ${doctors.length} doctors, ${locations.length} locations, ${slotsToCreate.length} slots.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
