import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  /* active:scale gives the press immediate feedback before any work happens.
     Kept subtle, and the transition names its properties instead of `all`. */
  "font-ui inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[colors,transform] duration-150 ease-out-quint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* The site's primary call to action. Its whole look lives in the
           btn-chamfer rules, so no colour, tracking or case is set here: an
           earlier pass set bronze and a light sans from these utilities and
           they overrode the stylesheet every time it was corrected. */
        default: "chamfer btn-chamfer",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "chamfer select-frame btn-chamfer btn-chamfer-outline",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      /* The site's primary is 48 tall with 30 of side padding and an 18px
         label, which is the lg size. The other sizes keep the label's size in
         step with the height so the serif is not undersized in a tall box. */
      size: {
        default: "h-11 px-6 py-2 text-base",
        sm: "h-10 px-4 text-sm",
        lg: "h-12 px-[30px] text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
