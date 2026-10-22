"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";
import { SubmitButton } from "./submit-button";
import { cn } from "@/lib/utils";

type FormAction = (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  submitLabel = "Simpan",
  pendingLabel = "Menyimpan...",
  cancelHref,
  cancelLabel = "Batal",
  className,
  footerClassName,
  onSuccess,
  variant = "default",
  size = "default",
  resetOnSuccess = false,
  hideSubmit = false,
}: {
  action: FormAction;
  children: React.ReactNode;
  submitLabel?: string;
  pendingLabel?: string;
  cancelHref?: string;
  cancelLabel?: string;
  className?: string;
  footerClassName?: string;
  onSuccess?: () => void;
  variant?: "default" | "secondary" | "outline" | "destructive" | "success";
  size?: "default" | "sm" | "lg";
  resetOnSuccess?: boolean;
  hideSubmit?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Berhasil disimpan.");
      if (state.redirectTo) {
        router.push(state.redirectTo);
        router.refresh();
      } else {
        if (resetOnSuccess) formRef.current?.reset();
        router.refresh();
        onSuccess?.();
      }
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className={cn("space-y-5", className)}>
      {children}
      {state?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {!hideSubmit ? (
        <div className={cn("flex flex-wrap items-center gap-2 pt-1", footerClassName)}>
          <SubmitButton variant={variant} size={size} pendingText={pendingLabel}>
            {submitLabel}
          </SubmitButton>
          {cancelHref ? (
            <a
              href={cancelHref}
              className="inline-flex h-10 items-center rounded-lg border border-input bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {cancelLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

export function ActionMessage({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (state.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        {state.message ?? "Berhasil."}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {state.error}
    </div>
  );
}
