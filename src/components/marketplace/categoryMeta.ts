import { Armchair, Bike, BookOpen, FlaskConical, Home, Laptop, Package, Shirt, Sprout, type LucideIcon } from 'lucide-react';

export interface CategoryMeta {
  Icon: LucideIcon;
  /** Soft tint classes for the icon tile */
  tint: string;
  /** Short line under the name on category cards */
  blurb: string;
}

/** One source of truth for category icons/colours (header pills, home cards, filters). */
export const CATEGORY_META: Record<string, CategoryMeta> = {
  books: { Icon: BookOpen, tint: 'bg-sky-50 text-sky-600 group-hover:bg-sky-100', blurb: 'Textbooks & notes' },
  electronics: { Icon: Laptop, tint: 'bg-violet-50 text-violet-600 group-hover:bg-violet-100', blurb: 'Laptops, phones, gadgets' },
  furniture: { Icon: Armchair, tint: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100', blurb: 'Desks, chairs, shelves' },
  clothing: { Icon: Shirt, tint: 'bg-rose-50 text-rose-600 group-hover:bg-rose-100', blurb: 'Uniforms & casual wear' },
  bicycles: { Icon: Bike, tint: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100', blurb: 'City & mountain bikes' },
  'hostel-items': { Icon: Home, tint: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100', blurb: 'Room & kitchen essentials' },
  'lab-equipment': { Icon: FlaskConical, tint: 'bg-teal-50 text-teal-600 group-hover:bg-teal-100', blurb: 'Instruments & tools' },
  'agricultural-equipment': { Icon: Sprout, tint: 'bg-lime-50 text-lime-600 group-hover:bg-lime-100', blurb: 'Farm & garden tools' },
  other: { Icon: Package, tint: 'bg-slate-100 text-slate-600 group-hover:bg-slate-200', blurb: 'Everything else' },
};

export const categoryMeta = (slug: string): CategoryMeta => CATEGORY_META[slug] ?? CATEGORY_META.other;
