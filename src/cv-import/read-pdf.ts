// Reads the positioned text of a PDF CV with pdf.js, fully on this machine
// (docs/spec.md §4.3 step 1). The caller passes the pdf.js module, so the
// extension page uses the browser build with its bundled worker and the
// tests use the Node.js build on generated PDFs.
//
// No network: the document comes in as bytes, and every pdf.js option that
// names a URL (cMapUrl, standardFontDataUrl, wasmUrl, iccUrl) stays unset,
// so pdf.js has nothing to fetch. Fonts are not rendered, so no FontFace
// loads and no eval is needed.

import type { PdfText, TextRun } from '../core/cv/types'

export interface PdfJs {
  getDocument(params: PdfParams): {
    promise: Promise<PdfDocument>
    destroy(): Promise<void>
  }
  OPS: Record<string, number>
}

interface PdfParams {
  data: Uint8Array
  isEvalSupported: boolean
  disableFontFace: boolean
  useWorkerFetch: boolean
  enableXfa: boolean
  verbosity: number
}

interface PdfDocument {
  numPages: number
  getPage(pageNumber: number): Promise<PdfPage>
}

interface PdfPage {
  getTextContent(): Promise<{ items: object[] }>
  getOperatorList(): Promise<{ fnArray: number[] }>
}

interface PdfTextItem {
  str: string
  width: number
  transform: number[]
}

export const maxPdfBytes = 5 * 1024 * 1024
const maxPages = 20

export async function readPdfText(
  pdfjs: PdfJs,
  bytes: Uint8Array,
): Promise<PdfText> {
  // pdf.js may transfer the buffer to its worker; keep the caller's copy.
  const data = bytes.slice()
  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableFontFace: true,
    useWorkerFetch: false,
    enableXfa: false,
    verbosity: 0,
  })

  try {
    const document = await loadingTask.promise
    const pages = []
    let hasImageOnFirstPage = false
    for (
      let number = 1;
      number <= Math.min(document.numPages, maxPages);
      number++
    ) {
      const page = await document.getPage(number)
      const content = await page.getTextContent()
      pages.push({ runs: content.items.filter(isTextItem).map(toRun) })
      if (number === 1) hasImageOnFirstPage = await drawsImage(pdfjs, page)
    }
    return { pages, hasImageOnFirstPage }
  } finally {
    await loadingTask.destroy()
  }
}

async function drawsImage(pdfjs: PdfJs, page: PdfPage): Promise<boolean> {
  const imageOps = new Set(
    ['paintImageXObject', 'paintInlineImageXObject', 'paintImageXObjectRepeat']
      .map((name) => pdfjs.OPS[name])
      .filter((op) => op !== undefined),
  )
  const { fnArray } = await page.getOperatorList()
  return fnArray.some((op) => imageOps.has(op))
}

function isTextItem(item: object): item is PdfTextItem {
  return 'str' in item && 'transform' in item
}

function toRun(item: PdfTextItem): TextRun {
  const [a = 0, b = 0, c = 0, d = 0, x = 0, y = 0] = item.transform
  return {
    text: item.str,
    x,
    y,
    width: item.width,
    fontSize:
      Math.round(Math.max(Math.hypot(a, b), Math.hypot(c, d)) * 100) / 100,
  }
}
