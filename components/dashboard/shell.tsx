'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { Sidebar } from './sidebar'
import { Header } from './header'
import { AuditLogDrawer } from './audit-log-drawer'
// Lazy load - AI chat is heavy (AI SDK, markdown renderer). Chunk is fetched
// only when the user first opens the launcher, not on every page load.
const AIChatBubble = dynamic(
  () => import('./ai/chat-bubble').then(mod => ({ default: mod.AIChatBubble })),
  { ssr: false }
)

export function DashboardShell({
  children,
  userEmail,
  userName,
  avatarUrl,
  userRole,
}: {
  children: React.ReactNode
  userEmail: string
  userName?: string
  avatarUrl?: string
  userRole: string
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [chatMounted, setChatMounted] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  return (
    <div className="flex h-full bg-slate-50 dark:bg-[#071F15] overflow-auto overscroll-y-contain text-slate-600 dark:text-slate-300">
        {/* Sidebar */}
        <Sidebar
          userEmail={userEmail}
          userRole={userRole}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={isCollapsed}
          scrollTargetRef={mainRef}
        />

        {/* Main Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            userEmail={userEmail}
            userName={userName}
            avatarUrl={avatarUrl}
            onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            isCollapsed={isCollapsed}
            onCollapseToggle={() => setIsCollapsed(!isCollapsed)}
            onAuditOpen={() => setAuditOpen(true)}
          />
          <main ref={mainRef} className="flex-1 overflow-auto overscroll-y-contain bg-white dark:bg-[#0a0a0a]">
            {children}
          </main>
        </div>

        {chatMounted && <AIChatBubble onDismiss={() => setChatMounted(false)} />}
        {!chatMounted && (
          <button
            onClick={() => setChatMounted(true)}
            className="fixed z-[var(--z-dropdown)]"
            style={{ left: 24, bottom: 24 }}
            title="Open chat assistant"
          >
            <Image
              src="/clippy-waiting.gif"
              alt="Chat assistant"
              width={80}
              height={80}
              className="h-20 w-auto drop-shadow-2xl hover:scale-110 active:scale-95 transition-all"
            />
          </button>
        )}
        <AuditLogDrawer isOpen={auditOpen} onClose={() => setAuditOpen(false)} />
      </div>
  )
}
