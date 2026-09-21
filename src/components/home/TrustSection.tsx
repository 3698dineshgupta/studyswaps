'use client';

import { motion } from 'motion/react';
import { BadgeCheck, Eye, LockKeyhole, MapPin, Star } from 'lucide-react';
import { RevealGroup, RevealItem } from '@/components/ui/Reveal';
import SectionHeading from './SectionHeading';
import { SPRING } from '@/lib/motion';

const FEATURES = [
  { Icon: BadgeCheck, title: 'Verified Student Sellers', text: 'Every seller passes a live ID check before they can list.' },
  { Icon: LockKeyhole, title: 'Secure Payments', text: 'Pay with eSewa. Funds are released to the seller only after delivery.' },
  { Icon: MapPin, title: 'Doorstep Delivery', text: 'We collect from the seller and bring it to your address — no meetups.' },
  { Icon: Eye, title: 'Transparent Listings', text: 'Honest condition labels, real photos and clear pricing.' },
  { Icon: Star, title: 'Seller Ratings', text: 'Ratings and reviews from students who already bought.' },
];

export default function TrustSection() {
  return (
    <section aria-labelledby="trust-heading" className="page-container py-14 sm:py-20">
      <SectionHeading align="center" eyebrow="Trust" title="Buy with confidence" text="A marketplace built by students, for students — with safety designed in, not bolted on." />
      <span id="trust-heading" className="sr-only">Why students trust StudySwaps</span>
      <RevealGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" gap={0.08}>
        {FEATURES.map(({ Icon, title, text }) => (
          <RevealItem key={title}>
            <motion.div whileHover={{ y: -4 }} transition={SPRING.soft} className="group h-full rounded-2xl border border-gray-200/70 bg-white p-6 shadow-soft transition-shadow hover:shadow-lift">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-700 transition-all duration-300 group-hover:scale-110 group-hover:bg-green-600 group-hover:text-white">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{text}</p>
            </motion.div>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
