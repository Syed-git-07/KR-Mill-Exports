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
  onSelectAll,
  getRowClassName
}) {
  const allSelected = showCheckbox && data?.length > 0 && selectedRows?.length === data.length;
  
  return (
    <div className="border-2 border-gray-400 rounded-lg overflow-hidden bg-white shadow-sm">
      <Table className="border-collapse">
        <TableHeader>
          <TableRow className="bg-blue-600 hover:bg-blue-600">
            {showCheckbox && (
              <TableHead className="text-white font-semibold border border-gray-300 px-2 py-2" style={{ width: '50px' }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll && onSelectAll(e.target.checked)}
                  className="cursor-pointer"
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead key={column.key} className="text-white font-semibold border border-gray-300 px-2 py-2" style={{ width: column.width }}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="bg-white">
          {data && data.length > 0 ? (
            data.map((row, index) => {
              const isSelected = selectedRows?.some(r => r.id === row.id);
              const isRowSelected = isSelected || selectedRow?.id === row.id || selectedRowId === row.id;
              const rowExtraCls = getRowClassName ? getRowClassName(row) : '!bg-white hover:!bg-yellow-100'
              const cellExtraCls = rowExtraCls.split(' ').filter(c => !c.startsWith('hover:')).join(' ')
              return (
                <TableRow
                  key={row.code || row.id || index}
                  onClick={() => onRowClick && onRowClick(row)}
                  onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
                  onContextMenu={(e) => onContextMenu && onContextMenu(row, e)}
                  className={`cursor-pointer text-xs ${
                    isRowSelected
                      ? '!bg-yellow-200 font-medium' 
                      : rowExtraCls
                  }`}
                >
                  {showCheckbox && (
                    <TableCell 
                      className={`py-2 px-2 border border-gray-300 ${isRowSelected ? '!bg-yellow-200' : cellExtraCls}`} 
                      style={{ width: '50px' }}
                    >
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
                    <TableCell 
                      key={col.key} 
                      className={`py-2 px-2 border border-gray-300 ${isRowSelected ? '!bg-yellow-200' : cellExtraCls}`} 
                      style={{ width: col.width }}
                    >
                      {row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length + (showCheckbox ? 1 : 0)} className="text-center py-8 text-muted-foreground border border-gray-300">
                No data available
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
