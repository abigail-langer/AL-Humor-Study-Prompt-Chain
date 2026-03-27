'use client'

import { useTheme, type Theme } from './ThemeProvider'

const options: { value: Theme; icon: string; title: string }[] = [
  { value: 'light',  icon: '☀',  title: 'Light mode'  },
  { value: 'system', icon: '⊙',  title: 'System default' },
  { value: 'dark',   icon: '☽',  title: 'Dark mode'   },
]

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center rounded-lg border border-violet-100 bg-violet-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          title={opt.title}
          className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
            theme === opt.value
              ? 'bg-white text-violet-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
              : 'text-violet-400 hover:text-violet-700 dark:text-gray-500 dark:hover:text-gray-300'
          }`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  )
}
