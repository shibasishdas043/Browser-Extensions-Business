import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitives.Root>) {
  return (
    <SwitchPrimitives.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-[28px] w-[48px] shrink-0 cursor-pointer items-center rounded-full border border-black/5 bg-[#e9e9eb] transition-colors duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071e3] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:bg-[#34c759] active:scale-[0.96]',
        className
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-[24px] rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.18)] ring-0 transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-[2px]'
        )}
      />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
