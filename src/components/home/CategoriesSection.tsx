import CategoryCard from '@/components/marketplace/CategoryCard';
import { RevealGroup, RevealItem } from '@/components/ui/Reveal';
import SectionHeading from './SectionHeading';
import { CATEGORIES } from '@/lib/constants';

/** Category tiles with live listing counts. Hidden on phones — the header's "All" button already lists every category there. */
export default function CategoriesSection({ counts }: { counts: Record<string, number> }) {
  return (
    <section aria-labelledby="cat-heading" className="page-container hidden py-14 sm:block sm:py-20">
      <SectionHeading eyebrow="Browse" title="Shop by category" text="From textbooks to lab gear — everything students pass on to each other." action={{ label: 'All listings', href: '/browse' }} />
      <span id="cat-heading" className="sr-only">Categories</span>
      <RevealGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {CATEGORIES.map((cat) => (
          <RevealItem key={cat.slug}>
            <CategoryCard slug={cat.slug} name={cat.name} count={counts[cat.slug]} />
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
