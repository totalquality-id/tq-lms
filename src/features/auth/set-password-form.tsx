"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setPasswordAction } from "@/app/account-actions";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD } from "@/schemas/account";

export function SetPasswordForm({
  token,
  invite,
}: {
  token: string;
  invite: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    setPasswordAction.bind(null, token),
    {},
  );

  useEffect(() => {
    if (!state.success) return;
    toast.success(state.success);
    if (state.redirectTo) router.replace(state.redirectTo);
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Kata sandi baru"
        htmlFor="password"
        required
        hint={`Minimal ${MIN_PASSWORD} karakter.`}
        error={state.fields?.password?.[0]}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          required
          aria-invalid={Boolean(state.fields?.password)}
        />
      </Field>
      <Field
        label="Ulangi kata sandi"
        htmlFor="confirm"
        required
        error={state.fields?.confirm?.[0]}
      >
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fields?.confirm)}
        />
      </Field>
      {state.error ? <FormError>{state.error}</FormError> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending
          ? "Menyimpan…"
          : invite
            ? "Aktifkan akun"
            : "Simpan kata sandi baru"}
      </Button>
    </form>
  );
}
