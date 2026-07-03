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
      backgroundColor: '#ffffff',
      filter: (node) => {
        if (node instanceof HTMLElement && node.dataset.html2canvasIgnore === "true") {
          return false;
        }
        return true;
      }
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

export async function exportNativePDF(tx: any, details: any, filename: string) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxLineWidth = pageWidth - margin * 2;
  let cursorY = margin;

  let logoData: string | null = null;
  let logoWidth = 0;
  let logoHeight = 0;

  try {
    const img = new Image();
    img.src = '/logo.png';
    await new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          logoData = canvas.toDataURL('image/png');
          logoWidth = img.width;
          logoHeight = img.height;
        }
        resolve(null);
      };
      img.onerror = reject;
    });
  } catch (e) {
    console.warn('Could not load logo for PDF watermark', e);
  }

  const addText = (text: string, fontSize: number, isBold: boolean = false, color: [number, number, number] = [0, 0, 0], addLineSpace = true) => {
    if (!text) return;
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxLineWidth);
    
    // Line height approx calculation
    const lineHeight = fontSize * 0.3527; 
    
    // Check pagination
    if (cursorY + (lines.length * lineHeight) > 280) {
      doc.addPage();
      cursorY = margin;
    }
    
    doc.text(lines, margin, cursorY);
    cursorY += lines.length * lineHeight + (addLineSpace ? 4 : 2);
  };

  const addLineBreak = (space = 8) => {
    cursorY += space;
  };

  // 1. Title
  addText(tx.title || "Detalle de Transacción", 16, true, [235, 49, 89]);
  
  // 2. Date
  addText(`Fecha de Operación: ${tx.date || ''}`, 10, false, [102, 102, 102]);
  addLineBreak(4);

  // 3. Excerpt (convert HTML to text cleanly)
  if (details && details.excerpt) {
    const plainText = details.excerpt.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (plainText) {
      addText("Resumen (Excerpt)", 12, true, [0, 0, 0]);
      addText(plainText, 10, false, [51, 51, 51]);
      addLineBreak(4);
    }
  }

  // 4. Amount and Status
  addText(`Operaciones - ${tx.status || ''}`, 12, true, [0, 0, 0]);
  addText(`Monto: ${tx.amount !== 'Por definir' ? `USD ${tx.amount}` : 'Por definir'}`, 10, true, [16, 185, 129]);
  addLineBreak(4);

  // 5. Firms Involved
  if (details && (details.companies?.length > 0 || details.advisors?.length > 0)) {
    addText("Firmas Involucradas", 12, true, [0, 0, 0]);
    if (details.companies) {
      details.companies.forEach((c: any) => {
        addText(`• ${c.company?.name || ''} (${c.role || ''})`, 10, false, [51, 51, 51], false);
        cursorY += 2;
      });
    }
    if (details.advisors) {
      details.advisors.forEach((a: any) => {
        addText(`• ${a.firm?.name || ''} (${a.role || ''})`, 10, false, [51, 51, 51], false);
        cursorY += 2;
      });
    }
    addLineBreak(4);
  }

  // 6. Lawyers
  if (details && details.lawyers?.length > 0) {
    addText("Abogados Involucrados", 12, true, [0, 0, 0]);
    details.lawyers.forEach((l: any) => {
      addText(`• ${l.lawyer?.name || ''} - ${l.lawyer?.firm?.name || ''}`, 10, false, [51, 51, 51], false);
      cursorY += 2;
    });
    addLineBreak(4);
  }

  // 7. Industry
  if (tx.industry) {
    addText("Industrias", 12, true, [0, 0, 0]);
    addText(`• ${tx.industry}`, 10, false, [51, 51, 51]);
    addLineBreak(4);
  }

  // 8. Practice Areas
  if (tx.type) {
    addText("Áreas de Práctica", 12, true, [0, 0, 0]);
    addText(`• ${tx.type}`, 10, false, [51, 51, 51]);
    addLineBreak(4);
  }

  // 9. Countries
  if (tx.country) {
    addText("Países", 12, true, [0, 0, 0]);
    const countries = tx.country.split(',').map((c: string) => c.trim()).join(', ');
    addText(`• ${countries}`, 10, false, [51, 51, 51]);
    addLineBreak(4);
  }

  // Add decorations (watermark and footer) to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Add watermark
    if (logoData && typeof (doc as any).setGState === 'function' && typeof (doc as any).GState === 'function') {
      try {
        const gState = new (doc as any).GState({ opacity: 0.1 });
        (doc as any).setGState(gState);
        
        // Calculate watermark dimensions
        // Let's set a target width for the watermark (e.g. 140mm)
        const targetW = 140;
        const targetH = (logoHeight * targetW) / logoWidth;
        const xPos = (pageWidth - targetW) / 2;
        const yPos = (pageHeight - targetH) / 2;
        
        doc.addImage(logoData, 'PNG', xPos, yPos, targetW, targetH);
        
        // Restore opacity
        const restoreGState = new (doc as any).GState({ opacity: 1 });
        (doc as any).setGState(restoreGState);
      } catch (e) {
        console.warn('Failed to add watermark', e);
      }
    }

    // Add footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Ágora - todos los derechos reservados", pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  doc.save(`${filename}.pdf`);
}
