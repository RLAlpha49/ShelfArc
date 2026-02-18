import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges class names with Tailwind conflict resolution.
 * @param inputs - Class values to merge.
 * @returns The merged class string.
 * @source
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
