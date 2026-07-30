import { KeyRound, ShieldCheck } from "lucide-react";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/security/auth";

export const metadata = {
  title: "Change password | KR Exports Production",
};

export default async function AccountSecurityPage() {
  const user = await requireUser();

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 sm:py-12">
      {user.must_change_password && (
        <div className="mb-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          You must replace the temporary password before opening the production
          system.
        </div>
      )}

      <Card className="overflow-hidden border-slate-200 shadow-lg">
        <CardHeader className="border-b bg-slate-50">
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <KeyRound />
          </div>
          <CardTitle className="text-2xl">Change password</CardTitle>
          <CardDescription>
            Signed in as {user.display_name} ({user.username})
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-1">
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
