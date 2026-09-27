// The single selector data module (docs/spec.md §5.1): every CSS selector,
// regular expression, and non-CSS step label the reader consults. A LinkedIn
// markup change should need edits here and nowhere else.
//
// The classic selector arrays and the SDUI description order started from two
// MIT-licensed prior-art lists, pruned to what still matches (evidence and
// match counts: docs/linkedin-structure.md §6; sources: docs/spec.md §12).

/** CSS selectors, grouped by the step that tries them. */
export const selectors = {
  jsonld: 'script[type="application/ld+json"]',

  layout: {
    sduiScreen: '[data-sdui-screen]',
    sduiComponent: '[data-sdui-component]',
    jobDetailsKey: '[componentkey^="JobDetails_"]',
    classicTitle: '.job-details-jobs-unified-top-card__job-title',
    classicDescription: '#job-details',
  },

  sdui: {
    detailRoot: {
      semanticJobDetails: '[data-sdui-screen$=".SemanticJobDetails"]',
      jobDetails: '[data-sdui-screen$=".JobDetails"]',
    },
    paneKey: '[componentkey^="JobDetails_AboutTheJob_"]',
    description: {
      /** `{jobId}` is replaced with the URL job id at try time. */
      jobScoped:
        '[componentkey="JobDetails_AboutTheJob_{jobId}"] [data-testid="expandable-text-box"]',
      aboutTheJob:
        '[data-sdui-component$=".aboutTheJob"] [data-testid="expandable-text-box"]',
      longestBox: '[data-testid="expandable-text-box"]',
    },
    companyLink: 'a[href*="/company/"]',
  },

  classic: {
    detailRoot: {
      jobDetails: '.jobs-search__job-details',
      detail: '.scaffold-layout__detail',
    },
    pane: {
      titleLink:
        '.job-details-jobs-unified-top-card__job-title h1 a[href*="/jobs/view/"]',
      applyButton: '.jobs-apply-button[data-job-id]',
    },
    description: {
      jobDetails: '#job-details',
      contentBox: '.jobs-description__content .jobs-box__html-content',
      htmlContent: '.jobs-box__html-content',
      stretch: '.jobs-description-content__text--stretch',
    },
    title: {
      topCard: '.job-details-jobs-unified-top-card__job-title h1',
      t24: 'h1.t-24',
      anyH1: 'h1',
    },
    company: {
      link: '.job-details-jobs-unified-top-card__company-name a',
      container: '.job-details-jobs-unified-top-card__company-name',
    },
    location: {
      primary:
        '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
      tertiary:
        '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text',
    },
    workplace: '.job-details-fit-level-preferences button strong',
  },
} as const

/** Regular expressions and other match patterns. */
export const patterns = {
  /** `/jobs/view/<id>` anywhere in the path. */
  jobIdFromPath: /\/jobs\/view\/(\d+)/,
  /** The pane job id at the end of `JobDetails_AboutTheJob_<id>`. */
  paneKeySuffix: /JobDetails_AboutTheJob_(\d+)$/,
  /** Classic `(3) Jobs`-style notification prefix on `document.title`. */
  docTitleCountPrefix: /^\(\d+\)\s+/,
  titleSeparator: ' | ',
  workplaceExact: /^(Remote|Hybrid|On-site)$/,
  workplaceContained: /\b(Remote|Hybrid|On-site)\b/,
  /** The classic description box opens with this heading; the reader drops it. */
  leadingAboutTheJob: /^about the job$/i,
} as const

/** Labels for steps that are not a single CSS selector. They appear in
 *  `Field.selector` and `health` so a broken step can be named in the UI. */
export const stepLabels = {
  titleFromDocTitle: 'document.title segment 1',
  companyFromDocTitle: 'document.title segment 2',
  sduiTitleByText:
    'element outside [data-sdui-component] whose text = document.title segment 1',
  sduiLocation:
    'first span of the first p after the title containing ·, outside [data-sdui-component]',
  sduiWorkplace:
    'a/span outside [data-sdui-component] with text Remote, Hybrid, or On-site',
  classicWorkplace:
    '.job-details-fit-level-preferences button strong matching Remote, Hybrid, or On-site',
  sduiPaneKey: 'digit suffix of [componentkey^="JobDetails_AboutTheJob_"]',
  classicPaneLink: 'job id in the top-card h1 link to /jobs/view/<id>',
  classicPaneApply: 'job id in .jobs-apply-button[data-job-id]',
  commonAncestor: 'nearest common ancestor of [componentkey^="JobDetails_"]',
  jsonldTitle: 'jsonld JobPosting.title',
  jsonldCompany: 'jsonld JobPosting.hiringOrganization.name',
  jsonldLocation: 'jsonld JobPosting.jobLocation',
} as const

/** The SDUI description selector scoped to one job id (spec §5.2 step 7). */
export function jobScopedDescription(jobId: string): string {
  return selectors.sdui.description.jobScoped.replace('{jobId}', jobId)
}
