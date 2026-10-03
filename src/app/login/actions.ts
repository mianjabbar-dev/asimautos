"use server";

import { redirect } from "next/navigation";
import { loginSchema } from "@/lib/validators";
import { loginWithPassword, AuthError } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/login?error=" + encodeURIComponent("Enter a valid email and password."));
  }
  try {
    await loginWithPassword(parsed.data.email, parsed.data.password);
  } catch (e) {
    const message = e instanceof AuthError ? e.message : "Login failed. Try again.";
    redirect("/login?error=" + encodeURIComponent(message));
  }
  const next = (formData.get("next") as string) || "/";
  redirect(next.startsWith("/") ? next : "/");
}
