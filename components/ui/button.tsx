"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/** CVA variant definitions for button styling. @source */
const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-md border border-transparent bg-clip-padding text-xs/relaxed font-medium focus-visible:ring-[2px] aria-invalid:ring-[2px] [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/75 hover:shadow-md hover:brightness-110",
        outline:
          "border-border dark:bg-input/30 hover:bg-accent hover:text-foreground hover:shadow-sm hover:border-border/80 aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/60 hover:shadow-sm aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-accent hover:text-foreground hover:shadow-sm dark:hover:bg-accent/70 aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 hover:bg-destructive/30 hover:shadow-sm focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/20 text-destructive focus-visible:border-destructive/40 dark:hover:bg-destructive/40",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default:
          "h-11 gap-1 px-3 text-xs/relaxed has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-7 gap-1 rounded-sm px-2 text-[0.625rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-2.5",
        sm: "h-9 gap-1 px-2.5 text-xs/relaxed has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-12 gap-1 px-3 text-xs/relaxed has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-4",
        icon: "size-11 [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "size-7 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-5"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

/** Styled button component with variant and size support. @source */
function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
