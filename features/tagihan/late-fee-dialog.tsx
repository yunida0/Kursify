"use client";

import { useState } from "react";
import { Gavel } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { adjustLateFeeAction } from "@/features/tagihan/actions";
import { formatRupiah } from "@/lib/money";

export function LateFeeDialog({
  invoiceId,
  denda,
}: {
  invoiceId: string;
  denda: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Gavel className="h-3.5 w-3.5" /> Atur Denda
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus / Kurangi Denda</DialogTitle>
          <DialogDescription>
            Denda saat ini {formatRupiah(denda)}. Nominal baru tidak boleh lebih besar dari denda
            saat ini. Tindakan akan tercatat pada audit log.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={adjustLateFeeAction} submitLabel="Simpan Denda" onSuccess={() => setOpen(false)}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <Field label="Denda Baru" htmlFor="nominal" required>
            <Input
              id="nominal"
              name="nominal"
              inputMode="numeric"
              required
              defaultValue={denda}
              placeholder="0"
            />
          </Field>
          <Field label="Alasan" htmlFor="reason" required>
            <Textarea
              id="reason"
              name="reason"
              required
              minLength={5}
              placeholder="Contoh: denda dihapus karena siswa sakit dan sudah konfirmasi"
            />
          </Field>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
