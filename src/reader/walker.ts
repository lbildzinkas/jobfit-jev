// Structure-preserving block walker (docs/spec.md §5.2 step 8).
//
// It walks the description element's live child nodes and never re-parses
// serialized markup: SDUI nests `ul` inside `p > span`, which an HTML parser
// silently moves out of the description box (docs/linkedin-structure.md §7).
// The emitted `Block`s keep the original wording with normalized whitespace.

import type { Block } from './types'

const ignoredTags = new Set(['script', 'style', 'noscript', 'svg'])
const headingTags = new Set(['h1', 'h2', 'h3', 'h4'])
const strongTags = new Set(['strong', 'b'])

/** Collapse whitespace runs to single spaces and trim the ends. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function walkBlocks(root: Element): Block[] {
  const blocks: Block[] = []
  // Text accumulated for the paragraph (or bullet) being built. `allStrong`
  // records whether every character so far came from inside a `strong`/`b`:
  // that is one of the two things that make a paragraph a heading.
  let buffer = ''
  let allStrong = true

  const flush = (kind: 'paragraph' | 'bullet', depth: number): void => {
    const text = normalizeText(buffer)
    const strongOnly = allStrong
    buffer = ''
    allStrong = true
    if (text === '') return
    if (kind === 'bullet') {
      blocks.push({ kind: 'bullet', text, depth })
      return
    }
    // A paragraph that is a single strong/b, or that ends with a colon, is a
    // section heading such as "Minimum qualifications:".
    if (strongOnly || text.endsWith(':')) {
      blocks.push({ kind: 'heading', text })
    } else {
      blocks.push({ kind: 'paragraph', text })
    }
  }

  const append = (text: string | null, strongDepth: number): void => {
    if (!text) return
    const collapsed = text.replace(/\s+/g, ' ')
    if (collapsed.trim() === '') {
      // Whitespace only matters as a word boundary between two elements.
      if (buffer !== '') buffer += collapsed
      return
    }
    buffer += collapsed
    if (strongDepth === 0) allStrong = false
  }

  // `listDepth` is the nesting depth of the enclosing list, 0 outside any
  // list; a `li` directly in a top-level list is a bullet of depth 1.
  const walkNodes = (
    element: Element,
    strongDepth: number,
    kind: 'paragraph' | 'bullet',
    listDepth: number,
  ): void => {
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === 3) {
        append(child.textContent, strongDepth)
        continue
      }
      if (child.nodeType !== 1) continue
      const node = child as Element
      const tag = node.tagName.toLowerCase()
      if (ignoredTags.has(tag)) continue
      if (tag === 'br') {
        flush(kind, listDepth)
      } else if (headingTags.has(tag)) {
        flush(kind, listDepth)
        const text = normalizeText(node.textContent)
        if (text !== '') blocks.push({ kind: 'heading', text })
      } else if (tag === 'ul' || tag === 'ol') {
        flush(kind, listDepth)
        walkList(node, listDepth + 1)
      } else if (tag === 'li') {
        // A list item outside any list (defensive): treat as a bullet.
        flush(kind, listDepth)
        walkNodes(node, strongDepth, 'bullet', listDepth)
        flush('bullet', listDepth)
      } else if (tag === 'p') {
        // A `p` is its own paragraph context.
        flush(kind, listDepth)
        walkNodes(node, strongDepth, 'paragraph', listDepth)
        flush('paragraph', listDepth)
      } else {
        walkNodes(
          node,
          strongDepth + (strongTags.has(tag) ? 1 : 0),
          kind,
          listDepth,
        )
      }
    }
  }

  const walkList = (list: Element, listDepth: number): void => {
    for (const child of Array.from(list.children)) {
      const kind = child.tagName.toLowerCase() === 'li' ? 'bullet' : 'paragraph'
      walkNodes(child, 0, kind, listDepth)
      flush(kind, listDepth)
    }
  }

  walkNodes(root, 0, 'paragraph', 0)
  flush('paragraph', 0)
  return blocks
}

/** Total normalized text length of the walked blocks (spec §5.5's 300-char
 *  floor is applied to this count). */
export function charCountOf(blocks: Block[]): number {
  return blocks.reduce((sum, block) => sum + block.text.length, 0)
}
