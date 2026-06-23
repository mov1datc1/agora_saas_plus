import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'

export function exportToExcel(data: any[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Datos")
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

export async function exportToPDF(elementId: string, filename: string) {
  const originalElement = document.getElementById(elementId)
  if (!originalElement) return

  // 1. Create an invisible container at the bottom of the body
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = `${originalElement.scrollWidth}px`
  container.style.backgroundColor = '#ffffff'
  document.body.appendChild(container)

  // 2. Clone the node deeply
  const clone = originalElement.cloneNode(true) as HTMLElement
  
  // 3. Force the clone to show all contents without scroll
  clone.style.maxHeight = 'none'
  clone.style.height = 'auto'
  clone.style.overflow = 'visible'
  clone.style.transform = 'none'
  
  container.appendChild(clone)

  try {
    // 4. Capture the clone using html-to-image (supports modern CSS like oklab)
    const { toPng } = await import('html-to-image')
    const imgData = await toPng(clone, {
      pixelRatio: 2,
      backgroundColor: '#ffffff'
    })
    
    // Some versions of jsPDF export differently
    const PDFDocument = jsPDF || (window as any).jspdf?.jsPDF
    if (!PDFDocument) {
      throw new Error("La librería de PDF no se pudo cargar correctamente.")
    }

    const pdf = new PDFDocument('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    
    // Obtenemos dimensiones de la imagen
    const img = new Image()
    img.src = imgData
    await new Promise((resolve) => { img.onload = resolve })

    const pdfHeight = (img.height * pdfWidth) / img.width

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`${filename}.pdf`)
  } finally {
    // 5. Cleanup the invisible container
    document.body.removeChild(container)
  }
}
