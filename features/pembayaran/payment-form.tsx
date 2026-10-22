"use client";

import { ActionForm } from "@/components/forms/action-form";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatRupiah } from "@/lib/money";
import { recordPaymentAction } from "./actions";

export function PaymentForm({
  invoiceId,
  invoiceNo,
  sisa,
  jumlahPembayaran,
  disabledReason,
}: {
  invoiceId: string;
  invoiceNo: string;
  sisa: number;
  jumlahPembayaran: number;
  disabledReason?: string;
}) {
  if (disabledReason) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        {disabledReason}
      </div>
    );
  }

  return (
    <ActionForm
      action={recordPaymentAction}
      submitLabel="Catat Pembayaran"
      pendingLabel="Menyimpan..."
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div className="rounded-lg bg-slate-50 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Tagihan</span>
          <span className="font-semibold">{invoiceNo}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-muted-foreground">Sisa yang harus dibayar</span>
          <span className="text-lg font-bold text-primary">{formatRupiah(sisa)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {jumlahPembayaran} dari maksimal 2 pembayaran valid sudah digunakan.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nominal Pembayaran" htmlFor="nominal" required>
          <Input
            id="nominal"
            name="nominal"
            inputMode="numeric"
            required
            min={1}
            max={sisa}
            defaultValue={sisa}
          />
        </Field>
        <Field label="Tanggal Pembayaran" htmlFor="tanggal" required>
          <Input
            id="tanggal"
            name="tanggal"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>
        <Field
          label="Metode"
          htmlFor="metode"
          required
          hint="Transfer/QRIS wajib menyertakan referensi atau bukti."
        >
          <Select id="metode" name="metode" required defaultValue="tunai">
            <option value="tunai">Tunai</option>
            <option value="transfer">Transfer bank</option>
            <option value="qris">QRIS</option>
          </Select>
        </Field>
        <Field label="No. Referensi" htmlFor="noReferensi">
          <Input id="noReferensi" name="noReferensi" placeholder="Contoh: TRX-123456" />
        </Field>
        <Field label="Bukti Pembayaran" htmlFor="bukti" className="sm:col-span-2">
          <Input id="bukti" name="bukti" type="file" accept="image/*,application/pdf" />
        </Field>
        <Field label="Catatan" htmlFor="note" className="sm:col-span-2" hint="Opsional, tidak disimpan sebagai referensi.">
          <Textarea id="note" name="note" rows={2} placeholder="Catatan internal penerimaan pembayaran" />
        </Field>
      </div>
    </ActionForm>
  );
}
