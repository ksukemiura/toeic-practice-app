# AGENTS.md

Guidance for coding agents working in this repository.

## Project Summary

- Product: TOEIC practice app (currently based on the Next.js + Supabase starter template).
- Framework: Next.js App Router with TypeScript.
- Styling/UI: Tailwind CSS + shadcn/ui + Radix.
- Auth/backend: Supabase SSR auth with cookie-based sessions.

## Core Commands

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Lint: `npm run lint`
- Production build check: `npm run build`
- Run production server: `npm run start`

## Environment

- Copy `.env.example` to `.env.local`.
- Required vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Never commit secrets or populated `.env.local` files.

## Repository Map

- `app/`: App Router pages, layouts, route handlers.
- `components/`: Reusable UI/components and auth forms.
- `lib/supabase/`: Supabase client setup for browser/server/proxy.
- `proxy.ts`: Request guard and session refresh wiring.

## Coding Rules

- Use strict TypeScript patterns; avoid `any` unless unavoidable.
- Prefer imports via `@/*` path alias.
- Keep components small and focused; extract reusable UI logic to `components/` or `lib/`.
- Match existing code style (functional components, concise naming, minimal comments).
- For UI changes, keep Tailwind utility usage consistent with current patterns.

## Supabase/Auth Safety Constraints

- Do not create global/shared Supabase clients in server contexts.
- In `lib/supabase/proxy.ts`, do not insert logic between `createServerClient(...)` and `supabase.auth.getClaims()`.
- Preserve cookie propagation behavior in `setAll` logic.
- If changing auth redirects, verify protected routes still redirect unauthenticated users to `/auth/login`.

## Validation Before Finishing

- Run `npm run lint` after code edits.
- Run `npm run build` for changes affecting routing, auth flow, or app-wide config.
- If you skip a check, state that clearly in your handoff.

## OpenAI Docs Skill Requirement

When the task involves OpenAI products/APIs/docs (Responses API, Chat Completions, Agents SDK, Realtime, Codex, model limits, etc.):

1. Use the `$openai-docs` skill.
2. Use OpenAI docs MCP tools first (`search_openai_docs`, then `fetch_openai_doc`).
3. Use web search only as fallback and restrict sources to `developers.openai.com` and `platform.openai.com`.
4. Cite sources in final guidance.

## Change Scope

- Keep changes minimal and task-focused.
- Avoid broad refactors unless explicitly requested.
- If behavior changes, update related docs (README or inline guidance) in the same change.
