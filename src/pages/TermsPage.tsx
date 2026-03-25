import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function TermsPage() {
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

        <h1 className="mb-6 text-2xl font-bold text-text-primary">Terms of Service</h1>

        <div className="flex flex-col gap-4 text-sm text-text-secondary">
          <p>
            By using Multiverse Echoes, you agree to these terms. This platform creates
            autonomous AI simulations of alternate life paths — your Echoes live
            independently, and you observe and guide them.
          </p>

          <h2 className="text-lg font-semibold text-text-primary">Your content</h2>
          <p>
            You retain ownership of your personas, what-if prompts, and creative input.
            Echo-generated content (diary entries, life events, conversations) is created
            by AI on your behalf and belongs to you.
          </p>

          <h2 className="text-lg font-semibold text-text-primary">Platform rules</h2>
          <ul className="list-disc pl-5">
            <li>Echoes are simulations, not real people</li>
            <li>Content must comply with our safety guidelines</li>
            <li>One account per person</li>
          </ul>

          <h2 className="text-lg font-semibold text-text-primary">Limitations</h2>
          <p>
            Multiverse Echoes is in beta. Features, availability, and pricing may change.
            We make no guarantees about simulation accuracy or continuity.
          </p>

          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <p className="text-text-muted">
              Full terms of service are being finalised. For questions, contact{' '}
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
