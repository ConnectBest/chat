import type { Metadata } from 'next';
import { Inter } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import './globals.css'

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'ConnectBest - Coming Soon',
  description: 'Where Teams Connect, Collaborate & Create',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexAuthNextjsServerProvider>
        <html lang="en">
          <body>{children}</body>
        </html>
    </ConvexAuthNextjsServerProvider>
  )
}
