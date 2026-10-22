import { prisma } from "@/lib/db";
import type { NotificationChannel } from "./channel";
import { logChannel } from "./log";
import { fonnteChannel } from "./fonnte";

export function getChannel(): NotificationChannel {
  const driver = process.env.NOTIFY_DRIVER ?? "log";
  return driver === "fonnte" ? fonnteChannel : logChannel;
}

export interface SendNotificationInput {
  tujuan: string;
  template: string;
  text: string;
  subject?: string;
  payload?: Record<string, unknown>;
  invoiceId?: string | null;
  channel?: "whatsapp" | "email";
}

/**
 * Mengirim notifikasi lewat driver aktif dan selalu mencatatnya
 * ke notification_logs (terkirim / gagal).
 */
export async function sendNotification(input: SendNotificationInput) {
  const channel = input.channel ?? "whatsapp";
  const channelDriver = channel === "email" ? logChannel : getChannel();
  let status = "terkirim";
  let error: string | undefined;

  try {
    const result = await channelDriver.send({
      to: input.tujuan,
      subject: input.subject,
      text: input.text,
    });
    if (!result.ok) {
      status = "gagal";
      error = result.error;
    }
  } catch (e) {
    status = "gagal";
    error = e instanceof Error ? e.message : "Gagal mengirim notifikasi";
  }

  try {
    await prisma.notificationLog.create({
      data: {
        tujuan: input.tujuan,
        channel,
        template: input.template,
        payload: {
          text: input.text,
          subject: input.subject ?? null,
          error: error ?? null,
          ...(input.payload ?? {}),
        },
        status,
        invoiceId: input.invoiceId ?? null,
      },
    });
  } catch (e) {
    console.error("Gagal mencatat notification_logs", e);
  }

  return { ok: status === "terkirim", status, error };
}
