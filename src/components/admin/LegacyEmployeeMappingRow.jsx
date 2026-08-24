'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import EmployeeAutocomplete from '@/components/ui/employee-autocomplete'
import { Button } from '@/components/ui/button'
import { mapLegacyEmployeeAssignmentAction } from '@/app/actions/payroll-mapping'

export default function LegacyEmployeeMappingRow({ assignment }) {
  const router = useRouter()
  const [employee, setEmployee] = useState(null)
  const [isPending, startTransition] = useTransition()

  function applyMapping() {
    if (!employee?.payroll_employee_id) return
    startTransition(async () => {
      const result = await mapLegacyEmployeeAssignmentAction({
        source: assignment.source,
        detailId: assignment.detail_id,
        payrollEmployeeId: employee.payroll_employee_id
      })
      if (!result.success) {
        toast.error(result.error || 'Unable to map the employee')
        return
      }
      toast.success(`Mapped ${assignment.snapshot_name} to ${result.data.payroll_employee_name}`)
      router.refresh()
    })
  }

  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="px-3 py-3">
        <div className="font-semibold text-slate-900">{assignment.snapshot_name}</div>
        <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          Unresolved legacy snapshot
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-slate-700">
        <div className="font-medium">{assignment.module}</div>
        <div className="text-xs text-slate-500">Machine {assignment.machine_no}</div>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-700">
        <div>{assignment.entry_date || '-'}</div>
        <div className="text-xs text-slate-500">Shift {assignment.shift || '-'}</div>
      </td>
      <td className="min-w-80 px-3 py-3">
        <EmployeeAutocomplete
          value={employee?.emp_name || ''}
          employeeId={employee?.payroll_employee_id || null}
          onChange={(_value, selectedEmployee) => setEmployee(selectedEmployee)}
          placeholder="Search payroll employee"
          disabled={isPending}
        />
      </td>
      <td className="px-3 py-3 text-right">
        <Button type="button" size="sm" onClick={applyMapping} disabled={!employee?.payroll_employee_id || isPending}>
          {isPending ? 'Mapping…' : 'Map this row'}
        </Button>
      </td>
    </tr>
  )
}
