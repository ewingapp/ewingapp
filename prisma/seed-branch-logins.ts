import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

// Loads the 13 DDS branch logins from the State's
// "Branch CE Scheduling website passwords" sheet. Idempotent: re-running
// re-hashes and updates each branch's credentials in place. Passwords are
// stored ONLY as bcrypt hashes — never in plaintext.
//
// Run with:  npm run db:seed-branch-logins

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not set");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// name = StateBranch display name (must match what the booking form / reports
// use). loginId + password come straight from the State's sheet.
const BRANCH_LOGINS: { name: string; loginId: string; password: string }[] = [
  { name: "Oakland", loginId: "oakdds", password: "okd123" },
  { name: "Stockton", loginId: "stockton", password: "sto123" },
  { name: "Sacramento", loginId: "sacramento", password: "sac123" },
  { name: "Roseville", loginId: "roseville", password: "rsv123" },
  { name: "Central Valley", loginId: "central", password: "cen123" },
  { name: "Sierra", loginId: "sierra", password: "sie123" },
  { name: "Covina", loginId: "covina", password: "cov123" },
  { name: "Rancho Bernardo", loginId: "rbdds", password: "ran123" },
  { name: "San Diego", loginId: "sandiego", password: "san123" },
  { name: "La Jolla", loginId: "lajolla", password: "laj123" },
  { name: "Glendale", loginId: "glendale5", password: "glen45#1" },
  { name: "Los Angeles", loginId: "lastate", password: "las123" },
  { name: "Los Angeles – S&L Only", loginId: "laspsnl", password: "laspce" },
];

// Branches kept WITHOUT a login (not State-analyst logins). "Other" is used
// by someone else per the vendor. Anything not in BRANCH_LOGINS or this list
// is removed so the branch list matches the State's sheet exactly.
const BRANCHES_WITHOUT_LOGIN = ["Other"];

async function main() {
  console.log(`Seeding ${BRANCH_LOGINS.length} branch logins…`);
  for (const b of BRANCH_LOGINS) {
    const passwordHash = await bcrypt.hash(b.password, 10);
    await prisma.stateBranch.upsert({
      where: { name: b.name },
      update: { loginId: b.loginId, passwordHash },
      create: { name: b.name, loginId: b.loginId, passwordHash },
    });
    console.log(`  ✓ ${b.name.padEnd(26)} → ${b.loginId}`);
  }

  // Keep the no-login branches (e.g. "Other"), creating any that are missing.
  for (const name of BRANCHES_WITHOUT_LOGIN) {
    await prisma.stateBranch.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  ✓ ${name.padEnd(26)} → (no login)`);
  }

  // Remove every other branch so the list matches the State's sheet exactly.
  const keep = [...BRANCH_LOGINS.map((b) => b.name), ...BRANCHES_WITHOUT_LOGIN];
  const removed = await prisma.stateBranch.deleteMany({
    where: { name: { notIn: keep } },
  });
  console.log(`✓ Pruned ${removed.count} stale branch(es) not on the list.`);
  console.log("✓ Branch logins seeded (passwords stored as bcrypt hashes).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
