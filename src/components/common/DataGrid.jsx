'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function DataGrid({ 
  columns, 
  data, 
  onRowClick, 
  selectedRow, 
  selectedRowId,
  onRowDoubleClick,
  onContextMenu, 
  showCheckbox, 
  selectedRows, 
  onSelectRow, 
  onSelectAll 
}) {
  const allSelected = showCheckbox && data?.length > 0 && selectedRows?.length === data.length;
  
  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-600 hover:to-blue-700">
            {showCheckbox && (
              <TableHead className="text-white font-semibold" style={{ width: '50px' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll && onSelectAll(e.target.checked)}
                  className="cursor-pointer"
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead key={column.key} className="text-white font-semibold" style={{ width: column.width }}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data && data.length > 0 ? (
            data.map((row, index) => {
              const isSelected = selectedRows?.some(r => r.id === row.id);
              const isRowSelected = isSelected || selectedRow?.id === row.id || selectedRowId === row.id;
              return (
                <TableRow
                  key={row.code || row.id || index}
                  onClick={() => onRowClick && onRowClick(row)}
                  onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
                  onContextMenu={(e) => onContextMenu && onContextMenu(row, e)}
                  className={`cursor-pointer text-xs ${
                    isRowSelected
                      ? 'bg-blue-100 font-medium' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {showCheckbox && (
                    <TableCell className="py-2" style={{ width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          onSelectRow && onSelectRow(row);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer"
                      />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell key={col.key} className="py-2 bg-inherit" style={{ width: col.width }}>
                      {row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                No data available
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
