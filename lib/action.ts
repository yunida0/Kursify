export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  redirectTo?: string;
}

export function ok(message?: string, redirectTo?: string): ActionResult {
  return { ok: true, message, redirectTo };
}

export function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Menjalankan aksi dan mengubah error menjadi hasil yang aman untuk form. */
export async function execute(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Unique constraint")) {
        return fail("Data serupa sudah ada. Periksa kembali isian Anda.");
      }
      if (error.message.includes("Foreign key constraint")) {
        return fail("Data terkait tidak ditemukan atau masih dipakai.");
      }
      return fail(error.message);
    }
    console.error(error);
    return fail("Terjadi kesalahan. Silakan coba lagi.");
  }
}
