import type { NotificationChannel, OutgoingMessage } from "./channel";

/** Driver Fonnte (WhatsApp gateway). Token dibaca dari env FONNTE_TOKEN. */
export const fonnteChannel: NotificationChannel = {
  name: "fonnte",
  async send(message: OutgoingMessage) {
    const token = process.env.FONNTE_TOKEN;
    if (!token) return { ok: false, error: "FONNTE_TOKEN belum diatur." };
    try {
      const body = new URLSearchParams({
        target: message.to,
        message: message.text,
        countryCode: "62",
      });
      const res = await fetch("https://api.fonnte.com/send", {
        method: "POST",
        headers: { Authorization: token },
        body,
      });
      if (!res.ok) {
        return { ok: false, error: `Fonnte HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Gagal kirim" };
    }
  },
};
