import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink-800">Page not found</h1>
      <p className="mt-2 text-[15px] text-ink-400">This page doesn't exist, or has moved.</p>
      <Link to="/">
        <Button className="mt-6">Back to menu</Button>
      </Link>
    </div>
  )
}
