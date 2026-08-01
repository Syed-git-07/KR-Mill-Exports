"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SignInButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-lg bg-[#0b2d47] text-[15px] font-semibold text-white shadow-sm transition hover:bg-[#123d5d] focus-visible:ring-[#0b2d47]/30"
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" />
          Signing in…
        </>
      ) : (
        <>
          Sign in
          <ArrowRight className="ml-auto" />
        </>
      )}
    </Button>
  );
}

export default function LoginForm({ returnTo = "/" }) {
  const [state, formAction] = useActionState(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="returnTo" value={returnTo} />

      {state?.error && (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="username" className="text-[13px] font-semibold text-slate-700">
          Username
        </Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state?.username || ""}
          required
          minLength={3}
          maxLength={64}
          placeholder="Enter your username"
          className="h-12 rounded-lg border-slate-300 bg-white px-3.5 text-[15px] shadow-none placeholder:text-slate-400 focus-visible:border-[#0b2d47] focus-visible:ring-[#0b2d47]/15"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-[13px] font-semibold text-slate-700">
          Password
        </Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={128}
            placeholder="Enter your password"
            className="h-12 rounded-lg border-slate-300 bg-white px-3.5 pr-11 text-[15px] shadow-none placeholder:text-slate-400 focus-visible:border-[#0b2d47] focus-visible:ring-[#0b2d47]/15"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0b2d47]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <SignInButton />
    </form>
  );
}
