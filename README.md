# AL Humor Study Prompt Chain

Next.js app for building and testing prompt chains used by the AL Humor study workflow.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment

Create a `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://secure.almostcrackd.ai
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_key_here
ADMIN_EMAILS=you@example.com
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_URL=https://api.almostcrackd.ai
# Optional override if your description endpoint path differs.
IMAGE_DESCRIBE_PATH=/pipeline/generate-image-description
```

## Current scope

- Prompt-chain builder UI (add/remove/edit steps)
- Variable interpolation across chain steps (`{{input}}`, `{{step_n_output}}`)
- API route at `POST /api/prompt-chain/run` for chain execution
- Simulated step outputs as placeholder for upcoming model integration
- Image-to-description workflow (`POST /api/image/describe`) using presign, upload, register, and describe pipeline steps

## Notes

- The repository `AL-Humor-Study-Project` was not found at expected local paths during scaffolding.
- Structure and conventions were aligned to local references in `Vercel-Hello-World` and `AL-Humor-Study-Admin-Panel`.
