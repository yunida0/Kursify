import type { NotificationChannel, OutgoingMessage } from "./channel";

export const logChannel: NotificationChannel = {
  name: "log",
  async send(message: OutgoingMessage) {
    console.log(
      `[NOTIFIKASI:${message.to}] ${message.subject ?? ""}\n${message.text}`,
    );
    return { ok: true };
  },
};
