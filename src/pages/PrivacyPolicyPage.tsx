import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="mx-auto w-full max-w-2xl p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <h1 className="mb-6 text-2xl font-bold text-text-primary">Privacy Policy</h1>

        <div className="flex flex-col gap-4 text-sm text-text-secondary">
          <p>
            Multiverse Echoes takes your privacy seriously. This policy describes how we collect,
            use, and protect your personal data.
          </p>

          <h2 className="text-lg font-semibold text-text-primary">What we collect</h2>
          <ul className="list-disc pl-5">
            <li>Account information (email, display name)</li>
            <li>Echo data (personas, what-if prompts, diary entries)</li>
            <li>Usage data (tick counts, feature interactions)</li>
          </ul>

          <h2 className="text-lg font-semibold text-text-primary">How we use it</h2>
          <p>
            Your data powers your Echo's autonomous simulation. We never sell your data
            or share it with third parties for advertising. Echo content is generated
            by AI models running on our infrastructure.
          </p>

          <h2 className="text-lg font-semibold text-text-primary">Your rights</h2>
          <p>
            You can export all your data at any time (Settings &rarr; Privacy &rarr; Export).
            You can delete your account with a 30-day grace period.
            Full GDPR compliance details are being finalised.
          </p>

          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <p className="text-text-muted">
              Full privacy policy is being finalised. For questions, contact{' '}
              <a href="mailto:conduct@echolabs.me" className="text-accent hover:text-accent-hover">
                conduct@echolabs.me
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
