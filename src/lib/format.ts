// Centralized money formatting — always 2 decimals.

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format a dollar amount (in dollars) as e.g. "$1,234.50". */
export function formatCurrency(amount: number | null | undefined): string {
  return USD.format(Number(amount) || 0);
}

/** Format a cent amount (e.g. Stripe `monthly_amount_cents`) as e.g. "$12.34". */
export function formatCurrencyCents(cents: number | null | undefined): string {
  return formatCurrency((Number(cents) || 0) / 100);
}
