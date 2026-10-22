import { generateSppForMonth, runOverdueInvoices, sendDueReminders } from "./invoices";
import { generatePayrollDrafts, remindUnpaidPayroll } from "./payroll";
import { generateRecurringDrafts } from "./expenses";
import { monthKey, previousMonthKey } from "@/lib/dates";

export type CronJobName =
  | "generate-spp"
  | "generate-honor"
  | "reminder"
  | "overdue"
  | "recurring";

export interface CronResult {
  job: CronJobName;
  ranAt: string;
  summary: Record<string, unknown>;
}

/** Semua job dibuat idempoten; aman dipanggil berulang kali. */
export async function runCronJob(job: CronJobName): Promise<CronResult> {
  const ranAt = new Date().toISOString();
  switch (job) {
    case "generate-spp": {
      const result = await generateSppForMonth(monthKey());
      return { job, ranAt, summary: result };
    }
    case "generate-honor": {
      const result = await generatePayrollDrafts(previousMonthKey());
      return { job, ranAt, summary: result };
    }
    case "reminder": {
      const [invoices, payroll] = await Promise.all([
        sendDueReminders(),
        remindUnpaidPayroll(),
      ]);
      return {
        job,
        ranAt,
        summary: { reminderJatuhTempo: invoices.sent, reminderHonor: payroll.notified },
      };
    }
    case "overdue": {
      const result = await runOverdueInvoices();
      return { job, ranAt, summary: result };
    }
    case "recurring": {
      const result = await generateRecurringDrafts();
      return { job, ranAt, summary: result };
    }
    default:
      throw new Error(`Job tidak dikenal: ${job}`);
  }
}
