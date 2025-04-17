import type { Metadata } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'
import { Header } from '@/components/layout/Header'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { AuthProvider } from '@/context/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Mediate',
  description: 'Enhance doctor-patient consultations with AI-powered analysis and assistance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <Header />
            <main className="min-h-screen bg-gray-50 pt-16">
              {children}
            </main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 