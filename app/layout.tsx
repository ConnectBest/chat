import type { Metadata } from 'next'
import './globals.css'
import React from 'react'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { SocketProvider } from '@/components/providers/SocketProvider'

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <QueryProvider>
          <SocketProvider>
            {children}
          </SocketProvider>
        </QueryProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

export const metadata: Metadata = {
  title: 'ConnectBest Chat - Secure Team Communication',
  description: 'Where Teams Connect, Collaborate & Create with enterprise-grade security',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="bg-gradient-to-br from-brand-600 to-brand-800">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
