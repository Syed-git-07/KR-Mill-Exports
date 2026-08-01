"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { changePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 bg-blue-700 text-white hover:bg-blue-800"
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
      {pending ? "Updating…" : "Update password"}
    </Button>
  );
}

function getPasswordStrength(password) {
  if (!password) return null;
  if (password.length < 6) {
    return { label: "Too short", level: 0, textClass: "text-red-600" };
  }

  const groups = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const score =
    1 +
    Number(password.length >= 10) +
    Number(password.length >= 14) +
    Number(groups >= 2) +
    Number(groups >= 3);

  if (score <= 1) return { label: "Weak", level: 1, textClass: "text-red-600" };
  if (score === 2) return { label: "Fair", level: 2, textClass: "text-amber-600" };
  if (score === 3) return { label: "Good", level: 3, textClass: "text-blue-600" };
  return { label: "Strong", level: 4, textClass: "text-emerald-600" };
}

export default function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, {});
  const [newPassword, setNewPassword] = useState("");
  const strength = getPasswordStrength(newPassword);

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </div>
      )}
      {state?.success && (
        <div
          role="status"
          className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {state.success}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          className="h-11"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={128}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="h-11"
          />
          {strength && (
            <div aria-live="polite" className="space-y-1.5 pt-1">
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <span
                    key={level}
                    className={`h-1 rounded-full ${
                      level <= strength.level
                        ? strength.level <= 1
                          ? "bg-red-500"
                          : strength.level === 2
                            ? "bg-amber-500"
                            : strength.level === 3
                              ? "bg-blue-500"
                              : "bg-emerald-500"
                        : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs font-medium ${strength.textClass}`}>
                Password strength: {strength.label}
              </p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={128}
            className="h-11"
          />
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        Use at least 6 characters. Avoid common passwords and your username.
      </div>

      <SaveButton />
    </form>
  );
}
