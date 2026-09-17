"use client";

import { useActionState } from "react";

import { loginAction } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="nama@perusahaan.com"
          autoComplete="username"
          required
        />
      </Field>
      <Field label="Kata sandi" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      {state.error ? <FormError>{state.error}</FormError> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Memproses…" : "Masuk"}
      </Button>
      <p className="text-xs leading-relaxed text-ink-500">
        Belum memiliki akses? Hubungi administrator pelatihan di perusahaan
        Anda.
      </p>
    </form>
  );
}
