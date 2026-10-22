"use client";

import { useState } from "react";
import { BadgePercent } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { applyDiscountAction } from "@/features/tagihan/actions";
import { formatRupiah } from "@/lib/money";

export function DiscountDialog({
  invoiceId,
  nominal,
  potongan,
  label = "Beri Potongan",
}: {
  invoiceId: string;
  nominal: number;
  potongan: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const sisaPotongan = Math.max(0, nominal - potongan);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BadgePercent className="h-3.5 w-3.5" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Beri Potongan / Beasiswa</DialogTitle>
          <DialogDescription>
            Nominal tagihan {formatRupiah(nominal)}. Sisa potongan yang dapat diberikan{" "}
            {formatRupiah(sisaPotongan)}.
          </DialogDescription>
        </DialogHeader>
        <ActionForm action={applyDiscountAction} submitLabel="Terapkan Potongan" onSuccess={() => setOpen(false)}>
          <input type="hidden" name="invoiceId" value={invoiceId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jenis Potongan" htmlFor="jenis" required>
              <Select id="jenis" name="jenis" defaultValue="saudara" required>
                <option value="saudara">Saudara kandung</option>
                <option value="beasiswa">Beasiswa</option>
                <option value="lain">Lain-lain</option>
              </Select>
            </Field>
            <Field label="Nominal" htmlFor="nominal" required>
              <Input
                id="nominal"
                name="nominal"
                inputMode="numeric"
                required
                max={sisaPotongan}
                placeholder="0"
              />
            </Field>
          </div>
          <Field label="Alasan" htmlFor="reason" required>
            <Textarea
              id="reason"
              name="reason"
              required
              minLength={5}
              placeholder="Contoh: diskon saudara kandung siswa Bella Safitri"
            />
          </Field>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
