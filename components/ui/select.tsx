"use client"

import { Select as SelectPrimitive } from "@base-ui/react/select"
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Tick02Icon,
  UnfoldMoreIcon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"

import { cn } from "@/lib/utils"

/** Context value for mapping select item values to display labels. @source */
type SelectLabelContextValue = {
  labels: Map<string, React.ReactNode>
  register: (value: string, label: React.ReactNode) => void
  unregister: (value: string) => void
}

/** React context for sharing item value-to-label mappings. @source */
const SelectLabelContext = React.createContext<SelectLabelContextValue | null>(
  null
)

/** Converts a value to a stable string key. @source */
const toValueKey = (value: unknown) =>
  value === null || value === undefined ? "" : String(value)

/** Checks whether a React element is a SelectItem. @source */
const isSelectItemElement = (child: React.ReactElement): boolean => {
  const elementType = child.type
  if (elementType === SelectItem) return true
  if (typeof elementType === "function") {
    return (
      (elementType as { displayName?: string }).displayName === "SelectItem"
    )
  }
  if (typeof elementType === "object" && elementType !== null) {
    const wrapped = elementType as {
      type?: unknown
      render?: unknown
      displayName?: string
    }
    return (
      wrapped.type === SelectItem ||
      wrapped.render === SelectItem ||
      wrapped.displayName === "SelectItem"
    )
  }
  return false
}

/** Recursively walks children to build a value-to-label map from SelectItems. @source */
function collectLabelsFromChildren(children: React.ReactNode) {
  const labels = new Map<string, React.ReactNode>()
  const walk = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return
      const childProps = child.props as {
        children?: React.ReactNode
        value?: unknown
      }
      if (isSelectItemElement(child)) {
        const valueKey = toValueKey(childProps.value)
        if (valueKey) {
          labels.set(valueKey, childProps.children ?? valueKey)
        }
        return
      }
      if (childProps.children) {
        walk(childProps.children)
      }
    })
  }
  walk(children)
  return labels
}

/** Root select component with automatic label resolution via context. @source */
function Select<Value, Multiple extends boolean | undefined = false>({
  children,
  ...props
}: Readonly<SelectPrimitive.Root.Props<Value, Multiple>>) {
  const staticLabels = React.useMemo(
    () => collectLabelsFromChildren(children),
    [children]
  )
  const [dynamicLabels, setDynamicLabels] = React.useState(
    () => new Map<string, React.ReactNode>()
  )
  const mergedLabels = React.useMemo(() => {
    if (dynamicLabels.size === 0) return staticLabels
    const next = new Map(staticLabels)
    dynamicLabels.forEach((label, key) => {
      next.set(key, label)
    })
    return next
  }, [dynamicLabels, staticLabels])

  const register = React.useCallback(
    (value: string, label: React.ReactNode) => {
      setDynamicLabels((prev) => {
        const existing = prev.get(value)
        if (Object.is(existing, label)) return prev
        const next = new Map(prev)
        next.set(value, label)
        return next
      })
    },
    []
  )

  const unregister = React.useCallback((value: string) => {
    setDynamicLabels((prev) => {
      if (!prev.has(value)) return prev
      const next = new Map(prev)
      next.delete(value)
      return next
    })
  }, [])

  const contextValue = React.useMemo(
    () => ({ labels: mergedLabels, register, unregister }),
    [mergedLabels, register, unregister]
  )

  return (
    <SelectLabelContext.Provider value={contextValue}>
      <SelectPrimitive.Root {...props}>{children}</SelectPrimitive.Root>
    </SelectLabelContext.Provider>
  )
}

/** Logical group of related select items. @source */
function SelectGroup({
  className,
  ...props
}: Readonly<SelectPrimitive.Group.Props>) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

/** Displays the currently selected value or a placeholder. @source */
function SelectValue({
  className,
  placeholder,
  children,
  ...props
}: Readonly<SelectPrimitive.Value.Props>) {
  const labelContext = React.useContext(SelectLabelContext)
  const renderValue = React.useCallback(
    (value: unknown): React.ReactNode => {
      if (value === null || value === undefined || value === "") {
        return placeholder ?? null
      }
      const key = toValueKey(value)
      const label = labelContext?.labels.get(key)
      return label ?? String(value)
    },
    [labelContext, placeholder]
  )
  const resolvedChildren =
    children ?? (labelContext?.labels.size ? renderValue : undefined)

  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      placeholder={placeholder}
      {...props}
    >
      {resolvedChildren}
    </SelectPrimitive.Value>
  )
}

/** Trigger button that opens the select dropdown. @source */
function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "border-input data-placeholder:text-muted-foreground bg-input/20 dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/30 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex w-fit items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-xs/relaxed whitespace-nowrap transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 data-[size=default]:h-7 data-[size=sm]:h-6 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <HugeiconsIcon
            icon={UnfoldMoreIcon}
            strokeWidth={2}
            className="text-muted-foreground pointer-events-none size-3.5"
          />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

/** Positioned popup containing selectable items. @source */
function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg shadow-md ring-1 duration-100 data-[align-trigger=true]:animate-none",
            className
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

/** Label heading for a select group. @source */
function SelectLabel({
  className,
  ...props
}: Readonly<SelectPrimitive.GroupLabel.Props>) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  )
}

/** Selectable option within the select dropdown. @source */
function SelectItem({
  className,
  children,
  ...props
}: Readonly<SelectPrimitive.Item.Props>) {
  const labelContext = React.useContext(SelectLabelContext)
  const valueKey = toValueKey(props.value)
  const register = labelContext?.register
  const unregister = labelContext?.unregister
  const label = React.useMemo(() => children ?? valueKey, [children, valueKey])

  React.useEffect(() => {
    if (!register || !unregister || !valueKey) return
    register(valueKey, label)
    return () => {
      unregister(valueKey)
    }
  }, [label, register, unregister, valueKey])

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex items-center justify-center" />
        }
      >
        <HugeiconsIcon
          icon={Tick02Icon}
          strokeWidth={2}
          className="pointer-events-none"
        />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

/** Horizontal divider between select groups. @source */
function SelectSeparator({
  className,
  ...props
}: Readonly<SelectPrimitive.Separator.Props>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(
        "bg-border/50 pointer-events-none -mx-1 my-1 h-px",
        className
      )}
      {...props}
    />
  )
}

/** Scroll indicator arrow at the top of the select list. @source */
function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "bg-popover top-0 z-10 flex w-full cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
    </SelectPrimitive.ScrollUpArrow>
  )
}

/** Scroll indicator arrow at the bottom of the select list. @source */
function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bg-popover bottom-0 z-10 flex w-full cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue
}
