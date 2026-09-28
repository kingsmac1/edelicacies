# Edelicacies

Online food store website for Edelicacies (Uyo) — React + Vite + TypeScript +
Tailwind CSS, backed by Supabase. See [SETUP.md](./SETUP.md) for step-by-step,
non-technical setup instructions.

## Development

```
npm install
npm run dev
```

## Build

```
npm run build
```

## Tests

```
npm test
```

## Stack

- React + Vite + TypeScript + Tailwind CSS + React Router
- Supabase (database, auth, storage, edge functions)
- Resend for email, sent only from Supabase Edge Functions (`supabase/functions/`)
- Leaflet + OpenStreetMap for delivery location
- Cloudflare Pages for hosting
