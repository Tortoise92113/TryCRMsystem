import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-primary/10 text-primary ring-primary/20',
        secondary:   'bg-secondary text-secondary-foreground ring-border',
        destructive: 'bg-destructive/10 text-destructive ring-destructive/20',
        outline:     'text-foreground ring-border',
        negotiating: 'bg-amber-50    text-amber-700  ring-amber-200',
        in_progress: 'bg-blue-50     text-blue-700   ring-blue-200',
        completed:   'bg-emerald-50  text-emerald-700 ring-emerald-200',
        cancelled:   'bg-zinc-100    text-zinc-500   ring-zinc-200',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
