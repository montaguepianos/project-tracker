type Orientation = 'portrait' | 'landscape'

type ExportOptions = {
  filename: string
  orientation?: Orientation
  scale?: number
}

export async function exportElementToPdf(element: HTMLElement, options: ExportOptions) {
  const { filename, orientation = 'portrait', scale = 2 } = options
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
  })

  const imageData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const imgWidth = pageWidth
  const imgHeight = (canvas.height * pageWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imageData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imageData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }

  pdf.save(filename)
}
