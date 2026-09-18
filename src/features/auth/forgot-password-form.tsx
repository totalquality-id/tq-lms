"use client";

import { useActionState } from "react";

import { forgotPasswordAction } from "@/app/account-actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Note } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});

  // Setelah permintaan tercatat, formulirnya diganti pesan — membiarkannya
  // terbuka hanya mengundang orang menekan kirim berulang kali.
  if (state.success) return <Note>{state.success}</Note>;

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Email terdaftar"
        htmlFor="email"
        required
        error={state.fields?.email?.[0]}
      >
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="nama@perusahaan.com"
          autoComplete="username"
          required
          aria-invalid={Boolean(state.fields?.email)}
        />
      </Field>
      {state.error ? <FormError>{state.error}</FormError> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Mengirim…" : "Ajukan penyetelan ulang"}
      </Button>
    </form>
  );
}
