import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot as SlotPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'cursor-pointer whitespace-nowrap focus-visible:outline-hidden inline-flex items-center justify-center text-sm font-medium ring-offset-background transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-60 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs shadow-black/5',
        mono: 'bg-zinc-950 text-white dark:bg-zinc-300 dark:text-black hover:bg-zinc-950/90 shadow-xs shadow-black/5',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs shadow-black/5',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-xs shadow-black/5',
        outline:
          'bg-background text-accent-foreground border border-input hover:bg-accent shadow-xs shadow-black/5',
        ghost:
          'text-accent-foreground hover:bg-accent hover:text-accent-foreground',
        dim: 'text-muted-foreground hover:text-foreground',
      },
      size: {
        lg: 'h-10 rounded-md px-4 text-sm gap-1.5 [&_svg:not([class*=size-])]:size-4',
        md: 'h-8.5 rounded-md px-3 gap-1.5 text-[0.8125rem] leading-(--text-sm--line-height) [&_svg:not([class*=size-])]:size-4',
        sm: 'h-7 rounded-md px-2.5 gap-1.25 text-xs [&_svg:not([class*=size-])]:size-3.5',
        icon: 'size-8.5 rounded-md [&_svg:not([class*=size-])]:size-4 shrink-0',
      },
      mode: {
        default:
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        icon: 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shrink-0',
        link: 'text-primary h-auto p-0 bg-transparent rounded-none hover:bg-transparent shadow-none',
      },
    },
    defaultVariants: {
      variant: 'primary',
      mode: 'default',
      size: 'md',
    },
  },
);

function Button({
  className,
  variant,
  mode,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? SlotPrimitive.Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, mode, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
