# Contributing to Multiverse Echoes Client

Thank you for your interest in contributing! This guide covers the development workflow and requirements.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/multiverse-echoes-client.git
   cd multiverse-echoes-client
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

1. Make your changes on the feature branch.
2. Run the quality gates before committing:
   ```bash
   npm run typecheck    # TypeScript — zero errors required
   npm run lint         # ESLint + jsx-a11y — zero errors, zero warnings
   npm run test         # Vitest — all tests must pass
   ```
3. Commit with a descriptive message following [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add relationship visualisation component
   fix: correct modal focus trap on Safari
   ```
4. Push to your fork and open a Pull Request against `main`.

## Code Style

- **TypeScript strict mode** — all code must pass `tsc -b` with zero errors.
- **ESLint** — the config includes `eslint-plugin-jsx-a11y` and `react-hooks` rules. Zero warnings.
- **Prettier** — formatting is enforced. Run `npm run format` to auto-fix.
- **No hardcoded strings** — all user-visible text goes in `src/locales/en.json` via `t('key')`.
- **No hardcoded colours** — use CSS token classes (`bg-canvas`, `text-accent`, etc.).
- **Accessible by default** — interactive elements need ARIA attributes, keyboard support, and visible focus indicators.

## Testing

- Unit tests use **Vitest** + **React Testing Library** with `happy-dom`.
- Tests live in `tests/` (mirroring `src/` structure).
- New components should have at least basic render + interaction tests.
- Run tests: `npm run test`

## Accessibility Requirements

All contributions must meet **WCAG 2.1 AA** standards:

- Colour contrast: 4.5:1 (normal text), 3:1 (large text)
- Keyboard navigation: all interactive elements reachable via Tab/arrows
- Screen reader: all elements correctly announced
- Focus management: modals trap focus, return focus on close
- Reduced motion: respect `prefers-reduced-motion`

## Contributor License Agreement (CLA)

All contributors must sign the CLA before their first PR can be merged. The CLA bot will comment on your PR with instructions when you open it.

The CLA ensures that:
- You have the right to submit the contribution.
- Echolabs can distribute the contribution under the MIT license.
- You retain copyright of your contribution.

## Pull Request Checklist

Before submitting your PR, verify:

- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors, zero warnings
- [ ] `npm run test` — all tests pass
- [ ] Accessibility: interactive elements have ARIA attributes and keyboard support
- [ ] i18n: no hardcoded user-facing strings
- [ ] Theme: no hardcoded colour values
- [ ] CLA signed

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) when filing issues.

## Feature Requests

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) for suggestions.

## Questions?

Open a [Discussion](https://github.com/echolabs-me/multiverse-echoes-client/discussions) or ask in the `#feedback` channel within the app.
