import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-[#0066cc] text-white',
        secondary:
          'bg-[#f5f5f7] text-[#7a7a7a] border border-[#e0e0e0]',
        outline:
          'border border-[#e0e0e0] text-[#1d1d1f] bg-white',
        success:
          'bg-[#34c759]/10 text-[#248a3d] border border-[#34c759]/25',
        action:
          'bg-[#0066cc]/10 text-[#0066cc] border border-[#0066cc]/25',
        destructive:
          'bg-[#ff3b30]/10 text-[#d70015] border border-[#ff3b30]/25',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
