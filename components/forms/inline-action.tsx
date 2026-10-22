"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function InlineAction({
  action,
  fields = {},
  label,
  pendingLabel,
  confirmText,
  variant = "outline",
  size = "sm",
  className,
  disabled,
}: {
  action: Action;
  fields?: Record<string, string | number | boolean | undefined | null>;
  label: React.ReactNode;
  pendingLabel?: string;
  confirmText?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const router = useRouter();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Berhasil.");
      if (state.redirectTo) router.push(state.redirectTo);
      else router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      action={formAction}
      className={cn("inline-flex", className)}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([key, value]) =>
        value === undefined || value === null ? null : (
          <input key={key} type="hidden" name={key} value={String(value)} />
        ),
      )}
      <Button type="submit" variant={variant} size={size} disabled={pending || disabled}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? pendingLabel ?? "Memproses..." : label}
      </Button>
    </form>
  );
}
