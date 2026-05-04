import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function specialtyDuration(name: string): number {
  const n = name.toUpperCase();
  if (n.includes("PSYCHOLOGICAL WITH TESTING")) return 60;
  if (n.includes("MSE")) return 40;
  return 30;
}

function examDuration(code: string, name: string): number {
  const n = name.toUpperCase();
  const c = code.toUpperCase();
  if (c === "MSE") return 40;
  if (c.startsWith("96130-")) return 60;
  if (c === "99201MSE") return 40;
  if (n.includes("MENTAL STATUS")) return 40;
  return 30;
}

async function main() {
  console.log("Backfilling durations…");
  const specs = await prisma.specialty.findMany();
  for (const s of specs) {
    const d = specialtyDuration(s.name);
    if (s.durationMinutes !== d) {
      await prisma.specialty.update({
        where: { id: s.id },
        data: { durationMinutes: d },
      });
      console.log(`  specialty ${s.name}: ${s.durationMinutes} → ${d} min`);
    }
  }
  const exams = await prisma.exam.findMany();
  for (const e of exams) {
    const d = examDuration(e.code, e.name);
    if (e.durationMinutes !== d) {
      await prisma.exam.update({
        where: { id: e.id },
        data: { durationMinutes: d },
      });
      console.log(`  exam ${e.code}: ${e.durationMinutes} → ${d} min`);
    }
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
