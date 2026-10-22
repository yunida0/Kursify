import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { nextCounter } from "@/lib/numbering";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL ?? "mysql://root@127.0.0.1:3306/kursify" },
  },
});

/**
 * Regresi untuk race condition nomor urut. Tes ini membutuhkan database
 * (DATABASE_URL). Bila database tidak tersedia, tes dilewati agar unit test
 * murni tetap bisa dijalankan di lingkungan tanpa MySQL.
 */
describe("numbering concurrency", () => {
  const key = `test-concurrency-${Date.now()}`;

  afterAll(async () => {
    await prisma.counter.deleteMany({ where: { key } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it("tidak menghasilkan nomor ganda saat 25 transaksi paralel", async (context) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      context.skip();
      return;
    }

    const results = await Promise.all(
      Array.from({ length: 25 }, () =>
        prisma.$transaction((tx) => nextCounter(tx, key, 2026, 1)),
      ),
    );
    const sorted = [...results].sort((a, b) => a - b);

    expect(new Set(results).size).toBe(25);
    expect(sorted[0]).toBe(1);
    expect(sorted.at(-1)).toBe(25);
    expect(sorted).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
  });
});
