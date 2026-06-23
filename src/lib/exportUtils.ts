import * as XLSX from 'xlsx'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export function exportToExcel(data: any[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Datos")
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

export async function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId)
  if (!element) return

  // Store original styles that might affect rendering
  const originalMaxHeight = element.style.maxHeight
  const originalOverflow = element.style.overflow

  // Temporarily adjust for capturing full content
  element.style.maxHeight = 'none'
  element.style.overflow = 'visible'

  try {
    const canvas = await html2canvas(element, {
      scale: 2, // Higher resolution
      useCORS: true,
      backgroundColor: '#ffffff'
    })

    const imgData = canvas.toDataURL('image/png')
    // Some versions of jsPDF export differently
    const PDFDocument = jsPDF || (window as any).jspdf?.jsPDF
    if (!PDFDocument) {
      throw new Error("La librería de PDF no se pudo cargar correctamente.")
    }

    const pdf = new PDFDocument('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`${filename}.pdf`)
  } finally {
    // Restore original styles
    element.style.maxHeight = originalMaxHeight
    element.style.overflow = originalOverflow
  }
}
