'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ReactNode } from 'react'

interface ThemeProviderProps {
  children: ReactNode;
  attribute?: string;
  defaultTheme?: string;
}

export function ThemeProvider({ 
  children, 
  attribute = "class",
  defaultTheme = "light"
}: ThemeProviderProps) {
  return (
    <NextThemesProvider 
      attribute={attribute} 
      defaultTheme={defaultTheme} 
      enableSystem={false} 
      forcedTheme="light"
    >
      {children}
    </NextThemesProvider>
  )
}