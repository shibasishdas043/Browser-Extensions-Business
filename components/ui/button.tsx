import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.96]',
  {
    variants: {
      variant: {
        default:
          'bg-[#0066cc] text-white hover:bg-[#0071e3] shadow-none rounded-full',
        secondary:
          'bg-white text-[#0066cc] border border-[#0066cc] hover:bg-[#0066cc]/5 rounded-full',
        utility:
          'bg-[#1d1d1f] text-white hover:bg-[#333333] rounded-[8px]',
        pearl:
          'bg-[#fafafc] text-[#1d1d1f] border border-[#e0e0e0] hover:bg-white rounded-[11px]',
        outline:
          'border border-[#e0e0e0] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7] rounded-full',
        ghost:
          'text-[#0066cc] hover:bg-[#0066cc]/5 rounded-full',
        destructive:
          'bg-[#ff3b30] text-white hover:bg-[#ff453a] rounded-full',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'size-9 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
