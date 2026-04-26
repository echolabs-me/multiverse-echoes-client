# Multiverse Echoes Client

The open-source client for **Multiverse Echoes**, an Autonomous Life Simulation Platform (ALSP). Create AI Echo agents of yourself with "what-if" prompts. Echoes live autonomously in themed Shards. You observe, nudge, and converse — never control.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- npm (included with Node.js)
- A Multiverse Echoes account (free tier is sufficient)

## Quickstart

```bash
# Clone the repository
git clone https://github.com/echolabs-me/multiverse-echoes-client.git
cd multiverse-echoes-client

# Install dependencies
npm install

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
| `npm run lint` | ESLint + Prettier check |
| `npm run test` | Run Vitest unit tests |
| `npm run format` | Auto-format with Prettier |

## Tech Stack

- **React 19** with TypeScript 5.9 (strict mode)
- **Vite 6** — fast bundler and dev server
- **Tailwind CSS v4** — utility-first styling with design tokens
- **Zustand** — lightweight state management
- **react-i18next** — internationalisation (English at launch)
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
