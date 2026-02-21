"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet"
import { isValidIsbn } from "@/lib/books/isbn"

interface IsbnScannerProps {
  /** Called when a barcode is successfully scanned or manually entered. */
  readonly onScan: (isbn: string) => void
  /** Whether the trigger button should be disabled (e.g., dialog busy). */
  readonly disabled?: boolean
}

/**
 * Compact barcode scanner button for use next to an ISBN input field.
 * Opens a sheet with camera access to scan EAN-13/EAN-8 barcodes.
 * Falls back to manual ISBN entry.
 */
export function IsbnScannerButton({
  onScan,
  disabled = false
}: IsbnScannerProps) {
  const [open, setOpen] = useState(false)
  const [manualIsbn, setManualIsbn] = useState("")
  const [scanError, setScanError] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [supported] = useState<boolean>(() => "BarcodeDetector" in globalThis)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const scannedRef = useRef(false)

  const stopCamera = useCallback(() => {
    setIsScanning(false)
    cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const handleScan = useCallback(
    (isbn: string) => {
      stopCamera()
      setOpen(false)
      setManualIsbn("")
      setScanError("")
      onScan(isbn)
    },
    [stopCamera, onScan]
  )

  const startCamera = useCallback(async () => {
    if (!supported) return
    scannedRef.current = false
    setScanError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsScanning(true)

      detectorRef.current ??= new BarcodeDetector({
        formats: ["ean_13", "ean_8"]
      })

      const tick = async () => {
        if (scannedRef.current || !videoRef.current || !detectorRef.current)
          return
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current)
          for (const bc of barcodes) {
            const raw = bc.rawValue?.trim() ?? ""
            if (isValidIsbn(raw) && !scannedRef.current) {
              scannedRef.current = true
              handleScan(raw)
              return
            }
          }
        } catch {
          // Detection frame error — continue
        }
        animFrameRef.current = requestAnimationFrame(() => void tick())
      }
      animFrameRef.current = requestAnimationFrame(() => void tick())
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was denied. Check your browser settings."
          : "Could not access camera. Check permissions."
      setScanError(message)
    }
  }, [supported, handleScan])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (!nextOpen) {
        stopCamera()
      } else if (supported) {
        void startCamera()
      }
    },
    [stopCamera, startCamera, supported]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const handleManualSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const clean = manualIsbn.trim().replaceAll("-", "")
    if (!isValidIsbn(clean)) {
      setScanError("Enter a valid 10 or 13 digit ISBN.")
      return
    }
    handleScan(clean)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        disabled={disabled}
        className="border-input hover:bg-accent inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-50"
        aria-label="Scan barcode"
        title="Scan ISBN barcode"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <line x1="7" x2="7" y1="8" y2="16" />
          <line x1="10" x2="10" y1="8" y2="16" />
          <line x1="13" x2="13" y1="8" y2="16" />
          <line x1="16" x2="16" y1="8" y2="16" />
        </svg>
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Scan ISBN Barcode</SheetTitle>
            <SheetDescription>
              Point your camera at the barcode on the back of the book.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 p-4">
            {/* Camera feed */}
            {supported && (
              <div className="relative mx-auto aspect-video max-w-sm overflow-hidden rounded-xl bg-black">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  aria-label="Camera feed for barcode scanning"
                />
                {isScanning && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="border-primary/70 h-20 w-48 rounded-sm border-2" />
                  </div>
                )}
              </div>
            )}

            {!supported && (
              <p className="text-muted-foreground text-center text-sm">
                Barcode scanning is not supported in this browser. Use the
                manual entry below.
              </p>
            )}

            {scanError && (
              <p className="text-destructive text-center text-sm" role="alert">
                {scanError}
              </p>
            )}

            {/* Manual entry fallback */}
            <div className="border-t pt-4">
              <form onSubmit={handleManualSubmit} className="space-y-2">
                <Label htmlFor="manual-isbn">Or enter ISBN manually</Label>
                <div className="flex gap-2">
                  <Input
                    id="manual-isbn"
                    placeholder="978-..."
                    value={manualIsbn}
                    onChange={(e) => {
                      setManualIsbn(e.target.value)
                      setScanError("")
                    }}
                  />
                  <Button type="submit" variant="outline" className="shrink-0">
                    Use
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
