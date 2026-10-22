"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VerifyTokenForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const cleaned = token.trim().replace(/^.*\/verifikasi\//, "");
        if (!cleaned) {
          setError("Masukkan token verifikasi terlebih dahulu.");
          return;
        }
        setError(null);
        router.push(`/verifikasi/${encodeURIComponent(cleaned)}`);
      }}
    >
      <Input
        value={token}
        onChange={(event) => setToken(event.target.value)}
        placeholder="Tempel token atau tautan verifikasi dari QR"
        aria-label="Token verifikasi"
      />
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      <Button type="submit" className="w-full">
        <ScanLine className="h-4 w-4" /> Verifikasi Sertifikat
      </Button>
    </form>
  );
}
