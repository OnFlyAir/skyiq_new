import { Link } from 'react-router-dom';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="max-w-2xl mx-auto">
        <Link to="/login" className="inline-flex items-center gap-2 mb-8">
          <img src={skyiqLogo} alt="SkyIQ" className="w-10 h-10 object-contain" />
          <span className="text-lg font-semibold text-foreground">SkyIQ</span>
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: September 2026</p>

        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">1. The service</h2>
            <p>
              SkyIQ provides fuel planning and trip optimization tools for aircraft operators,
              including itinerary parsing, fuel-burn analysis, tankering optimization, and savings
              reporting. SkyIQ is a planning aid only. The pilot in command remains solely
              responsible for all flight planning decisions, fuel loads, weight and balance, and
              compliance with applicable regulations. SkyIQ outputs must be verified against
              your aircraft's approved flight manual and current operational data before flight.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">2. Accounts</h2>
            <p>
              You must provide accurate account information and keep your credentials
              confidential. You are responsible for activity under your account. One account per
              operator or company unless we agree otherwise in writing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">3. Trial and billing</h2>
            <p>
              New accounts begin with a 30-day trial for a one-time charge of $1.00. At the end of
              the trial, your paid subscription starts automatically on the card you provided,
              priced per active aircraft in your fleet and billed on your selected cycle (every 4
              weeks, or annually at a discount). Prices are shown before you confirm activation.
            </p>
            <p className="mt-2">
              You can cancel at any time from your subscription page. Cancellation takes effect at
              the end of your current billing period — you keep access until then. We do not
              provide refunds for partial billing periods except where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">4. Your data</h2>
            <p>
              You retain ownership of the itineraries, aircraft data, and client information you
              upload. You grant us a limited license to process that data solely to operate the
              service for you. We do not sell your data and do not use your data to train AI
              models. Our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and{' '}
              <Link to="/security" className="text-primary hover:underline">Security page</Link> describe how data
              is stored and protected.
            </p>
            <p className="mt-2">
              You represent that you have the right to upload any third-party information (such as
              passenger or client details in itineraries) and that doing so does not violate any
              agreement or law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">5. Acceptable use</h2>
            <p>
              You may not misuse the service, attempt to access other customers' data, reverse
              engineer the service, or use it for any unlawful purpose. We may suspend accounts
              that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">6. Disclaimers and liability</h2>
            <p>
              The service is provided "as is" without warranties of any kind. SkyIQ does not
              warrant that optimization results are error-free or suitable for any specific
              flight. To the maximum extent permitted by law, SkyIQ is not liable for indirect,
              incidental, or consequential damages, including flight delays, fuel costs, or
              operational losses, and our total liability is limited to the amounts you paid us in
              the 12 months before the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">7. Changes</h2>
            <p>
              We may update these terms from time to time. Material changes will be announced by
              email or in-app notice before they take effect. Continued use after the effective
              date constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">8. Contact</h2>
            <p>
              Questions about these terms:{' '}
              <a href="mailto:info@skyiq.net" className="text-primary hover:underline">info@skyiq.net</a>
            </p>
          </section>
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
