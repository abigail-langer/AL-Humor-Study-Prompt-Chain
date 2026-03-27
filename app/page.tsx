import SignOutButton from '@/components/SignOutButton'
import FlavorBuilder from '@/components/FlavorBuilder'

export default function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <span className="text-sm font-bold text-gray-900">Humor Flavor Tool</span>
        <SignOutButton />
      </header>
      <main className="flex min-h-0 flex-1">
        <FlavorBuilder />
      </main>
    </div>
  )
}
