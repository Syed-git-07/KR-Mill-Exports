"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, FileClock, Home, KeyRound, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export default function AppHeader({ user }) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  return (
    <header
      data-app-auth-header
      className="sticky top-0 z-50 h-12 border-t-[3px] border-t-[#0b2d47] border-b border-slate-200 bg-white text-slate-700 shadow-xs print:hidden"
    >
      <div className="mx-auto flex h-full items-center justify-between gap-2 px-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="h-8 px-2 text-slate-600 hover:bg-slate-100 hover:text-[#0b2d47]"
          >
            <ArrowLeft />
            <span className="hidden sm:inline">Back</span>
          </Button>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-slate-600 hover:bg-slate-100 hover:text-[#0b2d47]"
          >
            <Link href="/">
              <Home />
              <span className="hidden sm:inline">Home</span>
            </Link>
          </Button>

          <div
            className="mx-1 hidden h-5 w-px bg-slate-200 sm:block"
            aria-hidden="true"
          />

          <Link
            href="/"
            className="hidden min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2d47]/30 sm:flex"
            aria-label="KR Production home"
          >
            <Image
              src="/icon.png"
              alt="KR Exports"
              width={45}
              height={21}
              className="h-auto w-[45px]"
              priority
            />
            <span className="hidden truncate text-xs font-semibold text-[#0b2d47] md:inline">
              Production Management
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {user.role === "ADMIN" && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-slate-600 hover:bg-slate-100 hover:text-[#0b2d47]"
            >
              <Link href="/admin/security-logs">
                <FileClock />
                <span className="hidden lg:inline">Activity</span>
              </Link>
            </Button>
          )}

          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="text-slate-600 hover:bg-slate-100 hover:text-[#0b2d47]"
          >
            <Link href="/account/security" aria-label="Change password">
              <KeyRound />
            </Link>
          </Button>

          <div
            className="ml-1 hidden max-w-36 border-l border-slate-200 pl-3 leading-tight md:block"
            title={`${user.display_name} (${user.username})`}
          >
            <p className="truncate text-xs font-semibold text-slate-700">
              {user.display_name}
            </p>
            <p className="text-[9px] uppercase tracking-wider text-slate-400">
              {user.role}
            </p>
          </div>

          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              className="text-slate-500 hover:bg-red-50 hover:text-red-700"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
