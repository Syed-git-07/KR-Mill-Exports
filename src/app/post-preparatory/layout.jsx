import PostPreparatorySidebar from '@/components/layout/PostPreparatorySidebar'

export const metadata = {
  title: 'Post Preparatory Entry - KR Production System',
  description: 'Post preparatory process production entry - Autoconer & Spinning',
}

export default function PostPreparatoryLayout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <PostPreparatorySidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
