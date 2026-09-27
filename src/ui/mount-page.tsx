import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

export function mountPage(page: ReactNode) {
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('The page has no #root element to mount')

  createRoot(rootElement).render(<StrictMode>{page}</StrictMode>)
}
