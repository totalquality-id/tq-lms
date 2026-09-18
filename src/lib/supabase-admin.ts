import "server-only";

/**
 * Operasi akun yang memerlukan kunci service role Supabase.
 *
 * Kunci ini boleh melakukan apa saja pada proyek, jadi ia tidak pernah
 * meninggalkan server: seluruh fungsi di sini hanya dipanggil dari service
 * layer, dan tidak ada satu pun yang menerima input mentah dari peramban.
 *
 * REST API dipakai langsung alih-alih supabase-js karena yang dibutuhkan hanya
 * tiga endpoint admin, dan klien penuh akan membawa serta manajemen sesi yang
 * justru tidak diinginkan di sisi server.
 */

export function supabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function admin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Supabase Auth belum dikonfigurasi pada lingkungan ini, sehingga akun tidak dapat disiapkan.",
    );
  return {
    url: url.replace(/\/$/, ""),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  };
}

type AuthUser = { id: string; email?: string };

/** Mencari akun Supabase Auth berdasarkan email; null bila belum ada. */
export async function findAuthUser(email: string): Promise<AuthUser | null> {
  const { url, headers } = admin();
  const response = await fetch(
    `${url}/auth/v1/admin/users?per_page=200&filter=${encodeURIComponent(email)}`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { users?: AuthUser[] };
  const target = email.toLowerCase();
  return (
    (body.users ?? []).find((user) => user.email?.toLowerCase() === target) ??
    null
  );
}

/**
 * Menyiapkan akun Supabase Auth tanpa kata sandi. Kata sandi baru ditetapkan
 * pemiliknya sendiri lewat tautan undangan — dengan begitu tidak ada kata sandi
 * sementara yang perlu dikirim, dicatat, atau ditebak siapa pun.
 */
export async function ensureAuthUser(email: string): Promise<string> {
  const existing = await findAuthUser(email);
  if (existing) return existing.id;

  const { url, headers } = admin();
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, email_confirm: true }),
  });
  const body = (await response.json()) as AuthUser & { msg?: string };
  if (!response.ok || !body.id) {
    // Perlombaan dengan permintaan lain masih mungkin terjadi; kalau akunnya
    // ternyata sudah ada, itu bukan kegagalan.
    const retry = await findAuthUser(email);
    if (retry) return retry.id;
    throw new Error(
      body.msg ?? "Akun Supabase Auth gagal disiapkan untuk email ini.",
    );
  }
  return body.id;
}

/** Menetapkan kata sandi akun. Dipakai setelah token undangan/reset dipakai. */
export async function setAuthPassword(authId: string, password: string) {
  const { url, headers } = admin();
  const response = await fetch(`${url}/auth/v1/admin/users/${authId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ password, email_confirm: true }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { msg?: string };
    throw new Error(
      body.msg ?? "Kata sandi gagal disimpan pada penyedia autentikasi.",
    );
  }
}
