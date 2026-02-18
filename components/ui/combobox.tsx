"use client"

import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import {
  ArrowDown01Icon,
  Cancel01Icon,
  Tick02Icon
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

/** Root combobox provider from Base UI. @source */
const Combobox = ComboboxPrimitive.Root

/** Displays the selected combobox value. @source */
function ComboboxValue({ ...props }: Readonly<ComboboxPrimitive.Value.Props>) {
  return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />
}

/** Button trigger that opens/closes the combobox dropdown. @source */
function ComboboxTrigger({
  className,
  children,
  ...props
}: Readonly<ComboboxPrimitive.Trigger.Props>) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn("[&_svg:not([class*='size-'])]:size-3.5", className)}
      {...props}
    >
      {children}
      <HugeiconsIcon
        icon={ArrowDown01Icon}
        strokeWidth={2}
        className="text-muted-foreground pointer-events-none size-3.5"
      />
    </ComboboxPrimitive.Trigger>
  )
}

/** Clear button that resets the combobox value. @source */
function ComboboxClear({
  className,
  ...props
}: Readonly<ComboboxPrimitive.Clear.Props>) {
  return (
    <ComboboxPrimitive.Clear
      data-slot="combobox-clear"
      render={<InputGroupButton variant="ghost" size="icon-xs" />}
      className={cn(className)}
      aria-label="Clear"
      {...props}
    >
      <HugeiconsIcon
        icon={Cancel01Icon}
        strokeWidth={2}
        className="pointer-events-none"
      />
    </ComboboxPrimitive.Clear>
  )
}

/**
 * Combobox input with integrated trigger and optional clear button.
 * @param showTrigger - Show the dropdown arrow.
 * @param showClear - Show the clear button.
 * @source
 */
function ComboboxInput({
  className,
  children,
  disabled = false,
  showTrigger = true,
  showClear = false,
  ...props
}: ComboboxPrimitive.Input.Props & {
  showTrigger?: boolean
  showClear?: boolean
}) {
  return (
    <InputGroup className={cn("w-auto", className)}>
      <ComboboxPrimitive.Input
        render={<InputGroupInput disabled={disabled} />}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        {showTrigger && (
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            render={<ComboboxTrigger />}
            data-slot="input-group-button"
            className="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
            disabled={disabled}
          />
        )}
        {showClear && <ComboboxClear disabled={disabled} />}
      </InputGroupAddon>
      {children}
    </InputGroup>
  )
}

/** Positioned popup containing the combobox option list. @source */
function ComboboxContent({
  className,
  side = "bottom",
  sideOffset = 6,
  align = "start",
  alignOffset = 0,
  anchor,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset" | "anchor"
  >) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          data-chips={!!anchor}
          className={cn(
            "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 *:data-[slot=input-group]:bg-input/20 dark:bg-popover data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-lg shadow-md ring-1 duration-100 data-[chips=true]:min-w-(--anchor-width) *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-7 *:data-[slot=input-group]:border-none *:data-[slot=input-group]:shadow-none",
            className
          )}
          {...props}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

/** Scrollable list of combobox options. @source */
function ComboboxList({
  className,
  ...props
}: Readonly<ComboboxPrimitive.List.Props>) {
  return (
    <ComboboxPrimitive.List
      data-slot="combobox-list"
      className={cn(
        "no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0",
        className
      )}
      {...props}
    />
  )
}

/** Selectable combobox option with check indicator. @source */
function ComboboxItem({
  className,
  children,
  ...props
}: Readonly<ComboboxPrimitive.Item.Props>) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground relative flex min-h-7 w-full cursor-default items-center gap-2 rounded-md px-2 py-1 text-xs/relaxed outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex items-center justify-center" />
        }
      >
        <HugeiconsIcon
          icon={Tick02Icon}
          strokeWidth={2}
          className="pointer-events-none"
        />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

/** Logical group of related combobox items. @source */
function ComboboxGroup({
  className,
  ...props
}: Readonly<ComboboxPrimitive.Group.Props>) {
  return (
    <ComboboxPrimitive.Group
      data-slot="combobox-group"
      className={cn(className)}
      {...props}
    />
  )
}

/** Label heading for a combobox group. @source */
function ComboboxLabel({
  className,
  ...props
}: Readonly<ComboboxPrimitive.GroupLabel.Props>) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot="combobox-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs", className)}
      {...props}
    />
  )
}

/** Collection wrapper for combobox option data. @source */
function ComboboxCollection({
  ...props
}: Readonly<ComboboxPrimitive.Collection.Props>) {
  return (
    <ComboboxPrimitive.Collection data-slot="combobox-collection" {...props} />
  )
}

/** Placeholder shown when no combobox options match. @source */
function ComboboxEmpty({
  className,
  ...props
}: Readonly<ComboboxPrimitive.Empty.Props>) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn(
        "text-muted-foreground hidden w-full justify-center py-2 text-center text-xs/relaxed group-data-empty/combobox-content:flex",
        className
      )}
      {...props}
    />
  )
}

/** Horizontal divider between combobox groups. @source */
function ComboboxSeparator({
  className,
  ...props
}: Readonly<ComboboxPrimitive.Separator.Props>) {
  return (
    <ComboboxPrimitive.Separator
      data-slot="combobox-separator"
      className={cn("bg-border/50 -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

/** Multi-select chip container for combobox selected values. @source */
function ComboboxChips({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
  ComboboxPrimitive.Chips.Props) {
  return (
    <ComboboxPrimitive.Chips
      data-slot="combobox-chips"
      className={cn(
        "bg-input/20 dark:bg-input/30 border-input focus-within:border-ring focus-within:ring-ring/30 has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 has-aria-invalid:border-destructive dark:has-aria-invalid:border-destructive/50 flex min-h-7 flex-wrap items-center gap-1 rounded-md border bg-clip-padding px-2 py-0.5 text-xs/relaxed transition-colors focus-within:ring-2 has-aria-invalid:ring-2 has-data-[slot=combobox-chip]:px-1",
        className
      )}
      {...props}
    />
  )
}

/**
 * Individual chip representing a selected combobox value.
 * @param showRemove - Whether to show the remove button.
 * @source
 */
function ComboboxChip({
  className,
  children,
  showRemove = true,
  ...props
}: ComboboxPrimitive.Chip.Props & {
  showRemove?: boolean
}) {
  return (
    <ComboboxPrimitive.Chip
      data-slot="combobox-chip"
      className={cn(
        "bg-muted-foreground/10 text-foreground flex h-[calc(--spacing(4.75))] w-fit items-center justify-center gap-1 rounded-[calc(var(--radius-sm)-2px)] px-1.5 text-xs/relaxed font-medium whitespace-nowrap has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0",
        className
      )}
      {...props}
    >
      {children}
      {showRemove && (
        <ComboboxPrimitive.ChipRemove
          render={<Button variant="ghost" size="icon-xs" />}
          className="-ml-1 opacity-50 hover:opacity-100"
          data-slot="combobox-chip-remove"
          aria-label="Remove"
        >
          <HugeiconsIcon
            icon={Cancel01Icon}
            strokeWidth={2}
            className="pointer-events-none"
          />
        </ComboboxPrimitive.ChipRemove>
      )}
    </ComboboxPrimitive.Chip>
  )
}

/** Text input field rendered inside a ComboboxChips container. @source */
function ComboboxChipsInput({
  className,
  ...props
}: Readonly<ComboboxPrimitive.Input.Props>) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-chip-input"
      className={cn("min-w-16 flex-1 outline-none", className)}
      {...props}
    />
  )
}

/** Creates a ref to use as a combobox anchor element. @source */
function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor
}
