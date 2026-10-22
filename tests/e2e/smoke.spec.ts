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
}

test.describe("halaman publik", () => {
  test("pendaftaran dan verifikasi dapat diakses tanpa login", async ({ page }) => {
    await page.goto("/daftar");
    await expect(page.getByText("Pendaftaran Online")).toBeVisible();

    await page.goto("/verifikasi");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/verifikasi/i);
  });

  test("sertifikat demo terverifikasi lewat token", async ({ page }) => {
    const certificate = await prisma.certificate.findFirst({
      include: { enrollment: { include: { student: true } } },
      orderBy: { issuedAt: "desc" },
    });
    expect(certificate).toBeTruthy();

    await page.goto(`/verifikasi/${certificate!.verifyToken}`);
    await expect(page.getByText(certificate!.certificateNo)).toBeVisible();
    await expect(page.getByText(certificate!.enrollment.student.nama).first()).toBeVisible();
    await expect(page.getByText("Sertifikat ini sah dan terdaftar")).toBeVisible();
  });
});

test.describe("owner", () => {
  test("dashboard, honor, dan laporan keuangan terbuka", async ({ page }) => {
    await login(page, "owner@kursify.id");
    await page.waitForURL("**/owner");
    await expect(page.getByRole("heading", { name: /Dashboard Owner/i })).toBeVisible();

    await page.goto("/keuangan/honor");
    await expect(page.getByRole("heading", { name: "Honor Tutor" })).toBeVisible();

    await page.goto("/keuangan/buku-kas");
    await expect(page.getByRole("heading", { name: "Buku Kas" })).toBeVisible();

    await page.goto("/keuangan/laporan");
    await expect(page.getByRole("heading", { name: "Laporan Keuangan" })).toBeVisible();

    await page.goto("/owner/persetujuan");
    await expect(page.getByRole("heading", { name: "Persetujuan Owner" })).toBeVisible();
  });
});

test.describe("staf keuangan", () => {
  test("dashboard, honor, buku kas, dan laporan terbuka", async ({ page }) => {
    await login(page, "keuangan@kursify.id");
    await page.waitForURL("**/keuangan");
    await expect(page.getByRole("heading", { name: /Dashboard Keuangan/i })).toBeVisible();

    await page.goto("/keuangan/honor");
    await expect(page.getByRole("heading", { name: "Honor Tutor" })).toBeVisible();
    await expect(page.getByText("Daftar Rekap Honor")).toBeVisible();

    await page.goto("/keuangan/buku-kas");
    await expect(page.getByRole("heading", { name: "Buku Kas" })).toBeVisible();

    await page.goto("/keuangan/laporan");
    await expect(page.getByRole("heading", { name: "Laporan Keuangan" })).toBeVisible();
  });

  test("tidak dapat membuka area owner", async ({ page }) => {
    await login(page, "keuangan@kursify.id");
    await page.waitForURL("**/keuangan");
    await page.goto("/owner/pengguna");
    await page.waitForURL("**/keuangan");
  });
});

test.describe("tutor", () => {
  test("dashboard, kelas, nilai, dan honor terbuka", async ({ page }) => {
    await login(page, "tutor@kursify.id");
    await page.waitForURL("**/tutor");
    await expect(page.getByRole("heading", { name: /Selamat datang/i })).toBeVisible();

    await page.goto("/tutor/kelas");
    await expect(page.getByRole("heading", { name: "Kelas Saya" })).toBeVisible();
    const firstClass = page.locator('a[href^="/tutor/kelas/"]').first();
    await expect(firstClass).toBeVisible();
    const classHref = await firstClass.getAttribute("href");
    expect(classHref).toBeTruthy();
    await page.goto(classHref!);
    await expect(page.getByText("Siswa & Kehadiran")).toBeVisible();

    await page.goto("/tutor/honor");
    await expect(page.getByRole("heading", { name: "Honor Saya" })).toBeVisible();
    await expect(page.getByText("Riwayat Honor & Slip")).toBeVisible();
  });
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
