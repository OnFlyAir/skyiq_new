// ItineraryViewer — Slide-over panel to view the uploaded itinerary data
// so users can cross-check info with what's entered per leg.

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TripFormData } from "@/types/trip";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FileText, Plane } from "lucide-react";

interface Props {
  tripId: string;
  children?: React.ReactNode;
}

export default function ItineraryViewer({ tripId, children }: Props) {
  const [open, setOpen] = useState(false);
  const [itinerary, setItinerary] = useState<TripFormData | null>(null);

  useEffect(() => {
    if (!open) return;
    async function load() {
      const { data } = await supabase
        .from("trips")
        .select("itinerary_details, itinerary_num")
        .eq("id", parseInt(tripId))
        .single();
      if (data?.itinerary_details) {
        setItinerary(data.itinerary_details as unknown as TripFormData);
      }
    }
    load();
  }, [open, tripId]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">View Itinerary</span>
            <span className="sm:hidden">Itinerary</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Itinerary Details
          </SheetTitle>
        </SheetHeader>
        {!itinerary ? (
          <p className="text-sm text-muted-foreground mt-4">No itinerary data found.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="text-sm space-y-1">
              {itinerary.itineraryNum && (
                <p><span className="text-muted-foreground">Trip #:</span> <span className="font-medium">{itinerary.itineraryNum}</span></p>
              )}
              {itinerary.aircraftId && (
                <p><span className="text-muted-foreground">Aircraft:</span> <span className="font-medium">{itinerary.aircraftId}</span></p>
              )}
              {itinerary.startingFuel > 0 && (
                <p><span className="text-muted-foreground">Starting Fuel:</span> <span className="font-medium">{itinerary.startingFuel.toLocaleString()} lbs</span></p>
              )}
            </div>

            {itinerary.legs.map((leg, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                  Leg {leg.legNum}: {leg.departure || "—"} → {leg.destination || "—"}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Fuel Price:</span>{" "}
                    <span className="font-medium">
                      {leg.departureFuelPrices.map((t, ti) => (
                        <span key={ti}>
                          {ti > 0 && " / "}
                          ${t.price.toFixed(2)}/gal
                          {t.min_fuel > 0 && ` (≥${t.min_fuel}g)`}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fuel Burn:</span>{" "}
                    <span className="font-medium">{leg.fuelBurn > 0 ? `${leg.fuelBurn.toLocaleString()} lbs` : "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reserve:</span>{" "}
                    <span className="font-medium">{leg.reserve.toLocaleString()} lbs</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Taxi Burn:</span>{" "}
                    <span className="font-medium">{leg.taxiFuelBurn.toLocaleString()} lbs</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Crew:</span>{" "}
                    <span className="font-medium">{leg.crewWeight}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pax:</span>{" "}
                    <span className="font-medium">{leg.passengerWeights || "0"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Baggage:</span>{" "}
                    <span className="font-medium">{leg.baggage} lbs</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Max TO:</span>{" "}
                    <span className="font-medium">{leg.maxTakeoffWeight.toLocaleString()} lbs</span>
                  </div>
                  {leg.waivedFee.amount > 0 && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Fee:</span>{" "}
                      <span className="font-medium">
                        ${leg.waivedFee.amount.toFixed(2)} — waived at {leg.waivedFee.waivedAt} gal
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
