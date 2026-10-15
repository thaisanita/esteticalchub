import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Selinho "Pro" com cadeado, para junto de qualquer função exclusiva do plano Pro. */
export default function SeloPro({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary',
        className
      )}
    >
      <Lock size={10} /> Pro
    </span>
  );
}
