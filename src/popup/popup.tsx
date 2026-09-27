export function Popup() {
  return (
    <main className="w-[400px] p-4 text-slate-900">
      <h1 className="text-base font-semibold">{content.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{content.status}</p>
      <button
        type="button"
        onClick={openFullTab}
        className="mt-4 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        {content.openFullTab}
      </button>
    </main>
  )
}

function openFullTab() {
  void chrome.tabs.create({ url: chrome.runtime.getURL('app.html') })
}

const content = {
  title: 'jobfit-jev',
  status:
    'Nothing to analyze yet. The job reader and assessment are not built.',
  openFullTab: 'Open full tab',
}
