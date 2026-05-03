import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

type Cat = "PSYCH" | "MEDICAL" | "SLP";

function categorizeBy(text: string): Cat {
  const t = text.toUpperCase();
  if (/(SPEECH|LANGUAGE|SLP|92523)/.test(t)) return "SLP";
  if (/(PSYCH|MENTAL|MSE|90791|96130|99201MSE|99201PSY)/.test(t)) return "PSYCH";
  return "MEDICAL";
}

async function main() {
  console.log("Backfilling categories + uppercasing names…");

  const specialties = await prisma.specialty.findMany();
  for (const s of specialties) {
    const upper = s.name.toUpperCase();
    const category = categorizeBy(`${s.name} ${s.code}`);
    if (s.name !== upper || s.category !== category) {
      await prisma.specialty.update({
        where: { id: s.id },
        data: { name: upper, category },
      });
      console.log(`  specialty: ${s.name} → ${upper} [${category}]`);
    }
  }

  const exams = await prisma.exam.findMany();
  for (const e of exams) {
    const upper = e.name.toUpperCase();
    const category = categorizeBy(`${e.name} ${e.code}`);
    if (e.name !== upper || e.category !== category) {
      await prisma.exam.update({
        where: { id: e.id },
        data: { name: upper, category },
      });
      console.log(`  exam ${e.code}: ${e.name} → ${upper} [${category}]`);
    }
  }

  const mse = await prisma.exam.findUnique({ where: { code: "MSE" } });
  if (!mse) {
    await prisma.exam.create({
      data: {
        code: "MSE",
        name: "MENTAL STATUS EXAM",
        category: "PSYCH",
        active: true,
      },
    });
    console.log("  added exam: MSE — MENTAL STATUS EXAM [PSYCH]");
  } else {
    console.log("  MSE exam already exists, skipping");
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
