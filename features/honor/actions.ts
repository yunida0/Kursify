"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/guard";
import { execute, fail, ok, type ActionResult } from "@/lib/action";
import { formString } from "@/lib/form";
import {
  approvePayroll,
  generatePayrollDrafts,
  payPayroll,
  reviewPayroll,
} from "@/lib/services/payroll";

export async function generatePayrollAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    await requireRole("keuangan", "owner");
    const periode = formString(formData, "periode");
    if (!/^\d{4}-\d{2}$/.test(periode)) return fail("Periode tidak valid.");
    const result = await generatePayrollDrafts(periode);
    revalidatePath("/keuangan/honor");
    revalidatePath("/owner/persetujuan");
    return ok(`${result.count} draft rekap honor periode ${periode} dibuat.`);
  });
}

export async function reviewPayrollAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("keuangan", "owner");
    const payrollId = formString(formData, "payrollId");
    await reviewPayroll({ payrollId, userId: user.id });
    revalidatePath("/keuangan/honor");
    revalidatePath(`/keuangan/honor/${payrollId}`);
    revalidatePath("/owner/persetujuan");
    return ok("Rekap honor direview dan diajukan ke alur pengeluaran.");
  });
}

export async function approvePayrollAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("owner");
    const payrollId = formString(formData, "payrollId");
    await approvePayroll({ payrollId, ownerId: user.id });
    revalidatePath("/owner/persetujuan");
    revalidatePath("/keuangan/honor");
    revalidatePath(`/keuangan/honor/${payrollId}`);
    return ok("Honor disetujui.");
  });
}

export async function payPayrollAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return execute(async () => {
    const user = await requireRole("keuangan", "owner");
    const payrollId = formString(formData, "payrollId");
    const result = await payPayroll({ payrollId, userId: user.id, role: user.role });
    revalidatePath("/keuangan/honor");
    revalidatePath(`/keuangan/honor/${payrollId}`);
    revalidatePath("/keuangan");
    revalidatePath("/keuangan/buku-kas");
    revalidatePath("/tutor/honor");
    return ok(
      `Honor dibayarkan. Slip ${result.payroll.slipNo} terbit dan absensi periode dikunci.`,
    );
  });
}
