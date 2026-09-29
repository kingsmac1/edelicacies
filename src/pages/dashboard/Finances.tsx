import { useSearchParams } from 'react-router-dom'
import { OverviewTab } from './finances/OverviewTab'
import { SalesTab } from './finances/SalesTab'
import { ExpensesTab } from './finances/ExpensesTab'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sales', label: 'Sales' },
  { key: 'expenses', label: 'Expenses' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function OwnerFinances() {
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: TabKey = TABS.some((t) => t.key === tabParam) ? (tabParam as TabKey) : 'overview'

  function setTab(next: TabKey) {
    setParams(next === 'overview' ? {} : { tab: next }, { replace: true })
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-ink-800">Finances</h1>

      <div className="mt-4 flex w-fit gap-1 rounded-full bg-ink-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-9 rounded-full px-4 text-[13px] font-semibold ${
              tab === t.key ? 'bg-ink-900 text-white' : 'text-ink-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'overview' && <OverviewTab />}
        {tab === 'sales' && <SalesTab />}
        {tab === 'expenses' && <ExpensesTab />}
      </div>
    </div>
  )
}
