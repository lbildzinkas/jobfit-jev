// Extraction result shapes (docs/spec.md §5.1). The page reader returns one
// of these; every string is plain data, so the result crosses the
// chrome.scripting boundary unchanged.

export type FailureCode =
  | 'not_linkedin_job'
  | 'no_job_id'
  | 'unknown_layout'
  | 'stale_pane'
  | 'no_description'
  | 'description_too_short'
  | 'no_title'
  // The two codes below carry the §5.5 rules that name no code of their own:
  | 'low_confidence_fields'
  | 'company_mismatch'

export type Layout = 'sdui' | 'classic' | 'jsonld' | 'unknown'

export interface Field {
  value: string
  selector: string
  confidence: 'high' | 'medium' | 'low'
}

export interface Description {
  blocks: Block[]
  charCount: number
  selector: string
}

export interface Block {
  kind: 'heading' | 'paragraph' | 'bullet'
  text: string
  /** List nesting level of a bullet: 1 for a top-level list, 2 inside it, … */
  depth?: number
}

export interface SelectorHit {
  field: string
  selector: string
  matched: number
}

export interface JobUrl {
  jobId: string
  source: 'currentJobId' | 'path'
}

export interface ExtractionResult {
  ok: boolean
  /** Present exactly when `ok` is false; says why in one machine-readable word. */
  failure?: FailureCode
  layout: Layout
  /** `jobId` is the empty string when the URL held none; `source` is the
   *  placeholder 'path' then. */
  url: JobUrl
  /** The job id the detail pane actually shows, when read. Differs from
   *  `url.jobId` exactly in the stale state, which fails extraction. */
  paneJobId?: string
  title?: Field
  company?: Field
  location?: Field
  workplaceType?: 'Remote' | 'Hybrid' | 'On-site' | 'unknown'
  description?: Description
  /** Every selector tried, in try order, and how many elements it matched. */
  health: SelectorHit[]
}
