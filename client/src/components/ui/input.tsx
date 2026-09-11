import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          /* A field is a well: dark hairline above, lit hairline below, the bevel
          reversed, so the surface looks pressed into the page. Gothic A1 because what people type here
             is data, and tabular figures so a pasted uuid or version does not
             wobble. */
          "font-ui flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-base ring-offset-background",
          "shadow-[inset_0_1px_0_0_hsl(var(--bg3-bevel-dark)/0.9),inset_0_-1px_0_0_hsl(var(--bg3-bevel-light)/0.4)]",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
