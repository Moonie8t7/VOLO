import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("faq-item", className)}
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "faq-item__header font-display flex w-full items-center justify-between gap-4 text-left",
        className
      )}
      {...props}
    >
      <span className="ruled">{children}</span>
      {/* The ring the site puts at the right of every question: a circle
          with a small diamond at its top and a chevron inside. Drawn here. */}
      <svg
        className="h-14 w-14 shrink-0"
        viewBox="0 0 56 56"
        width="56"
        height="56"
        aria-hidden="true"
      >
        <circle cx="28" cy="28" r="25" fill="none" stroke="#b99b77" strokeWidth="1" />
        <path d="M28 0.5l3 3-3 3-3-3z" fill="#b99b77" />
        <path className="faq-chevron" d="M19 24l9 9 9-9" fill="none" stroke="#e1cbb7" strokeWidth="1.5" />
      </svg>
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  /*
   * forceMount keeps closed answers in the DOM.
   *
   * Radix unmounts a closed panel by default, which meant every answer in the
   * FAQ existed only after a click: absent from the rendered page, and so
   * absent from search results and from anything summarising the site. Mounted
   * and hidden is indexed; unmounted is not. The hidden class does the hiding,
   * because forceMount stops Radix setting the hidden attribute itself.
   */
  <AccordionPrimitive.Content
    ref={ref}
    forceMount
    className="overflow-hidden data-[state=closed]:hidden data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("faq-item__content", className)}>{children}</div>
  </AccordionPrimitive.Content>
))

AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
