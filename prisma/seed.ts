import { PrismaClient, UserRole } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const db = new PrismaClient();
const trainers = [
  ["Ammar Qorni", "ammarqorni.totalquality@gmail.com"],
  ["Ahmat", "ahmat.totalquality@gmail.com"],
  ["Aji Mas Wahyu", "ajimaswahyu.totalquality@gmail.com"],
  ["Amam", "amam.totalquality@gmail.com"],
  ["Daniel", "danieln.totalquality@gmail.com"],
  ["Jonathan", "jonathan.tqindonesia2@gmail.com"],
  ["Kevin Lionel", "kevinlionel.totalquality@gmail.com"],
  ["Nicho", "nicho.totalquality@gmail.com"],
  ["Ricky", "ricky.totalquality@gmail.com"],
] as const;
const participantNames = [
  "Ahmad Fauzi",
  "Dewi Lestari",
  "Andi Pratama",
  "Siti Rahmawati",
  "Rizky Maulana",
  "Nadia Putri",
  "Fajar Hidayat",
  "Indah Permata",
  "Dimas Saputra",
  "Putri Ayuningtyas",
];

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Konfigurasi Supabase Auth wajib diisi sebelum seed.");
  const ref = new URL(url).hostname.split(".")[0];
  for (const name of ["DATABASE_URL", "DIRECT_URL"] as const) {
    const connection = new URL(process.env[name] ?? "");
    if (
      !connection.hostname.endsWith(".supabase.com") &&
      !connection.hostname.endsWith(".supabase.co")
    )
      throw new Error(
        name + " harus menunjuk ke project Supabase yang sama dengan Auth.",
      );
    if (
      !connection.hostname.includes(ref) &&
      !connection.username.endsWith("." + ref)
    )
      throw new Error(name + " dan SUPABASE_URL menunjuk ke project berbeda.");
  }
  if (process.env.ENABLE_DEMO_AUTH === "true")
    throw new Error(
      "Nonaktifkan ENABLE_DEMO_AUTH: seed ini membuat akun Supabase sungguhan.",
    );

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authIds = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) authIds.set(user.email.toLowerCase(), user.id);
    }
    if (data.users.length < 200) break;
  }

  const organization = await db.organization.upsert({
    where: { id: "org-globalindo" },
    create: { id: "org-globalindo", name: "PT Globalindo Intimates" },
    update: { name: "PT Globalindo Intimates", deletedAt: null },
  });
  const accounts = [
    {
      name: "TQ Administrator",
      email: "center@tq-official.com",
      role: UserRole.SUPER_ADMIN,
    },
    ...trainers.map(([name, email]) => ({
      name,
      email,
      role: UserRole.TRAINER,
    })),
    ...participantNames.map((name, index) => ({
      name,
      email:
        (index === 0 ? "participant" : "participant" + (index + 1)) +
        "@globalindointimates.com",
      role: UserRole.PARTICIPANT,
    })),
  ];
  for (const account of accounts) {
    let authId = authIds.get(account.email);
    if (!authId) {
      // Tidak mengirim email atau menetapkan password bersama.
      // Pemilik akun menetapkan password melalui tautan undangan aplikasi.
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        email_confirm: true,
      });
      if (error) throw error;
      authId = data.user.id;
    }
    const user = await db.user.upsert({
      where: { email: account.email },
      create: { ...account, authId, active: true, isDemo: false },
      update: {
        role: account.role,
        authId,
        active: true,
        isDemo: false,
        deletedAt: null,
      },
    });
    if (account.role === UserRole.PARTICIPANT) {
      await db.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: user.id,
          },
        },
        create: { organizationId: organization.id, userId: user.id },
        update: {},
      });
    }
  }
  console.log(
    "Seed selesai: PT Globalindo Intimates, 1 admin, 9 trainer, 10 peserta. Tidak ada data pelatihan yang dibuat. Password diatur melalui undangan aplikasi.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed gagal.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
