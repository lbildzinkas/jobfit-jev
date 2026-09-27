export function App() {
  return (
    <main className="mx-auto max-w-4xl p-8 text-slate-900">
      <h1 className="text-2xl font-semibold">{content.title}</h1>
      <p className="mt-2 text-slate-600">{content.status}</p>
    </main>
  )
}

const content = {
  title: 'jobfit-jev',
  status:
    'Setup, requirement confirmation, and the evidence ledger will appear here.',
}
