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
ALMOSTCRACKD_API_BASE_URL=https://api.almostcrackd.ai
ALMOSTCRACKD_API_TOKEN=your_api_token_here
# Optional override if your description endpoint path differs.
ALMOSTCRACKD_DESCRIBE_PATH=/pipeline/generate-image-description
```

## Current scope

- Prompt-chain builder UI (add/remove/edit steps)
- Variable interpolation across chain steps (`{{input}}`, `{{step_n_output}}`)
- API route at `POST /api/prompt-chain/run` for chain execution
- Simulated step outputs as placeholder for upcoming model integration
- Image-to-description workflow (`POST /api/image/describe`) that:
- requests presigned upload URL
- uploads the image
- registers the image in pipeline
- requests a generated image description

## Notes

- The repository `AL-Humor-Study-Project` was not found at expected local paths during scaffolding.
- Structure and conventions were aligned to local references in `Vercel-Hello-World` and `AL-Humor-Study-Admin-Panel`.
