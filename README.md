# ND Model Lab

Nine Degree's internal tool for picking the right AI video or image model and writing reference-aware prompts.

- `index.html` is the whole front end (no build step).
- `api/generate.js` is a Vercel function that sends the brief and reference frames to Claude and returns the prompt as JSON.

## Deploy on Vercel

Option A, CLI (from this folder):

```
npx vercel login
npx vercel --prod
```

Option B, GitHub: push this folder to a repo, then on vercel.com choose Add New > Project > Import that repo. Framework preset: Other. No build command.

## Environment variables

Set these in Vercel > Project > Settings > Environment Variables, then redeploy:

| Name | Required | Value |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Key from console.anthropic.com |
| `APP_PASSCODE` | Recommended | Any passcode you share with the team. Without it, anyone with the URL can spend API credit. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-5-5`. Use `claude-opus-5-5` for the strongest prompts. |

Without an API key the site still works in Template mode (instant prompts from the selections, no reference reading).

## Cost

Each "Evaluate & write prompt" is one Claude call with up to 8 reference frames, roughly a few cents on Sonnet.
