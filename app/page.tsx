import SignOutButton from '@/components/SignOutButton'
import FlavorBuilder from '@/components/FlavorBuilder'
import ThemeToggle from '@/components/ThemeToggle'

export default function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-gray-950">
      <header className="flex shrink-0 items-center justify-between border-b border-violet-100 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-900">
        <span className="text-sm font-bold text-violet-900 dark:text-gray-100">Humor Flavor Tool</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <main className="flex min-h-0 flex-1">
        <FlavorBuilder />
      </main>
    </div>
  )
}
