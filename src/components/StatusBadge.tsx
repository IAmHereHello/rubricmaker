import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'development' | 'mastered' | 'expert';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusLabels = {
  development: 'In Ontwikkeling',
  mastered: 'Beheerst',
  expert: 'Expert',
};

export function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold transition-all animate-scale-in",
        status === 'development' && "status-development",
        status === 'mastered' && "status-mastered",
        status === 'expert' && "status-expert",
        size === 'sm' && "px-2.5 py-0.5 text-xs",
        size === 'md' && "px-3 py-1 text-sm",
        size === 'lg' && "px-4 py-1.5 text-base"
      )}
    >
      {label || statusLabels[status]}
    </span>
  );
}
