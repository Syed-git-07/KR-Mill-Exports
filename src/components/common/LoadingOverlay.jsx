import { LoaderCircle } from 'lucide-react'

export default function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/30 backdrop-blur-[3px]" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-panel flex w-48 flex-col items-center rounded-2xl border border-white/70 bg-white/95 px-8 py-7 shadow-2xl">
        <div className="relative mb-4 grid h-14 w-14 place-items-center rounded-full bg-blue-50">
          <span className="absolute inset-0 animate-ping rounded-full bg-blue-300/30" />
          <LoaderCircle className="h-8 w-8 animate-spin text-blue-600" strokeWidth={2.4} />
        </div>
        <p className="text-sm font-semibold tracking-wide text-slate-800">Loading...</p>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="route-loading-bar h-full w-2/5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
        </div>
      </div>
    </div>
  )
}
