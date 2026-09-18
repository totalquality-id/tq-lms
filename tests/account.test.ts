import assert from "node:assert/strict";
import { test } from "node:test";

import {
  forgotPasswordSchema,
  MIN_PASSWORD,
  passwordSchema,
} from "@/schemas/account";

const valid = { password: "Pelatihan#2026", confirm: "Pelatihan#2026" };

test("a password shorter than the minimum is rejected", () => {
  assert.equal(passwordSchema.safeParse(valid).success, true);
  const short = "a".repeat(MIN_PASSWORD - 1);
  assert.equal(
    passwordSchema.safeParse({ password: short, confirm: short }).success,
    false,
  );
});

test("the confirmation must match, and the error points at it", () => {
  const result = passwordSchema.safeParse({
    password: "Pelatihan#2026",
    confirm: "Pelatihan#2025",
  });
  assert.equal(result.success, false);
  if (!result.success)
    assert.deepEqual(result.error.issues[0].path, ["confirm"]);
});

test("length alone does not pass: repeated characters are rejected", () => {
  // "aaaaaaaaaaaa" memenuhi panjang minimum tetapi tidak memberi perlindungan.
  const repeated = "a".repeat(MIN_PASSWORD + 4);
  assert.equal(
    passwordSchema.safeParse({ password: repeated, confirm: repeated }).success,
    false,
  );
  const twoChars = "abababababab";
  assert.equal(
    passwordSchema.safeParse({ password: twoChars, confirm: twoChars }).success,
    false,
  );
});

test("surrounding whitespace is rejected rather than silently trimmed", () => {
  // Memangkas diam-diam berarti kata sandi yang disimpan berbeda dari yang
  // diketik, dan pemiliknya tidak dapat masuk lagi dengan ketikan yang sama.
  for (const password of [" Pelatihan#2026", "Pelatihan#2026 "])
    assert.equal(
      passwordSchema.safeParse({ password, confirm: password }).success,
      false,
    );
});

test("the reset form validates the email shape", () => {
  assert.equal(
    forgotPasswordSchema.safeParse({ email: "peserta@globalindo.local" })
      .success,
    true,
  );
  assert.equal(
    forgotPasswordSchema.safeParse({ email: "peserta" }).success,
    false,
  );
  assert.equal(forgotPasswordSchema.safeParse({}).success, false);
});
