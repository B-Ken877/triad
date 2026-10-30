import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis as unknown as { triadPrisma?: PrismaClient };
export const db = globalForPrisma.triadPrisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});
if (process.env.NODE_ENV !== "production") globalForPrisma.triadPrisma = db;
