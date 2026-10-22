"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ScannableStudent {
  id: string;
  nama: string;
  studentCode: string | null;
  qrToken: string | null;
}

export function QrScanner({
  students,
  onScan,
}: {
  students: ScannableStudent[];
  onScan: (studentId: string) => void;
}) {
  const elementId = useId().replace(/:/g, "");
  const scannerRef = useRef<{
    start: (config: { facingMode: string }, options: { fps: number; qrbox: number }, cb: (text: string) => void, error?: (message: string) => void) => Promise<void>;
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Arahkan kamera ke QR pada kartu siswa.");
  const [error, setError] = useState<string | null>(null);
  const lastToken = useRef<string>("");

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => undefined);
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    };
  }, []);

  async function start() {
    setError(null);
    setLoading(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(elementId, { verbose: false });
      scannerRef.current = scanner as unknown as typeof scannerRef.current;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        (text) => {
          if (text === lastToken.current) return;
          lastToken.current = text;
          const student = students.find((item) => item.qrToken === text);
          if (student) {
            onScan(student.id);
            setMessage(`${student.nama} ditandai hadir.`);
          } else {
            setMessage("QR tidak dikenali sebagai siswa di kelas ini.");
          }
          window.setTimeout(() => {
            lastToken.current = "";
          }, 2500);
        },
        () => undefined,
      );
      setActive(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Kamera tidak dapat dibuka: ${err.message}`
          : "Kamera tidak dapat dibuka. Pastikan izin kamera diberikan.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function stop() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore stop error
      }
      scannerRef.current = null;
    }
    setActive(false);
    setMessage("Arahkan kamera ke QR pada kartu siswa.");
  }

  return (
    <div className="space-y-3 rounded-xl border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Camera className="h-4 w-4 text-primary" /> Scan QR Kartu Siswa
          </p>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
        {active ? (
          <Button type="button" variant="outline" size="sm" onClick={stop}>
            <CameraOff className="h-4 w-4" /> Hentikan
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={start} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {loading ? "Membuka..." : "Buka Kamera"}
          </Button>
        )}
      </div>
      <div
        id={elementId}
        className={active || loading ? "mx-auto w-full max-w-[320px] overflow-hidden rounded-lg" : "hidden"}
      />
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
