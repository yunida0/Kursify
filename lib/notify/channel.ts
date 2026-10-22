export interface OutgoingMessage {
  to: string;
  subject?: string;
  text: string;
  attachmentPath?: string | null;
}

export interface NotificationChannel {
  name: string;
  send(message: OutgoingMessage): Promise<{ ok: boolean; error?: string }>;
}
