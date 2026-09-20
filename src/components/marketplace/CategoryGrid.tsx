import Link from 'next/link'
import { CATEGORIES } from '@/lib/constants'

export function CategoryGrid() {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-9 gap-3">
      {CATEGORIES.map((cat) => (
        <Link
          key={cat.slug}
          href={`/browse?category=${cat.slug}`}
          className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-primary-50 group transition-colors"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary-50 group-hover:bg-primary-100 rounded-2xl flex items-center justify-center transition-colors">
            <span className="text-2xl sm:text-3xl">{cat.icon}</span>
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-gray-600 group-hover:text-primary-700 text-center leading-tight transition-colors">
            {cat.name.split(' ')[0]}
            {cat.name.includes(' ') && (
              <>
                <br />
                {cat.name.split(' ').slice(1).join(' ')}
              </>
            )}
          </span>
        </Link>
      ))}
    </div>
  )
}
