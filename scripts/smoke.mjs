import assert from "node:assert/strict";
const base = "http://localhost:3000";
async function session(email, password = process.env.DEMO_PASSWORD) {
  const cookies = new Map();
  async function request(path, init = {}) {
    const r = await fetch(base + path, {
      ...init,
      redirect: "manual",
      headers: {
        ...init.headers,
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
    });
    for (const c of r.headers.getSetCookie()) {
      const pair = c.split(";")[0];
      const i = pair.indexOf("=");
      cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return r;
  }
  const csrf = await (await request("/api/auth/csrf")).json();
  await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password,
      callbackUrl: base + "/",
    }).toString(),
  });
  return request;
}
let count = 0;
async function check(name, fn) {
  await fn();
  console.log(`PASS ${name}`);
  count++;
}
await check("anonymous admin route redirects to login", async () => {
  const r = await fetch(base + "/admin", { redirect: "manual" });
  assert.equal(r.status, 307);
  assert.match(r.headers.get("location"), /login/);
});
const participant = await session("participant@globalindo.local");
await check("participant login and own training", async () => {
  const r = await participant("/my-training/training-isms-sept");
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Ahmad Fauzi/);
});
await check(
  "participant cannot open another organization training",
  async () => {
    const r = await participant("/my-training/training-qms-sept");
    const text = await r.text();
    assert.ok(r.status === 404 || text.includes("Halaman tidak ditemukan"));
    assert.ok(!text.includes("learning@globalindo.local"));
  },
);
await check("participant is redirected out of admin", async () => {
  const r = await participant("/admin");
  const text = await r.text();
  assert.ok(r.status === 307 || text.includes("NEXT_REDIRECT"));
  assert.ok(!text.includes("Ringkasan operasional pelatihan"));
});
const pic = await session("pic@globalindo.local");
await check("PIC sees own organization only", async () => {
  const r = await pic("/organization/training");
  const text = await r.text();
  assert.equal(r.status, 200);
  assert.ok(text.includes("PT Globalindo Intimates"));
  assert.ok(!text.includes("PT Nusantara Manufacturing"));
});
await check("PIC direct foreign batch URL is denied", async () => {
  const r = await pic("/organization/training/training-qms-sept");
  const text = await r.text();
  assert.ok(r.status === 404 || text.includes("Halaman tidak ditemukan"));
});
const trainer = await session("trainer@totalquality.local");
await check("trainer sees assigned training", async () => {
  assert.equal(
    (await trainer("/trainer/training/training-isms-sept")).status,
    200,
  );
});
await check("unassigned trainer is denied", async () => {
  const r = await trainer("/trainer/training/training-ohs-sept");
  const text = await r.text();
  assert.ok(r.status === 404 || text.includes("Halaman tidak ditemukan"));
});
const admin = await session("admin@totalquality.local");
for (const route of [
  "/admin",
  "/admin/courses",
  "/admin/courses/course-isms",
  "/admin/training",
  "/admin/training/training-isms-sept",
  "/admin/participants",
  "/admin/trainers",
  "/admin/organizations",
  "/admin/users",
  "/profile",
])
  await check(`admin route ${route}`, async () => {
    const r = await admin(route);
    assert.equal(r.status, 200);
    assert.ok(!(await r.text()).includes("Halaman belum berhasil dimuat"));
  });
await check("search returns empty state", async () => {
  const r = await admin("/admin/training?q=not-a-real-training-xyz");
  assert.match(await r.text(), /Belum ada training/);
});
const invalid = await session("admin@totalquality.local", "definitely-wrong");
await check("invalid password has no authenticated session", async () => {
  const r = await invalid("/api/auth/session");
  assert.deepEqual(await r.json(), null);
});

/* ---------------------------------------------------------------------------
   Pembelajaran, penilaian, dan sertifikasi
   --------------------------------------------------------------------------- */

await check("participant sees the learning tabs and progress", async () => {
  const text = await (
    await participant("/my-training/training-isms-sept")
  ).text();
  assert.match(text, /Kemajuan belajar/);
  assert.match(text, /Daftar aktivitas/);
});

await check("participant can open a lesson of an enrolled training", async () => {
  const r = await participant("/my-training/training-isms-sept/learn");
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Modul 1/);
});

await check("participant assessment page hides the answer key", async () => {
  const text = await (
    await participant("/my-training/training-isms-sept/assessment")
  ).text();
  assert.match(text, /Pre-Test/);
  // Kunci jawaban hanya boleh ada di dalam snapshot percobaan di server.
  assert.ok(!text.includes('"correct":true'));
});

await check("participant certificate page lists the requirements", async () => {
  const text = await (
    await participant("/my-training/training-isms-july/certificate")
  ).text();
  assert.match(text, /Syarat kelulusan/);
  assert.match(text, /Ujian akhir/);
});

await check("participant history shows the competency record", async () => {
  const r = await participant("/history");
  assert.equal(r.status, 200);
  assert.match(await r.text(), /TQI-ISMS-2026-/);
});

await check("participant cannot read another participant's certificate", async () => {
  // Nomor sertifikat milik peserta lain pada kelas yang sama.
  const other = await participant("/api/certificates/TQI-ISMS-2026-000002/pdf");
  assert.equal(other.status, 403);
});

await check("participant owns their own certificate PDF", async () => {
  const r = await participant("/api/certificates/TQI-ISMS-2026-000008/pdf");
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  const bytes = new Uint8Array(await r.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
});

/* ---------------------------------------------------------------------------
   Verifikasi publik
   --------------------------------------------------------------------------- */

await check("certificate verification is public and minimal", async () => {
  const r = await fetch(base + "/verify/TQI-ISMS-2026-000008");
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.match(text, /Sertifikat terverifikasi/);
  assert.match(text, /Ahmad Fauzi/);
  // Halaman publik tidak boleh membocorkan email atau nilai peserta.
  assert.ok(!text.includes("participant@globalindo.local"));
});

await check("unknown certificate numbers are reported, not guessed", async () => {
  const text = await (
    await fetch(base + "/verify/TQI-ISMS-2026-999999")
  ).text();
  assert.match(text, /Sertifikat tidak ditemukan/);
});

/* ---------------------------------------------------------------------------
   Trainer
   --------------------------------------------------------------------------- */

for (const route of [
  "/trainer",
  "/trainer/reviews",
  "/trainer/training/training-isms-sept/participants",
  "/trainer/training/training-isms-sept/attendance",
  "/trainer/training/training-isms-sept/assessments",
  "/trainer/training/training-isms-sept/assignments",
  "/trainer/training/training-isms-sept/evaluation",
  "/trainer/training/training-isms-sept/resources",
  "/trainer/training/training-isms-sept/certificates",
])
  await check(`trainer route ${route}`, async () => {
    const r = await trainer(route);
    assert.equal(r.status, 200);
    assert.ok(!(await r.text()).includes("Halaman belum berhasil dimuat"));
  });

await check("trainer cannot manage an unassigned training", async () => {
  const r = await trainer("/trainer/training/training-ohs-sept/attendance");
  const text = await r.text();
  assert.ok(r.status === 404 || text.includes("Halaman tidak ditemukan"));
});

/* ---------------------------------------------------------------------------
   PIC perusahaan
   --------------------------------------------------------------------------- */

await check("PIC certificate list stays within the organization", async () => {
  const r = await pic("/organization/certificates");
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.ok(!text.includes("PT Nusantara Manufacturing"));
});

await check("PIC cannot reach the question bank", async () => {
  const r = await pic("/admin/question-bank");
  const text = await r.text();
  assert.ok(r.status === 307 || text.includes("NEXT_REDIRECT"));
});

/* ---------------------------------------------------------------------------
   Administrator: halaman fase lanjutan dan ekspor
   --------------------------------------------------------------------------- */

for (const route of [
  "/admin/question-bank",
  "/admin/certificates",
  "/admin/evaluations",
  "/admin/reports",
  "/admin/training/training-isms-july/participants",
  "/admin/training/training-isms-july/attendance",
  "/admin/training/training-isms-july/assessments",
  "/admin/training/training-isms-july/assignments",
  "/admin/training/training-isms-july/evaluation",
  "/admin/training/training-isms-july/resources",
  "/admin/training/training-isms-july/certificates",
])
  await check(`admin route ${route}`, async () => {
    const r = await admin(route);
    assert.equal(r.status, 200);
    assert.ok(!(await r.text()).includes("Halaman belum berhasil dimuat"));
  });

await check("report export is a semicolon CSV with a BOM", async () => {
  const r = await admin("/api/reports?kind=participants");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /text\/csv/);
  const bytes = new Uint8Array(await r.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.match(new TextDecoder().decode(bytes), /Peserta;Email;Organisasi/);
});

await check("unknown report kinds are rejected", async () => {
  assert.equal((await admin("/api/reports?kind=salary")).status, 400);
});

await check("participants cannot export reports at all", async () => {
  // Kelas yang diikuti peserta juga memuat teman sekelasnya; ekspor akan
  // membocorkan nama, email, dan nilai mereka.
  const r = await participant("/api/reports?kind=participants");
  assert.equal(r.status, 403);
  assert.ok(!(await r.text()).includes("Dewi Lestari"));
});

console.log(`${count} integration checks passed.`);
