# Multiverse Echoes Client

The open-source client for **Multiverse Echoes**, an Autonomous Life Simulation Platform (ALSP). Create AI Echo agents of yourself with "what-if" prompts. Echoes live autonomously in themed Shards. You observe, nudge, and converse — never control.

## Prerequisites

- [Node.js](https://nodejs.org/) 22.13 or later on the 22 line, 24, or 26 and later: the versions every locked package's `engines` allows together (eslint and jsdom need `^22.13.0` on the 22 line; vitest 5 rules out 23 and 25)
- npm 11.18.0, the version the lockfile and CI use (`packageManager` in `package.json`). On Node 22 or 24, run `corepack enable npm` once and Corepack runs that version in this folder; Node 25 and later ship no Corepack, so on Node 26 or later run `npm install -g npm@11.18.0`
- A Multiverse Echoes account (free tier is sufficient)

## Quickstart

```bash
# Clone the repository
git clone https://github.com/echolabs-me/multiverse-echoes-client.git
cd multiverse-echoes-client

# Install dependencies (from the committed lockfile)
npm ci

# Start the development server
npm run dev
```

The client opens at `http://localhost:1420`.

### Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_API_BASE_URL=https://api.echolabsme.com
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint |
| `npm run test` | Run Vitest unit tests |
| `npm run format` | Auto-format with Prettier |
| `npm run format:check` | Check formatting with Prettier (CI runs this) |

## Tech Stack

- **React 19** with TypeScript 6.0 (strict mode)
- **Vite 8** — fast bundler and dev server
- **Tailwind CSS v4** — utility-first styling with design tokens
- **Zustand** — lightweight state management
- **react-i18next** — internationalisation (21 locales, `src/locales/`)
- **Lucide React** — icon library

## Project Structure

```
src/
  components/       # Shared UI components (Button, Card, Modal, etc.)
  pages/            # Route-level page components
  stores/           # Zustand state stores
  lib/
    api/            # Typed API client + endpoint functions
    ws/             # WebSocket client with auto-reconnect
    extensions.ts   # Extension slot registry (for mods)
    exportTemplates.ts  # Export template registry (for mods)
  styles/
    tokens.css      # CSS design tokens (theme layer)
    global.css      # Global styles + Tailwind theme mapping
  types/
    api.ts          # TypeScript types matching engine API responses
  locales/
    en.json         # English translations
```

## Modding

The client supports custom themes, export templates, and extension panels. See [MODDING.md](MODDING.md) for the full guide.

## API Documentation

API reference and developer guides are available at the [Developer Portal](https://developers.echolabsme.com).

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

All contributors must sign the [Contributor License Agreement (CLA)](https://cla-assistant.io/echolabs-me/multiverse-echoes-client) before their PR can be merged.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)

## Links

- [Developer Portal](https://developers.echolabsme.com)
- [API Terms of Use](https://developers.echolabsme.com/legal/api-terms)
- [Echolabs](https://echolabsme.com)
