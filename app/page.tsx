'use client'

import { useState } from 'react'
import SignOutButton from '@/components/SignOutButton'
import FlavorBuilder from '@/components/FlavorBuilder'
import TestingStation from '@/components/TestingStation'

type Tab = 'builder' | 'testing'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('builder')

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top nav */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <span className="text-sm font-bold text-gray-900">Humor Flavor Tool</span>
        <div className="flex items-center gap-6">
          <nav className="flex gap-1">
            <button
              onClick={() => setActiveTab('builder')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'builder'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Flavor Builder
            </button>
            <button
              onClick={() => setActiveTab('testing')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'testing'
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Testing Station
            </button>
          </nav>
          <SignOutButton />
        </div>
      </header>

      {/* Content */}
      <main className="flex min-h-0 flex-1">
        {activeTab === 'builder' ? <FlavorBuilder /> : <TestingStation />}
      </main>
    </div>
  )
}
