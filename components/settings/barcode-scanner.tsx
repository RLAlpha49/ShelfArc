"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useLibrary } from "@/lib/hooks/use-library"
import { searchBooks } from "@/lib/api/endpoints"
import { isValidIsbn } from "@/lib/books/isbn"
import { toast } from "sonner"

/* ─── Types ─────────────────────────────────────────────── */

/** Global BarcodeDetector type declaration for the Web API. */
declare global {
  interface BarcodeDetectorOptions {
    formats: string[]
  }
  class BarcodeDetector {
    constructor(options?: BarcodeDetectorOptions)
    detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>
    static getSupportedFormats(): Promise<string[]>
  }
}

interface ScannedIsbn {
  isbn: string
  title: string | null
  status: "pending" | "found" | "not-found" | "added" | "error"
}

type ScannerPhase = "idle" | "scanning" | "batch"

/* ─── Component ─────────────────────────────────────────── */

export function BarcodeScanner() {
  const { addBookFromSearchResult, fetchSeries } = useLibrary()

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<BarcodeDetector | null>(null)
  const scanningRef = useRef(false)

  const [phase, setPhase] = useState<ScannerPhase>("idle")
  const [isSupported] = useState<boolean>(() => "BarcodeDetector" in globalThis)
  const [manualIsbn, setManualIsbn] = useState("")
  const [scannedItems, setScannedItems] = useState<ScannedIsbn[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [batchMode, setBatchMode] = useState(false)

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
  }, [])

  const addIsbn = useCallback(
    (isbn: string) => {
      const exists = scannedItems.some((item) => item.isbn === isbn)
      if (exists) {
        toast.info(`ISBN ${isbn} already in the list.`)
        return
      }
      setScannedItems((prev) => [
        ...prev,
        { isbn, title: null, status: "pending" }
      ])
    },
    [scannedItems]
  )

  const scanFrameRef = useRef<(() => Promise<void>) | undefined>(undefined)

  const scanFrame = useCallback(async () => {
    if (!scanningRef.current || !videoRef.current || !detectorRef.current) {
      return
    }

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current)
      for (const barcode of barcodes) {
        const value = barcode.rawValue.trim()
        if (isValidIsbn(value)) {
          addIsbn(value)
          if (!batchMode) {
            stopCamera()
            setPhase("batch")
            return
          }
          toast.success(`Scanned: ${value}`)
        }
      }
    } catch {
      // Ignore detection errors
    }

    if (scanningRef.current) {
      requestAnimationFrame(() => {
        void scanFrameRef.current?.()
      })
    }
  }, [addIsbn, batchMode, stopCamera])

  useEffect(() => {
    scanFrameRef.current = scanFrame
  }, [scanFrame])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      detectorRef.current = new BarcodeDetector({
        formats: ["ean_13", "ean_8"]
      })
      scanningRef.current = true
      setPhase("scanning")
      void scanFrame()
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera access was denied. Please allow camera access in your browser settings."
          : "Could not access camera. Please check permissions."
      setCameraError(message)
    }
  }, [scanFrame])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  const handleManualAdd = useCallback(() => {
    const isbn = manualIsbn.trim().replaceAll("-", "")
    if (!isbn) return

    if (!isValidIsbn(isbn)) {
      toast.error(
        "Invalid ISBN format. Please enter a valid ISBN-10 or ISBN-13."
      )
      return
    }

    addIsbn(isbn)
    setManualIsbn("")
    if (phase === "idle") setPhase("batch")
  }, [manualIsbn, addIsbn, phase])

  const lookupAndAdd = useCallback(
    async (item: ScannedIsbn) => {
      setScannedItems((prev) =>
        prev.map((i) =>
          i.isbn === item.isbn ? { ...i, status: "pending" } : i
        )
      )

      try {
        const results = await searchBooks({
          q: item.isbn,
          source: "google_books",
          limit: 3
        })
        const books = results.data ?? []
        if (books.length === 0) {
          setScannedItems((prev) =>
            prev.map((i) =>
              i.isbn === item.isbn ? { ...i, status: "not-found" } : i
            )
          )
          return
        }

        const book = books[0]
        setScannedItems((prev) =>
          prev.map((i) =>
            i.isbn === item.isbn
              ? { ...i, title: book.title, status: "found" }
              : i
          )
        )

        await addBookFromSearchResult(book)
        setScannedItems((prev) =>
          prev.map((i) =>
            i.isbn === item.isbn ? { ...i, status: "added" } : i
          )
        )
      } catch {
        setScannedItems((prev) =>
          prev.map((i) =>
            i.isbn === item.isbn ? { ...i, status: "error" } : i
          )
        )
      }
    },
    [addBookFromSearchResult]
  )

  const handleAddAll = useCallback(async () => {
    const pending = scannedItems.filter((i) => i.status === "pending")
    if (pending.length === 0) return

    setIsProcessing(true)
    for (const item of pending) {
      await lookupAndAdd(item)
    }
    setIsProcessing(false)
    await fetchSeries()
    toast.success("Barcode import complete!")
  }, [scannedItems, lookupAndAdd, fetchSeries])

  const removeItem = useCallback((isbn: string) => {
    setScannedItems((prev) => prev.filter((i) => i.isbn !== isbn))
  }, [])

  const reset = useCallback(() => {
    stopCamera()
    setPhase("idle")
    setScannedItems([])
    setCameraError(null)
  }, [stopCamera])

  const statusConfig: Record<
    ScannedIsbn["status"],
    { label: string; color: string }
  > = {
    pending: {
      label: "Ready",
      color: "bg-muted text-muted-foreground"
    },
    found: {
      label: "Found",
      color: "bg-blue-500/10 text-blue-700 dark:text-blue-400"
    },
    "not-found": {
      label: "Not found",
      color: "bg-muted text-muted-foreground"
    },
    added: {
      label: "Added",
      color: "bg-green-500/10 text-green-700 dark:text-green-400"
    },
    error: {
      label: "Error",
      color: "bg-red-500/10 text-red-700 dark:text-red-400"
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Scan ISBN barcodes using your device&apos;s camera, or enter ISBNs
        manually. Scanned books will be looked up and added to your library.
      </p>

      {/* Camera / Scanner section */}
      {phase === "scanning" && (
        <div className="animate-fade-in space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              playsInline
              muted
            />
            {/* Scan area overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="border-copper/60 h-24 w-48 rounded-lg border-2 shadow-[0_0_20px_var(--warm-glow)]" />
            </div>
            <div className="absolute top-3 right-3 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-xl"
                onClick={() => setBatchMode((v) => !v)}
              >
                {batchMode ? "Single mode" : "Batch mode"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  stopCamera()
                  setPhase(scannedItems.length > 0 ? "batch" : "idle")
                }}
              >
                Stop
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-center text-xs">
            Point your camera at an ISBN barcode.{" "}
            {batchMode ? "Batch mode: keep scanning to add multiple." : ""}
          </p>
        </div>
      )}

      {/* Manual ISBN input */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="manual-isbn" className="sr-only">
            Manual ISBN entry
          </Label>
          <Input
            id="manual-isbn"
            value={manualIsbn}
            onChange={(e) => setManualIsbn(e.target.value)}
            placeholder="Enter ISBN manually (e.g. 9781234567890)"
            className="rounded-xl"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleManualAdd()
            }}
          />
        </div>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={handleManualAdd}
        >
          Add
        </Button>
      </div>

      {/* Start camera button */}
      {phase !== "scanning" && isSupported !== false && (
        <div className="flex flex-wrap gap-3">
          {isSupported && (
            <Button className="rounded-xl" onClick={startCamera}>
              📷 Scan Barcode
            </Button>
          )}
          {isSupported === null && (
            <Button className="rounded-xl" disabled>
              Checking camera support…
            </Button>
          )}
        </div>
      )}

      {isSupported === false && (
        <div className="bg-muted/50 rounded-xl border p-4">
          <p className="text-muted-foreground text-sm">
            Your browser doesn&apos;t support the BarcodeDetector API. Use the
            manual ISBN input above, or try Chrome/Edge on a mobile device for
            camera scanning.
          </p>
        </div>
      )}

      {cameraError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-400">
            {cameraError}
          </p>
        </div>
      )}

      {/* Scanned items list */}
      {scannedItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {scannedItems.length} ISBN{scannedItems.length === 1 ? "" : "s"}{" "}
              scanned
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-xs"
              onClick={reset}
            >
              Clear all
            </Button>
          </div>

          <ScrollArea className="max-h-60">
            <div className="space-y-2">
              {scannedItems.map((item) => {
                const config = statusConfig[item.status]
                return (
                  <div
                    key={item.isbn}
                    className="flex items-center gap-3 rounded-xl border px-3 py-2"
                  >
                    <code className="text-sm tabular-nums">{item.isbn}</code>
                    {item.title && (
                      <span className="text-muted-foreground truncate text-xs">
                        {item.title}
                      </span>
                    )}
                    <div className="flex-1" />
                    <Badge className={`shrink-0 text-[10px] ${config.color}`}>
                      {config.label}
                    </Badge>
                    {item.status === "pending" && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground text-xs"
                        onClick={() => removeItem(item.isbn)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>

          <div className="flex gap-3">
            {phase === "scanning" && (
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  stopCamera()
                  setPhase("batch")
                }}
              >
                Done Scanning
              </Button>
            )}
            <Button
              className="rounded-xl px-6"
              onClick={handleAddAll}
              disabled={
                isProcessing ||
                scannedItems.filter((i) => i.status === "pending").length === 0
              }
            >
              {isProcessing
                ? "Processing…"
                : `Search & Add (${scannedItems.filter((i) => i.status === "pending").length})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
