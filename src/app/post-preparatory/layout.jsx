import PostPreparatorySidebar from '@/components/layout/PostPreparatorySidebar'
import EntryGridKeyboardNavigation from '@/components/ui/entry-grid-keyboard-navigation'

export const metadata = {
  title: 'Post Preparatory Entry - KR Production System',
  description: 'Post preparatory process production entry - Autoconer & Spinning',
}

export default function PostPreparatoryLayout({ children }) {
  return (
    <div className="flex h-[calc(100dvh-3rem)] bg-gray-50">
      <EntryGridKeyboardNavigation />
      <PostPreparatorySidebar />
      <main className="min-w-0 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
