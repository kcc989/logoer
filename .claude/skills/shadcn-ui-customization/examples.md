# Component Customization Examples

Concrete examples for common customization scenarios. Reference this when implementing specific aesthetic directions.

## Complete Theme Example: "Refined Editorial"

A sophisticated, magazine-inspired theme with warm neutrals and considered typography.

### globals.css

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

:root {
  /* Warm stone palette */
  --background: oklch(0.985 0.005 60);
  --foreground: oklch(0.18 0.02 45);

  --card: oklch(1 0 0);
  --card-foreground: oklch(0.18 0.02 45);

  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.18 0.02 45);

  --primary: oklch(0.25 0.03 45);
  --primary-foreground: oklch(0.98 0.005 60);

  --secondary: oklch(0.96 0.008 60);
  --secondary-foreground: oklch(0.25 0.03 45);

  --muted: oklch(0.96 0.008 60);
  --muted-foreground: oklch(0.5 0.02 45);

  --accent: oklch(0.65 0.12 25); /* Terracotta accent */
  --accent-foreground: oklch(0.98 0.005 25);

  --destructive: oklch(0.55 0.2 25);
  --destructive-foreground: oklch(0.98 0.01 25);

  --border: oklch(0.9 0.01 60);
  --input: oklch(0.9 0.01 60);
  --ring: oklch(0.65 0.12 25);

  /* Refined radius */
  --radius: 0.375rem;

  /* Custom animation timing */
  --animation-duration: 250ms;
  --ease-refined: cubic-bezier(0.25, 0.1, 0.25, 1);
}

.dark {
  --background: oklch(0.12 0.015 45);
  --foreground: oklch(0.94 0.005 60);

  --card: oklch(0.16 0.015 45);
  --card-foreground: oklch(0.94 0.005 60);

  --popover: oklch(0.18 0.015 45);
  --popover-foreground: oklch(0.94 0.005 60);

  --primary: oklch(0.94 0.005 60);
  --primary-foreground: oklch(0.12 0.015 45);

  --secondary: oklch(0.22 0.015 45);
  --secondary-foreground: oklch(0.94 0.005 60);

  --muted: oklch(0.22 0.015 45);
  --muted-foreground: oklch(0.6 0.01 45);

  --accent: oklch(0.7 0.12 25);
  --accent-foreground: oklch(0.12 0.015 45);

  --border: oklch(0.28 0.01 45);
  --input: oklch(0.28 0.01 45);
  --ring: oklch(0.7 0.12 25);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 2px);
  --radius-xl: calc(var(--radius) + 6px);

  --font-sans: var(--font-body), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-display), ui-serif, Georgia, serif;
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground antialiased;
    font-feature-settings:
      'kern' 1,
      'liga' 1;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    font-family: var(--font-display);
    @apply tracking-tight;
  }
}
```

### Button (Editorial Style)

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'whitespace-nowrap text-sm font-medium',
    'transition-all duration-[var(--animation-duration)]',
    'ease-[var(--ease-refined)]',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-ring focus-visible:ring-offset-2',
    'focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90',
          'shadow-sm',
        ],
        destructive: [
          'bg-destructive text-destructive-foreground',
          'hover:bg-destructive/90',
          'shadow-sm',
        ],
        outline: [
          'border border-input bg-transparent',
          'hover:bg-accent/10 hover:text-accent-foreground',
          'hover:border-accent/50',
        ],
        secondary: [
          'bg-secondary text-secondary-foreground',
          'hover:bg-secondary/80',
        ],
        ghost: ['hover:bg-accent/10 hover:text-accent-foreground'],
        link: ['text-primary underline-offset-4', 'hover:underline'],
        accent: [
          'bg-accent text-accent-foreground',
          'hover:bg-accent/90',
          'shadow-sm',
        ],
      },
      size: {
        default: 'h-10 px-5 py-2 rounded-md',
        sm: 'h-8 px-3 text-xs rounded-md',
        lg: 'h-12 px-8 text-base rounded-md',
        icon: 'h-10 w-10 rounded-md',
        'icon-sm': 'h-8 w-8 rounded-md',
        'icon-lg': 'h-12 w-12 rounded-md',
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
```

### Card (Editorial Style)

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg border bg-card text-card-foreground',
      'shadow-sm transition-shadow duration-[var(--animation-duration)]',
      'hover:shadow-md',
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6 pb-4', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'font-display text-xl font-semibold leading-tight tracking-tight',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground leading-relaxed', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
```

### Input (Editorial Style)

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-md',
          'border border-input bg-transparent',
          'px-4 py-2 text-sm',
          'transition-colors duration-[var(--animation-duration)]',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground/70',
          'focus-visible:outline-none',
          'focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
```

---

## Complete Theme Example: "Bold Startup"

Energetic, playful theme with vibrant colors and bouncy interactions.

### globals.css

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.99 0.005 280);
  --foreground: oklch(0.15 0.03 280);

  --card: oklch(1 0 0);
  --card-foreground: oklch(0.15 0.03 280);

  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.15 0.03 280);

  /* Vibrant violet primary */
  --primary: oklch(0.55 0.28 280);
  --primary-foreground: oklch(0.99 0.01 280);

  --secondary: oklch(0.96 0.02 280);
  --secondary-foreground: oklch(0.2 0.03 280);

  --muted: oklch(0.96 0.02 280);
  --muted-foreground: oklch(0.5 0.02 280);

  /* Electric lime accent */
  --accent: oklch(0.85 0.25 130);
  --accent-foreground: oklch(0.2 0.05 130);

  --destructive: oklch(0.6 0.24 25);
  --destructive-foreground: oklch(0.98 0.01 25);

  --border: oklch(0.92 0.01 280);
  --input: oklch(0.92 0.01 280);
  --ring: oklch(0.55 0.28 280);

  /* Fully rounded */
  --radius: 1rem;

  /* Bouncy timing */
  --animation-duration: 200ms;
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.dark {
  --background: oklch(0.12 0.025 280);
  --foreground: oklch(0.96 0.01 280);

  --card: oklch(0.16 0.025 280);
  --card-foreground: oklch(0.96 0.01 280);

  --popover: oklch(0.18 0.025 280);
  --popover-foreground: oklch(0.96 0.01 280);

  --primary: oklch(0.7 0.25 280);
  --primary-foreground: oklch(0.12 0.02 280);

  --secondary: oklch(0.22 0.025 280);
  --secondary-foreground: oklch(0.96 0.01 280);

  --muted: oklch(0.22 0.025 280);
  --muted-foreground: oklch(0.65 0.02 280);

  --accent: oklch(0.8 0.22 130);
  --accent-foreground: oklch(0.15 0.05 130);

  --border: oklch(0.28 0.02 280);
  --input: oklch(0.28 0.02 280);
  --ring: oklch(0.7 0.25 280);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 8px);
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground antialiased;
  }
}
```

### Button (Bold Startup Style)

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2',
    'whitespace-nowrap font-semibold',
    'transition-all duration-[var(--animation-duration)]',
    'ease-[var(--ease-spring)]',
    'focus-visible:outline-none focus-visible:ring-2',
    'focus-visible:ring-ring focus-visible:ring-offset-2',
    'focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0',
    // Bouncy press effect
    'active:scale-95',
  ],
  {
    variants: {
      variant: {
        default: [
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90 hover:-translate-y-0.5',
          'shadow-lg shadow-primary/30',
          'hover:shadow-xl hover:shadow-primary/40',
        ],
        destructive: [
          'bg-destructive text-destructive-foreground',
          'hover:bg-destructive/90 hover:-translate-y-0.5',
          'shadow-lg shadow-destructive/30',
        ],
        outline: [
          'border-2 border-primary bg-transparent text-primary',
          'hover:bg-primary hover:text-primary-foreground',
          'hover:-translate-y-0.5',
        ],
        secondary: [
          'bg-secondary text-secondary-foreground',
          'hover:bg-secondary/80 hover:-translate-y-0.5',
          'shadow-md',
        ],
        ghost: ['hover:bg-primary/10 hover:text-primary'],
        link: ['text-primary underline-offset-4', 'hover:underline'],
        accent: [
          'bg-accent text-accent-foreground',
          'hover:bg-accent/90 hover:-translate-y-0.5',
          'shadow-lg shadow-accent/30',
        ],
      },
      size: {
        default: 'h-11 px-6 py-2 text-sm rounded-xl',
        sm: 'h-9 px-4 text-xs rounded-lg',
        lg: 'h-14 px-10 text-base rounded-2xl',
        icon: 'h-11 w-11 rounded-xl',
        'icon-sm': 'h-9 w-9 rounded-lg',
        'icon-lg': 'h-14 w-14 rounded-2xl',
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
```

---

## Complete Theme Example: "Technical / Developer"

Clean, precise theme optimized for developer tools and technical interfaces.

### globals.css

```css
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(0.99 0 0);
  --foreground: oklch(0.15 0 0);

  --card: oklch(0.98 0 0);
  --card-foreground: oklch(0.15 0 0);

  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.15 0 0);

  /* Neutral primary */
  --primary: oklch(0.2 0 0);
  --primary-foreground: oklch(0.98 0 0);

  --secondary: oklch(0.96 0 0);
  --secondary-foreground: oklch(0.2 0 0);

  --muted: oklch(0.96 0 0);
  --muted-foreground: oklch(0.45 0 0);

  /* Blue accent for actions */
  --accent: oklch(0.55 0.2 250);
  --accent-foreground: oklch(0.98 0.01 250);

  --destructive: oklch(0.55 0.22 25);
  --destructive-foreground: oklch(0.98 0.01 25);

  --border: oklch(0.9 0 0);
  --input: oklch(0.9 0 0);
  --ring: oklch(0.55 0.2 250);

  /* Sharp corners */
  --radius: 0.25rem;

  /* Snappy timing */
  --animation-duration: 150ms;
}

.dark {
  --background: oklch(0.1 0 0);
  --foreground: oklch(0.92 0 0);

  --card: oklch(0.14 0 0);
  --card-foreground: oklch(0.92 0 0);

  --popover: oklch(0.16 0 0);
  --popover-foreground: oklch(0.92 0 0);

  --primary: oklch(0.92 0 0);
  --primary-foreground: oklch(0.1 0 0);

  --secondary: oklch(0.2 0 0);
  --secondary-foreground: oklch(0.92 0 0);

  --muted: oklch(0.2 0 0);
  --muted-foreground: oklch(0.6 0 0);

  --accent: oklch(0.65 0.18 250);
  --accent-foreground: oklch(0.1 0.02 250);

  --border: oklch(0.25 0 0);
  --input: oklch(0.25 0 0);
  --ring: oklch(0.65 0.18 250);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --radius-sm: var(--radius);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 2px);
  --radius-xl: calc(var(--radius) + 4px);

  --font-mono: ui-monospace, 'SF Mono', Menlo, Monaco, monospace;
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground antialiased;
    font-feature-settings:
      'kern' 1,
      'ss01' 1;
  }

  code,
  pre,
  kbd {
    font-family: var(--font-mono);
  }
}
```

### Button (Technical Style)

```tsx
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5',
    'whitespace-nowrap text-sm font-medium',
    'transition-colors duration-[var(--animation-duration)]',
    'focus-visible:outline-none focus-visible:ring-1',
    'focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        default: ['bg-primary text-primary-foreground', 'hover:bg-primary/90'],
        destructive: [
          'bg-destructive text-destructive-foreground',
          'hover:bg-destructive/90',
        ],
        outline: ['border border-input bg-transparent', 'hover:bg-muted'],
        secondary: [
          'bg-secondary text-secondary-foreground',
          'hover:bg-secondary/80',
        ],
        ghost: ['hover:bg-muted'],
        link: ['text-accent underline-offset-4', 'hover:underline'],
        accent: ['bg-accent text-accent-foreground', 'hover:bg-accent/90'],
      },
      size: {
        default: 'h-8 px-3 py-1.5 rounded',
        sm: 'h-7 px-2 text-xs rounded',
        lg: 'h-10 px-4 rounded',
        icon: 'h-8 w-8 rounded',
        'icon-sm': 'h-7 w-7 rounded',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
```

---

## Animation Recipes

### Overlay Enter/Exit (CSS)

```css
@keyframes overlay-enter {
  from {
    opacity: 0;
    transform: scale(0.98) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes overlay-exit {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.98) translateY(4px);
  }
}

.animate-overlay-enter {
  animation: overlay-enter var(--animation-duration) var(--ease-out-expo);
}

.animate-overlay-exit {
  animation: overlay-exit var(--animation-duration) var(--ease-in-expo);
}
```

### Staggered List Reveal

```tsx
// Use with motion library
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

function StaggeredList({ items }) {
  return (
    <motion.ul variants={container} initial="hidden" animate="show">
      {items.map((item) => (
        <motion.li key={item.id} variants={item}>
          {item.content}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

### Skeleton Shimmer

```css
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--muted) 25%,
    var(--muted-foreground/10) 50%,
    var(--muted) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### Button Loading State

```tsx
function LoadingButton({ loading, children, ...props }) {
  return (
    <Button disabled={loading} {...props}>
      {loading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
```
