import { Link } from 'react-router-dom';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:py-16">
      <div className="max-w-2xl mx-auto">
        <Link to="/login" className="inline-flex items-center gap-2 mb-8">
          <img src={skyiqLogo} alt="SkyIQ" className="w-10 h-10 object-contain" />
          <span className="text-lg font-semibold text-foreground">SkyIQ</span>
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: September 2026</p>

        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">What we collect</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-foreground">Account data</strong> — your name, email, and company.</li>
              <li><strong className="text-foreground">Operational data</strong> — aircraft details (tail numbers, weights, fuel burns) and trip itineraries you upload, which may include passenger or client names and contact details.</li>
              <li><strong className="text-foreground">Billing data</strong> — payment is processed by Stripe; we never see or store your full card number.</li>
              <li><strong className="text-foreground">Usage analytics</strong> — only if you accept analytics cookies, we collect product-usage events (via PostHog) to improve the app. Analytics are off until you opt in.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">How we use it</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To operate the fuel-planning service: parse itineraries, run optimizations, and generate summaries and emails you request.</li>
              <li>To bill your subscription and send service emails (trial reminders, receipts, plan changes).</li>
              <li>To secure the service, prevent abuse, and audit administrative actions.</li>
            </ul>
            <p className="mt-2">
              We do not sell your data. We do not use your itineraries or operational data to
              train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Where data lives</h2>
            <p>
              Data is hosted on Supabase running on AWS (US region) with encryption in transit and
              at rest, row-level tenant isolation, and immutable audit logging of administrative
              access. See our <Link to="/security" className="text-primary hover:underline">Security page</Link> for
              details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Who we share it with</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-foreground">Stripe</strong> — payment processing.</li>
              <li><strong className="text-foreground">Email delivery provider</strong> — to send trip summaries and account emails you trigger.</li>
              <li><strong className="text-foreground">PostHog</strong> — product analytics, only after your cookie consent.</li>
            </ul>
            <p className="mt-2">
              We do not share data with anyone else except as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Your choices</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Decline analytics cookies — core features work without them.</li>
              <li>Control billing emails from your profile (all, critical only, or none).</li>
              <li>Request a copy or deletion of your data at any time by emailing us. Deleting your account removes your profile, trips, and uploaded itineraries.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Retention</h2>
            <p>
              We keep your data while your account is active. After account deletion, operational
              data is removed; minimal billing records are retained as required for tax and
              accounting purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Contact</h2>
            <p>
              Privacy questions or data requests:{' '}
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
