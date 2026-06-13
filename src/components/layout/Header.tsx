'use client'

import { Search, Bell } from 'lucide-react'

interface HeaderProps {
  userName?: string;
}

export default function Header({ userName = 'Usuario' }: HeaderProps) {
  const initials = userName.substring(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-x-4 border-b border-border bg-surface/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <form className="relative flex flex-1" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Buscar
          </label>
          <Search
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-foreground/40"
            aria-hidden="true"
          />
          <input
            id="search-field"
            className="block h-full w-full border-0 py-0 pl-8 pr-0 text-foreground bg-transparent placeholder:text-foreground/40 focus:ring-0 sm:text-sm"
            placeholder="Buscar firmas, empresas o transacciones..."
            type="search"
            name="search"
          />
        </form>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <button type="button" className="-m-2.5 p-2.5 text-foreground/50 hover:text-foreground">
            <span className="sr-only">Ver notificaciones</span>
            <Bell className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" aria-hidden="true" />
          <div className="flex items-center gap-x-4">
            <div className="h-8 w-8 rounded-full bg-brand/20 flex items-center justify-center text-brand font-semibold text-sm">
              {initials}
            </div>
            <span className="hidden lg:flex lg:items-center">
              <span className="text-sm font-semibold leading-6 text-foreground" aria-hidden="true">
                {userName}
              </span>
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
