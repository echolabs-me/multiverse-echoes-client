import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  // Legal documents are English-only until a professional translator can
  // review locale-specific wording (CC TASK 4 Part G Step 23). Non-English
  // users see a banner explaining why the body below stays in English.
  const showEnglishOnlyBanner = i18n.language !== 'en';

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="mx-auto w-full max-w-3xl px-6 pt-28 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        {showEnglishOnlyBanner && (
          <div
            className="mb-6 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-text-secondary"
            role="note"
          >
            {t('common.legalDocsEnglishOnly')}
          </div>
        )}

        <h1 className="mb-2 text-3xl font-bold text-text-primary">Privacy Policy</h1>
        <p className="mb-8 text-sm text-text-muted">Last updated: 31 March 2026</p>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-text-secondary">

          {/* 1. Introduction */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">1. Who we are</h2>
            <p>
              Multiverse Echoes is an Autonomous Life Simulation Platform operated by Echo Labs
              (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;the platform&rdquo;). We act as the
              data controller for all personal data processed through the platform.
            </p>
            <p className="mt-2">
              For privacy enquiries, contact us at{' '}
              <a href="mailto:conduct@echolabsme.com" className="text-accent hover:text-accent-hover">
                conduct@echolabsme.com
              </a>.
            </p>
          </section>

          {/* 2. Data we collect */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">2. Data we collect</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-start">
                    <th className="py-2 pe-4 font-medium text-text-primary">Category</th>
                    <th className="py-2 font-medium text-text-primary">Examples</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="py-2 pe-4 font-medium">Account Data</td><td className="py-2">Email address, display name, hashed password</td></tr>
                  <tr><td className="py-2 pe-4 font-medium">Profile Data</td><td className="py-2">Bio, avatar selection, timezone, language preference</td></tr>
                  <tr><td className="py-2 pe-4 font-medium">Persona Data</td><td className="py-2">Echo personas, what-if prompts, age at creation</td></tr>
                  <tr><td className="py-2 pe-4 font-medium">Simulation Data</td><td className="py-2">AI-generated diary entries, life events, relationships, memories</td></tr>
                  <tr><td className="py-2 pe-4 font-medium">Community Data</td><td className="py-2">Channel messages, feed posts, poll votes</td></tr>
                  <tr><td className="py-2 pe-4 font-medium">Payment Data</td><td className="py-2">Subscription tier, payment provider reference (we never store card numbers)</td></tr>
                  <tr><td className="py-2 pe-4 font-medium">Analytics Data</td><td className="py-2">Feature usage events (anonymised, opt-out available)</td></tr>
                  <tr><td className="py-2 pe-4 font-medium">Session Data</td><td className="py-2">Access tokens, refresh tokens, login timestamps</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 3. How we use your data */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">3. How and why we use your data</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-start">
                    <th className="py-2 pe-4 font-medium text-text-primary">Purpose</th>
                    <th className="py-2 pe-4 font-medium text-text-primary">Lawful Basis</th>
                    <th className="py-2 font-medium text-text-primary">Your Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="py-2 pe-4">Account creation and authentication</td><td className="py-2 pe-4">Contract</td><td className="py-2">Delete account</td></tr>
                  <tr><td className="py-2 pe-4">Echo simulation (persona processing)</td><td className="py-2 pe-4">Consent</td><td className="py-2">Delete Echo any time</td></tr>
                  <tr><td className="py-2 pe-4">Cross-user Echo interactions</td><td className="py-2 pe-4">Legitimate Interest</td><td className="py-2">Solo Mode toggle</td></tr>
                  <tr><td className="py-2 pe-4">Community messaging</td><td className="py-2 pe-4">Legitimate Interest</td><td className="py-2">Community opt-out</td></tr>
                  <tr><td className="py-2 pe-4">Content moderation and safety</td><td className="py-2 pe-4">Legitimate Interest</td><td className="py-2">&mdash;</td></tr>
                  <tr><td className="py-2 pe-4">Subscription management</td><td className="py-2 pe-4">Contract</td><td className="py-2">Cancel subscription</td></tr>
                  <tr><td className="py-2 pe-4">Analytics and service improvement</td><td className="py-2 pe-4">Legitimate Interest</td><td className="py-2">Analytics opt-out in Settings</td></tr>
                  <tr><td className="py-2 pe-4">Enforcement and legal compliance</td><td className="py-2 pe-4">Legal Obligation</td><td className="py-2">&mdash;</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. AI processing */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">4. AI processing and local inference</h2>
            <p>
              All AI inference runs locally on our own hardware via open-source models. Your persona data
              and simulation prompts are <strong>never sent to a third-party AI provider</strong>.
              This is a core privacy commitment &mdash; no personal data leaves our infrastructure for
              AI processing.
            </p>
          </section>

          {/* 5. Data retention */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">5. How long we keep your data</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-start">
                    <th className="py-2 pe-4 font-medium text-text-primary">Data</th>
                    <th className="py-2 font-medium text-text-primary">Retention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="py-2 pe-4">Account and profile data</td><td className="py-2">Until deletion + 30-day grace period</td></tr>
                  <tr><td className="py-2 pe-4">Persona and simulation data</td><td className="py-2">Until Echo or account deletion</td></tr>
                  <tr><td className="py-2 pe-4">Community messages</td><td className="py-2">1 year from posting</td></tr>
                  <tr><td className="py-2 pe-4">Session tokens</td><td className="py-2">Access: 1 hour; Refresh: 30 days; Login logs: 90 days</td></tr>
                  <tr><td className="py-2 pe-4">Analytics data</td><td className="py-2">6 months rolling</td></tr>
                  <tr><td className="py-2 pe-4">Payment records</td><td className="py-2">7 years (legal requirement)</td></tr>
                  <tr><td className="py-2 pe-4">Moderation records</td><td className="py-2">3 years</td></tr>
                  <tr><td className="py-2 pe-4">Consent records</td><td className="py-2">Duration of account + 5 years</td></tr>
                  <tr><td className="py-2 pe-4">Data export files</td><td className="py-2">72 hours after generation</td></tr>
                  <tr><td className="py-2 pe-4">Encrypted backups</td><td className="py-2">90-day rolling rotation</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. Your rights */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">6. Your rights</h2>
            <p className="mb-3">Under GDPR and applicable privacy laws, you have the right to:</p>
            <ul className="list-disc space-y-2 ps-5">
              <li>
                <strong>Access</strong> &mdash; Request a copy of all your personal data.
                Available via Settings &rarr; Privacy &rarr; Export Data.
              </li>
              <li>
                <strong>Erasure</strong> &mdash; Delete your account and all associated data.
                Available via Settings &rarr; Privacy &rarr; Delete Account. A 30-day grace period
                allows cancellation.
              </li>
              <li>
                <strong>Portability</strong> &mdash; Export your data in a structured, machine-readable
                format (JSON). Available via Settings &rarr; Privacy &rarr; Export Data.
              </li>
              <li>
                <strong>Rectification</strong> &mdash; Correct inaccurate profile or persona data
                through your account settings.
              </li>
              <li>
                <strong>Object</strong> &mdash; Opt out of cross-user interactions (Solo Mode),
                community features, or analytics in Settings &rarr; Privacy.
              </li>
              <li>
                <strong>Withdraw consent</strong> &mdash; Delete an Echo to revoke persona processing consent.
                Delete your account to revoke all consent.
              </li>
            </ul>
            <p className="mt-3">
              To exercise any right, use the in-app tools above or email{' '}
              <a href="mailto:conduct@echolabsme.com" className="text-accent hover:text-accent-hover">
                conduct@echolabsme.com
              </a>.
              We respond within 30 days.
            </p>
          </section>

          {/* 7. Data security */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">7. Data security</h2>
            <ul className="list-disc space-y-1 ps-5">
              <li>PII fields encrypted at rest with AES-256-GCM</li>
              <li>Database encrypted with BitLocker</li>
              <li>Backups encrypted with Cryptomator (AES-256)</li>
              <li>All data in transit encrypted with TLS 1.3</li>
              <li>Passwords hashed with Argon2id (never stored in plaintext)</li>
              <li>Sessions use Ed25519-signed JWTs</li>
              <li>All admin data access logged in append-only audit logs</li>
            </ul>
          </section>

          {/* 8. Third-party processors */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">8. Third-party processors</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-start">
                    <th className="py-2 pe-4 font-medium text-text-primary">Service</th>
                    <th className="py-2 pe-4 font-medium text-text-primary">Data Shared</th>
                    <th className="py-2 font-medium text-text-primary">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="py-2 pe-4">Stripe</td><td className="py-2 pe-4">Email, billing metadata</td><td className="py-2">Card payment processing</td></tr>
                  <tr><td className="py-2 pe-4">NOWPayments</td><td className="py-2 pe-4">Payment amount</td><td className="py-2">Cryptocurrency payments</td></tr>
                  <tr><td className="py-2 pe-4">Xaman</td><td className="py-2 pe-4">Wallet address</td><td className="py-2">XRP payments</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2">
              We never share your data with third parties for advertising.
              AI inference runs entirely on our own hardware.
            </p>
          </section>

          {/* 9. Children */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">9. Children&apos;s data</h2>
            <p>
              Multiverse Echoes is for users aged 16 and over. We do not knowingly collect
              personal data from anyone under 16. If we learn that a user is under 16, their
              account will be suspended pending verification.
            </p>
          </section>

          {/* 10. International transfers */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">10. International data transfers</h2>
            <p>
              Currently, all data is processed and stored on infrastructure in a single jurisdiction.
              No international data transfers occur. If this changes in future, we will update this
              policy and ensure appropriate safeguards (Standard Contractual Clauses or adequacy
              decisions) are in place.
            </p>
          </section>

          {/* 11. Breach notification */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">11. Data breach notification</h2>
            <p>
              In the event of a personal data breach that poses a risk to your rights and freedoms,
              we will notify the relevant supervisory authority within 72 hours per GDPR Article 33.
              If the breach poses a high risk to you, we will notify you directly without undue delay
              per GDPR Article 34.
            </p>
          </section>

          {/* 12. Complaints */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">12. Complaints</h2>
            <p>
              If you are unhappy with how we handle your data, please contact us first at{' '}
              <a href="mailto:conduct@echolabsme.com" className="text-accent hover:text-accent-hover">
                conduct@echolabsme.com
              </a>.
              You also have the right to lodge a complaint with your local data protection
              supervisory authority.
            </p>
          </section>

          {/* 13. Changes */}
          <section>
            <h2 className="mb-2 text-lg font-semibold text-text-primary">13. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be communicated
              via email or in-app notification at least 30 days before taking effect.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
