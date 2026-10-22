import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL ?? "mysql://root@127.0.0.1:3306/kursify" },
  },
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Kursify123!");
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/(owner|admin|keuangan|tutor)$/);
}

test.describe("dokumen PDF dan ekspor laporan", () => {
  test("semua dokumen PDF dapat dibuat oleh staf", async ({ page }) => {
    const [student, payment, payroll, enrollment, certificate] = await Promise.all([
      prisma.student.findFirst({ where: { qrToken: { not: null } } }),
      prisma.payment.findFirst({ where: { status: "valid" } }),
      prisma.tutorPayroll.findFirst({ where: { status: "dibayar" } }),
      prisma.enrollment.findFirst({
        where: { grades: { some: {} } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.certificate.findFirst(),
    ]);

    expect(student).toBeTruthy();
    expect(payment).toBeTruthy();
    expect(payroll).toBeTruthy();
    expect(enrollment).toBeTruthy();
    expect(certificate).toBeTruthy();

    await login(page, "owner@kursify.id");

    const urls = [
      `/api/pdf/kartu/${student!.id}`,
      `/api/pdf/kuitansi/${payment!.id}`,
      `/api/pdf/slip/${payroll!.id}`,
      `/api/pdf/penilaian/${enrollment!.id}`,
      `/api/pdf/sertifikat/${certificate!.enrollmentId}`,
    ];

    for (const url of urls) {
      const response = await page.request.get(url);
      expect(response.status(), url).toBe(200);
      expect(response.headers()["content-type"], url).toContain("application/pdf");
      expect((await response.body()).length, url).toBeGreaterThan(1000);
    }
  });

  test("laporan keuangan dapat diekspor ke PDF dan Excel", async ({ page }) => {
    await login(page, "owner@kursify.id");

    for (const format of ["pdf", "xlsx"] as const) {
      const response = await page.request.get(
        `/api/export/keuangan?format=${format}&periode=2026-10`,
      );
      expect(response.status(), format).toBe(200);
      const contentType = response.headers()["content-type"];
      expect(contentType).toContain(
        format === "pdf" ? "application/pdf" : "spreadsheetml",
      );
      expect((await response.body()).length, format).toBeGreaterThan(1000);
    }
  });

  test("hak akses ekspor mengikuti role", async ({ page }) => {
    await login(page, "keuangan@kursify.id");

    const allowed = await page.request.get("/api/export/honor?format=xlsx&periode=2026-10");
    expect(allowed.status()).toBe(200);

    const forbidden = await page.request.get("/api/export/absensi?format=xlsx&periode=2026-10");
    expect(forbidden.status()).toBe(403);
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
