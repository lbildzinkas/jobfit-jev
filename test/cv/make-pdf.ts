// Builds small text PDFs for the CV import tests, so no real CV is ever
// committed. Text uses the standard Helvetica fonts (not embedded); each item
// is placed at an absolute position, in the order given, which lets a test
// write a page out of reading order on purpose.

export interface PdfTextItem {
  text: string
  x: number
  /** Baseline, measured from the bottom of the page as PDF does. */
  y: number
  size?: number
  bold?: boolean
}

export interface PdfPageSpec {
  items: PdfTextItem[]
  /** Draw a filled rectangle as an embedded image, like a photo or a scan. */
  image?: { x: number; y: number; width: number; height: number }
}

export function makePdf(pages: PdfPageSpec[]): Uint8Array {
  const objects: string[] = []
  const add = (body: string) => objects.push(body)

  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('') // pages tree, filled in once the page ids are known
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')

  const pageIds: number[] = []
  for (const page of pages) {
    const imageRef = page.image === undefined ? '' : addImage(add, objects)
    const content = contentStream(page)
    add(
      `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
    )
    const contentId = objects.length
    const xObject = imageRef === '' ? '' : ` /XObject << /Im0 ${imageRef} >>`
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${String(contentId)} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xObject} >> >>`,
    )
    pageIds.push(objects.length)
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${String(id)} 0 R`).join(' ')}] /Count ${String(pages.length)} >>`

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, index) => {
    offsets.push(pdf.length)
    pdf += `${String(index + 1)} 0 obj\n${body}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${String(objects.length + 1)}\n0000000000 65535 f \n`
  for (const offset of offsets)
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${String(objects.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`

  return new TextEncoder().encode(pdf)
}

function contentStream(page: PdfPageSpec): string {
  const text = page.items.map(
    (item) =>
      `BT /${item.bold === true ? 'F2' : 'F1'} ${String(item.size ?? 10)} Tf ${String(item.x)} ${String(item.y)} Td (${escapePdfText(item.text)}) Tj ET`,
  )
  const image =
    page.image === undefined
      ? []
      : [
          `q ${String(page.image.width)} 0 0 ${String(page.image.height)} ${String(page.image.x)} ${String(page.image.y)} cm /Im0 Do Q`,
        ]
  return [...image, ...text].join('\n')
}

// A 2 x 2 grey image: enough for pdf.js to report an image draw.
function addImage(add: (body: string) => void, objects: string[]): string {
  const pixels = '80808080'
  add(
    `<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length ${String(pixels.length + 1)} >>\nstream\n${pixels}>\nendstream`,
  )
  return `${String(objects.length)} 0 R`
}

function escapePdfText(text: string): string {
  return text.replace(/[\\()]/g, (char) => `\\${char}`)
}
