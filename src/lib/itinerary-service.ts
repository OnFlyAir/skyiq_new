// Service layer for calling the parse-itinerary Edge Function
// and converting parsed results into form-ready leg data.

import type { ParsedTrip, LegFormData } from "../types/trip";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Extract text from a PDF file using pdf.js on the client side.
 * This avoids needing a PDF library in the Edge Function.
 */
export async function extractPdfText(file: File): Promise<string> {
  // Dynamic import of pdf.js (should be installed as a dependency)
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str ?? "")
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

/**
 * Call the parse-itinerary Edge Function with extracted PDF text.
 */
export async function parseItinerary(
  pdfText: string,
  model: string = "gpt-4o-mini",
): Promise<ParsedTrip> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/parse-itinerary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ text: pdfText, model }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Parse failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Convert a parsed trip into form-ready leg data, applying aircraft defaults.
 */
export function parsedLegsToFormData(
  parsedTrip: ParsedTrip,
  aircraftDefaults: {
    defaultPaxWeight: number;
    defaultBaggageWithPax: number;
    defaultBaggageNoPax: number;
    defaultPicWeight: number;
    defaultSicWeight: number;
    defaultCabinWeight: number;
    preferredReserve: number;
    taxiFuelBurn: number;
    maxTakeoffWeight: number;
    maxLandingWeight: number;
    maxRampWeight: number;
    maxFuelCapacity: number;
  },
): LegFormData[] {
  return parsedTrip.legs.map((leg) => {
    // Replace -1 (unknown) passenger weights with aircraft default
    const paxWeights = leg.passengers
      .map((w) => (w === -1 ? aircraftDefaults.defaultPaxWeight : w));

    const hasPax = paxWeights.length > 0 && paxWeights.some((w) => w > 0);

    // Find waived fee at departure airport
    const waivedFee = leg.fees.find(
      (f) => f.is_waivable && f.amount > 0 && f.waived_at > 0,
    );

    return {
      legNum: leg.leg_num,
      departure: leg.departure,
      destination: leg.destination,
      departureFuelPrices: leg.departure_fuel_price.length > 0
        ? leg.departure_fuel_price
        : [{ min_fuel: 0, price: 0 }],
      waivedFee: {
        name: waivedFee?.name ?? "",
        amount: waivedFee?.amount ?? 0,
        isWaivable: waivedFee?.is_waivable ?? false,
        waivedAt: waivedFee?.waived_at ?? 0,
        airport: waivedFee?.airport ?? leg.departure,
      },
      passengerWeights: paxWeights.length > 0 ? paxWeights.join(", ") : "0",
      baggage: hasPax
        ? aircraftDefaults.defaultBaggageWithPax
        : aircraftDefaults.defaultBaggageNoPax,
      crewWeight: `${aircraftDefaults.defaultPicWeight}, ${aircraftDefaults.defaultSicWeight}, ${aircraftDefaults.defaultCabinWeight}`,
      fuelBurn: leg.fuel_burn,
      reserve: aircraftDefaults.preferredReserve,
      taxiFuelBurn: aircraftDefaults.taxiFuelBurn,
      maxTakeoffWeight: aircraftDefaults.maxTakeoffWeight,
      maxLandingWeight: aircraftDefaults.maxLandingWeight,
      maxRampWeight: aircraftDefaults.maxRampWeight,
      isConfirmed: false,
    };
  });
}
