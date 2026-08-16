export default function MachineActiveStatus({ isActive }) {
  return (
    <div
      role="status"
      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
        isActive
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      Machine status: {isActive ? 'Available for new entries' : 'Permanently removed (historical record)'}
    </div>
  )
}
