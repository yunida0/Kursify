import { Badge } from "@/components/ui/badge";

const LABELS: Record<string, { label: string; variant: "success" | "info" | "warning" | "default" }> = {
  owner: { label: "Owner", variant: "success" },
  admin: { label: "Admin", variant: "info" },
  keuangan: { label: "Staf Keuangan", variant: "warning" },
  tutor: { label: "Tutor", variant: "default" },
};

export function RoleLabel({ role }: { role: string }) {
  const item = LABELS[role] ?? { label: role, variant: "default" as const };
  return <Badge variant={item.variant}>{item.label}</Badge>;
}
