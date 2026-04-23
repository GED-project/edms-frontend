import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  `
    flex w-full bg-background border border-input shadow-xs shadow-black/5 transition-[color,box-shadow] text-foreground placeholder:text-muted-foreground/80 
    focus-visible:ring-ring/30 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px]
    disabled:cursor-not-allowed disabled:opacity-60
    aria-invalid:border-destructive/60 aria-invalid:ring-destructive/10 dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/20
  `,
  {
    variants: {
      variant: {
        lg: 'h-10 px-4 text-sm rounded-md',
        md: 'h-8.5 px-3 text-[0.8125rem] leading-(--text-sm--line-height) rounded-md',
        sm: 'h-7 px-2.5 text-xs rounded-md',
      },
    },
    defaultVariants: { variant: 'md' },
  },
);

function Input({
  className,
  type,
  variant,
  ...props
}: React.ComponentProps<'input'> & VariantProps<typeof inputVariants>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(inputVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Input, inputVariants };
