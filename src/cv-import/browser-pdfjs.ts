// The pdf.js browser build with its worker bundled into the extension, so
// the worker loads from the extension's own origin and never from a CDN.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { readPdfText } from './read-pdf'
import type { PdfText } from '../core/cv/types'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export function readCvPdf(bytes: Uint8Array): Promise<PdfText> {
  return readPdfText(pdfjs, bytes)
}
