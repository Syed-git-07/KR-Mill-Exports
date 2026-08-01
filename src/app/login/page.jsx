import Image from "next/image";
import LoginForm from "@/components/auth/LoginForm";
import { safeReturnPath } from "@/lib/security/request";

export const metadata = {
  title: "Sign in | KR Exports Production",
  description: "Sign in to the KR Exports Production Management System.",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const returnTo = safeReturnPath(params?.returnTo);

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_minmax(440px,520px)]">
      <section className="relative hidden overflow-hidden bg-[#0b2d47] text-white lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-20">
        <div className="absolute inset-0 opacity-[0.055] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute -bottom-48 -right-32 size-[34rem] rounded-full border-[80px] border-white/[0.035]" />
        <div className="absolute bottom-0 left-0 h-1 w-32 bg-[#d52b2b]" />

        <div className="relative flex items-center gap-4">
          <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
            <Image
              src="/icon.png"
              alt="KR Exports"
              width={92}
              height={43}
              className="h-auto w-[92px]"
              priority
            />
          </div>
          <div className="h-9 w-px bg-white/25" />
          <p className="text-sm font-medium tracking-wide text-slate-200">
            KR Exports
          </p>
        </div>

        <div className="relative max-w-2xl pb-10">
          <div className="mb-7 h-1 w-14 bg-[#e03a3a]" />
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.025em] xl:text-5xl">
            Production Management System
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">
            Daily production, machine configuration and operational reporting
            for KR Exports.
          </p>
        </div>

        <p className="relative text-xs text-slate-400">
          KR Exports Private Limited
        </p>
      </section>

      <section className="flex min-h-screen flex-col bg-[#f8fafc]">
        <div className="flex items-center px-6 py-6 sm:px-10 lg:hidden">
          <div className="rounded-md bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-200">
            <Image
              src="/icon.png"
              alt="KR Exports"
              width={78}
              height={36}
              className="h-auto w-[78px]"
              priority
            />
          </div>
          <div className="ml-3">
            <p className="text-sm font-semibold text-[#0b2d47]">KR Exports</p>
            <p className="text-xs text-slate-500">Production Management</p>
          </div>
        </div>

        <div className="flex flex-1 items-center px-6 py-10 sm:px-12 lg:px-16">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-9 hidden lg:block">
              <Image
                src="/icon.png"
                alt="KR Exports"
                width={96}
                height={45}
                className="h-auto w-24"
              />
            </div>

            <div className="mb-8">
              <h2 className="text-[2rem] font-semibold tracking-[-0.025em] text-[#102a43]">
                Sign in
              </h2>
              <p className="mt-2 text-[15px] leading-6 text-slate-500">
                Enter your account details to continue.
              </p>
            </div>

            <LoginForm returnTo={returnTo} />
          </div>
        </div>

        <footer className="px-6 py-6 text-center text-xs text-slate-400 sm:px-12">
          © {new Date().getFullYear()} KR Exports Private Limited
        </footer>
      </section>
    </main>
  );
}
