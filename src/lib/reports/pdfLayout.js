import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const COLORS = {
  ink: [24, 32, 42],
  muted: [91, 101, 115],
  line: [154, 163, 175],
  header: [235, 237, 240],
  total: [246, 238, 238],
  accent: [145, 32, 38]
}

function drawPageHeader(doc, report) {
  const width = doc.internal.pageSize.getWidth()
  doc.setTextColor(...COLORS.ink)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('KAYAAR EXPORTS PRIVATE LIMITED', width / 2, 10, { align: 'center' })
  doc.setFontSize(9)
  doc.text(report.title.toUpperCase(), width / 2, 15, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text(report.period || '', width / 2, 19.5, { align: 'center' })
  doc.setDrawColor(...COLORS.accent)
  doc.setLineWidth(0.45)
  doc.line(10, 22, width - 10, 22)
}

function drawPageFooter(doc, page, totalPages, signatures, finalPage) {
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  doc.setTextColor(...COLORS.muted)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text(`Page ${page} of ${totalPages}`, width - 10, height - 6, { align: 'right' })
  if (finalPage && signatures?.length) {
    const gap = (width - 28) / Math.max(signatures.length - 1, 1)
    doc.setTextColor(...COLORS.ink)
    doc.setFont('helvetica', 'bold')
    signatures.forEach((signature, index) => doc.text(signature, 14 + gap * index, height - 10, { align: index === 0 ? 'left' : index === signatures.length - 1 ? 'right' : 'center' }))
  }
}

export function createFinalReportPdf(report) {
  const doc = new jsPDF({ orientation: report.orientation || 'portrait', unit: 'mm', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  let y = 27
  drawPageHeader(doc, report)

  if (report.meta?.length) {
    const metaText = report.meta.map(([label, value]) => `${label}: ${value}`).join('    |    ')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...COLORS.ink)
    doc.text(metaText, 10, y)
    y += 5
  }

  for (const table of report.tables || []) {
    const estimatedHeight = 12 + Math.min((table.rows?.length || 0) * 5, 45)
    if (y + estimatedHeight > doc.internal.pageSize.getHeight() - 18) {
      doc.addPage()
      drawPageHeader(doc, report)
      y = 27
    }
    if (table.title) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...COLORS.ink)
      doc.text(table.title, 10, y)
      y += 3
    }
    const body = [...(table.rows || [])]
    if (table.footer) body.push(table.footer)
    autoTable(doc, {
      startY: y,
      head: [table.columns || []],
      body,
      theme: 'grid',
      margin: { top: 25, left: 10, right: 10, bottom: 17 },
      styles: { font: 'helvetica', fontSize: report.orientation === 'landscape' ? 6.7 : 7.2, cellPadding: 1.25, lineColor: COLORS.line, lineWidth: 0.12, textColor: COLORS.ink, valign: 'middle' },
      headStyles: { fillColor: COLORS.header, textColor: COLORS.ink, fontStyle: 'bold', halign: 'center', lineColor: COLORS.line },
      alternateRowStyles: { fillColor: [251, 251, 251] },
      didParseCell(data) {
        if (table.footer && data.section === 'body' && data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = COLORS.total
        }
        if (data.section === 'body' && data.column.index > 0 && typeof data.cell.raw !== 'string') data.cell.styles.halign = 'right'
      },
      didDrawPage: () => drawPageHeader(doc, report)
    })
    y = (doc.lastAutoTable?.finalY || y) + 6
  }

  if (report.notes?.length) {
    if (y + 12 > doc.internal.pageSize.getHeight() - 18) {
      doc.addPage()
      drawPageHeader(doc, report)
      y = 27
    }
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.muted)
    const noteLines = doc.splitTextToSize(report.notes.map(note => `Note: ${note}`).join('\n'), width - 20)
    doc.text(noteLines, 10, y)
  }

  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    drawPageFooter(doc, page, totalPages, report.signatures, page === totalPages)
  }
  return doc
}
