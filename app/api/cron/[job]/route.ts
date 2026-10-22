import { NextResponse } from "next/server";
import { runCronJob, type CronJobName } from "@/lib/services/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOBS: CronJobName[] = [
  "generate-spp",
  "generate-honor",
  "reminder",
  "overdue",
  "recurring",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ job: string }> },
) {
  return handle(request, params);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job: string }> },
) {
  return handle(request, params);
}

async function handle(request: Request, paramsPromise: Promise<{ job: string }>) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET belum diatur." }, { status: 500 });
  }
  const auth = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const valid = auth === `Bearer ${secret}` || headerSecret === secret;
  if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { job } = await paramsPromise;
  if (!JOBS.includes(job as CronJobName)) {
    return NextResponse.json({ error: `Job tidak dikenal: ${job}` }, { status: 404 });
  }

  try {
    const result = await runCronJob(job as CronJobName);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(`Cron ${job} gagal`, error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Gagal" },
      { status: 500 },
    );
  }
}
