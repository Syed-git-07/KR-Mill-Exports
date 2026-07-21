"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { Toaster as Sonner, toast } from "sonner"

let globalRouter = null

if (typeof window !== "undefined") {
  const originalSuccess = toast.success
  toast.success = (message, options) => {
    let isSaveOrUpdate = false
    try {
      const msgStr = String(message || "").toLowerCase()
      isSaveOrUpdate =
        (msgStr.includes("saved") ||
          msgStr.includes("updated") ||
          msgStr.includes("created")) &&
        !msgStr.includes("initialized") &&
        !msgStr.includes("deleted") &&
        !msgStr.includes("removed")
    } catch (err) {
      console.error("Error parsing toast message:", err)
    }

    const result = originalSuccess(message, options)

    if (isSaveOrUpdate) {
      let attempts = 0
      const checkAndRedirect = () => {
        attempts += 1
        const activeFetches =
          typeof window !== "undefined" && typeof window.__activeFetchCount === "function"
            ? window.__activeFetchCount()
            : 0

        // If fetches are still pending and max retries (15 attempts = 3 sec) not reached, wait
        if (activeFetches > 0 && attempts < 15) {
          setTimeout(checkAndRedirect, 200)
        } else {
          try {
            window.location.href = "/"
          } catch (routeErr) {
            console.error("Redirection error:", routeErr)
          }
        }
      }

      // Wait 1.2s for user to read the toast, then wait for active fetches to complete before redirecting
      setTimeout(checkAndRedirect, 1200)
    }

    return result
  }
}

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()
  const router = useRouter()
  globalRouter = router

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)"
        }
      }
      {...props} />
  );
}

export { Toaster }
