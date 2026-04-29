// One-shot probe — simulate the ?lng= middleware against both
// `echolabsme.com` and the internal `echolabsme.pages.dev` origin, print
// the Location header in a curl-like format.
//
// Why: wrangler is not installed locally, so we cannot run `wrangler pages
// dev` + real curl. This probe calls the middleware's `onRequest` directly
// and asserts the Location header shape — functionally equivalent to the
// `curl -sI -H 'Host: echolabsme.pages.dev'` check against a preview deploy.

import { onRequest } from '../functions/_middleware.ts';

async function probe(label, url) {
  const res = await onRequest({
    request: new Request(url),
    next: async () => new Response('next'),
  });
  const loc = res.headers.get('Location') ?? '';
  console.log(`[${label}]  GET ${url}`);
  console.log(`            -> ${res.status}  Location: ${loc}`);
  console.log(`            pages.dev in Location? ${loc.includes('pages.dev')}`);
  console.log(`            echolabsme.com in Location? ${loc.includes('echolabsme.com')}`);
  console.log('');
}

await probe('canonical host', 'https://echolabsme.com/home?lng=ja');
await probe('pages.dev host', 'https://echolabsme.pages.dev/home?lng=ja');
await probe('canonical root', 'https://echolabsme.com/?lng=es');
await probe('pages.dev root', 'https://echolabsme.pages.dev/?lng=es');
await probe('pages.dev query params', 'https://echolabsme.pages.dev/home?lng=fr&ref=x');
