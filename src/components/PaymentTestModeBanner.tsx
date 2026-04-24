import { isTestMode } from '@/lib/stripe';

export function PaymentTestModeBanner() {
  // Hidden from end users
  return null;
  if (!isTestMode()) return null;
  return (
    <div className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs text-amber-900">
      Payments are in <strong>test mode</strong>. Use card <code className="font-mono">4242 4242 4242 4242</code>,
      any future expiry, any CVC.
    </div>
  );
}
