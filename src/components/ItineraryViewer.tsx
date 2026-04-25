// ItineraryViewer — Floating PDF viewer panel that stays visible while scrolling.
// Shows the uploaded itinerary PDF so users can cross-reference while editing legs.

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, X, Minimize2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import PdfScrollViewer from "@/components/PdfScrollViewer";

interface Props {
  tripId: string;
  children?: React.ReactNode;
}

export default function ItineraryViewer({ tripId, children }: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadPdf();

    return () => {
      // Clean up blob URL on close
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [open, tripId]);

  async function loadPdf() {
    setLoading(true);

    // First check onfly_data for a stored PDF path
    const { data: onflyRow } = await supabase
      .from("onfly_data")
      .select("pdf_storage_path")
      .eq("trip_id", parseInt(tripId))
      .limit(1);

    if (onflyRow && onflyRow.length > 0 && (onflyRow[0] as any).pdf_storage_path) {
      const path = (onflyRow[0] as any).pdf_storage_path as string;
      const { data: blob, error } = await supabase.storage
        .from("itinerary-pdfs")
        .download(path);

      if (!error && blob) {
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setLoading(false);
        return;
      }
    }

    // Fallback: check if there's a PDF in itinerary-pdfs for this user
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: files } = await supabase.storage
        .from("itinerary-pdfs")
        .list(user.id, { limit: 20, sortBy: { column: "created_at", order: "desc" } });

      if (files && files.length > 0) {
        // Find the most recent file
        const latest = files[0];
        const { data: blob, error } = await supabase.storage
          .from("itinerary-pdfs")
          .download(`${user.id}/${latest.name}`);

        if (!error && blob) {
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
        }
      }
    }

    setLoading(false);
  }

  if (!open) {
    if (isMobile) {
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="shrink-0 border-primary/30 bg-card/95 text-primary backdrop-blur"
        >
          <FileText className="h-4 w-4" />
          Check Itinerary
        </Button>
      );
    }

    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
      >
        <FileText className="h-4 w-4" />
        Check Itinerary
      </button>
    );
  }

  return (
    <>
      {/* Floating PDF panel — fixed position, follows scroll */}
      <div
        className={`fixed z-50 transition-all duration-300 ease-in-out ${
          minimized
            ? "bottom-4 right-4 w-12 h-12"
            : isMobile
              ? "inset-2 top-14"
              : "top-16 right-4 w-[560px] h-[calc(100vh-5rem)]"
        } flex flex-col rounded-xl border bg-card shadow-2xl overflow-hidden`}
      >
        {minimized ? (
          <button
            onClick={() => setMinimized(false)}
            className="w-full h-full flex items-center justify-center bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
          >
            <FileText className="h-5 w-5" />
          </button>
        ) : (
          <>
            {/* Header bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-secondary/50 shrink-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-primary" />
                Itinerary PDF
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMinimized(true)}>
                  <Minimize2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setOpen(false);
                    if (pdfUrl) {
                      URL.revokeObjectURL(pdfUrl);
                      setPdfUrl(null);
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* PDF content */}
            <div className="flex-1 overflow-auto -webkit-overflow-scrolling-touch">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-muted-foreground">
                    <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs">Loading PDF...</p>
                  </div>
                </div>
              ) : pdfUrl ? (
                isMobile ? (
                  <PdfScrollViewer src={pdfUrl} title="Itinerary PDF" />
                ) : (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full border-0"
                    title="Itinerary PDF"
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full p-6 text-center">
                  <div>
                    <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-muted-foreground">No PDF available</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload an itinerary PDF above to view it here
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
