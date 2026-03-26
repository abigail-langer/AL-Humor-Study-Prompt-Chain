# AL Humor Study Prompt Chain

Next.js app for building and testing prompt chains used by the AL Humor study workflow.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Current scope

- Prompt-chain builder UI (add/remove/edit steps)
- Variable interpolation across chain steps (`{{input}}`, `{{step_n_output}}`)
- API route at `POST /api/prompt-chain/run` for chain execution
- Simulated step outputs as placeholder for upcoming model integration

## Notes

- The repository `AL-Humor-Study-Project` was not found at expected local paths during scaffolding.
- Structure and conventions were aligned to local references in `Vercel-Hello-World` and `AL-Humor-Study-Admin-Panel`.
