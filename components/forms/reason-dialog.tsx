"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ActionForm } from "./action-form";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action";
import { Button, type ButtonProps } from "@/components/ui/button";

type Action = (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;

export function ReasonDialog({
  action,
  fields,
  triggerLabel,
  title,
  description,
  placeholder = "Tuliskan alasan...",
  submitLabel = "Simpan",
  variant = "outline",
  size = "sm",
}: {
  action: Action;
  fields: Record<string, string>;
  triggerLabel: React.ReactNode;
  title: string;
  description?: string;
  placeholder?: string;
  submitLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <ActionForm
          action={action}
          submitLabel={submitLabel}
          variant={variant === "default" ? "default" : "destructive"}
          onSuccess={() => setOpen(false)}
        >
          {Object.entries(fields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <div className="space-y-2">
            <Label htmlFor="reason">Alasan</Label>
            <Textarea id="reason" name="reason" required minLength={5} placeholder={placeholder} />
            <p className="text-xs text-muted-foreground">
              Alasan akan dicatat pada audit trail dan tidak dapat dihapus.
            </p>
          </div>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
