"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { createUser } from "../actions";
import type { ActionResult } from "@/lib/actions";

const initialState: ActionResult = { ok: false, message: "" };

export function NewUserForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createUser, initialState);

  useEffect(() => {
    if (state.ok) router.push("/users");
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-4">
      {state.message && !state.ok && (
        <Alert tone="danger">{state.message}</Alert>
      )}

      <Field label="Full name *">
        <Input
          name="name"
          required
          maxLength={100}
          placeholder="e.g. Ali Raza"
          autoComplete="name"
        />
      </Field>

      <Field label="Email *">
        <Input
          name="email"
          type="email"
          required
          maxLength={200}
          placeholder="user@example.com"
          autoComplete="email"
        />
      </Field>

      <Field label="Password *" hint="Minimum 8 characters.">
        <Input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="••••••••"
        />
      </Field>

      <Field
        label="Role"
        hint="Owners can manage users, settings and everything else. Staff cannot."
      >
        <Select name="role" defaultValue="STAFF">
          <option value="STAFF">STAFF — shop operations</option>
          <option value="OWNER">OWNER — full access</option>
        </Select>
      </Field>

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
      </div>
    </form>
  );
}
