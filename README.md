# Most Likely

A ~10-minute classroom activity for middle schoolers (ages 11–14) about one idea:

> **An AI writes by spinning a weighted spinner.** Likely words come up often,
> unlikely words sometimes, and what you type changes the spinner.

Kids type the start of a sentence, guess what comes next, and spin a real
language model (GPT-2) 10 times. Rounds are scored on **actual spins, never on
the probability bars**, so the activity targets the misconception that the AI
always picks the single most likely word.

---

## Run it locally

Requires Node 22+.

```bash
npm install
npm run dev            # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run classroom` | Production build + start (use this with real kids) |
| `npm test` | Unit tests: merge layer, blocklist, sampling, finishing words, edit distance, logging |
| `npm run check-model` | Real GPT-2: checks every target word is one token, prints spinners and spins |
| `npm run fetch-model` | Saves the model files into `public/models/` so browsers download them from this app instead of huggingface.co |
| `/researcher` | Session list and CSV export (only opens on the computer running the app) |

### Where the model runs

Set `NEXT_PUBLIC_MODEL_MODE` in `.env.local` (see `.env.example`):

- **`browser`**: each kid's browser downloads GPT-2 (~250 MB, fp16) once and
  runs it. Measured: first load ~14 s on fast wifi, ~4 s after that (cached).
  This is what the Vercel test site uses.
- **`server`** (default): the computer running the app runs GPT-2; kids'
  laptops only show the page. Use it when student laptops are too weak.

Both modes run the same spinner engine (`lib/spinner/engine.ts`).

## Config files (edit these, not the code)

- **`config/game.ts`**: target words, plural merges, thresholds, spins per
  set, spin budgets, surprise and "lucky win" cut-offs, and the short
  kid-facing text for each round.
- **`config/blocklist.ts`**: blocked words. They are refused when kids type
  them and zeroed out of the model **before** sampling (the rest rescaled to
  100%). Finished multi-piece words are checked too.

Each session saves a snapshot of `config/game.ts`, so data collected under
different settings can be told apart.

## Research logs

**Saved where:** on **the computer running the app**, in `logs/` (or
`LOGS_DIR`), with one JSON file per kid: `logs/<session id>.json`. Kids'
browsers send events to `/api/log`. `logs/` is gitignored. The Vercel test
site does **not** save logs; Supabase replaces local files next.

**Identifying data:** first name + last initial, stored **only** in the
session record.

**Session** (one per kid): `id`, `first_name`, `last_initial`, `started_at`,
`user_agent`, `app_version`, `model_mode`, `config`.

**Events** (append-only, unique on `session_id` + `seq`): `id`, `session_id`,
`seq`, `round`, `event_type`, `sentence`, `distribution` (top-10 merged
chances), `prediction`, `spin_results`, `words_changed`, `attempt`,
`detail`, `timestamp`.

| `event_type` | Logged when | Key fields |
|---|---|---|
| `session_start` / `session_end` | Start pressed / page closed | |
| `model_ready` | the model finished loading | `detail`: load time, model, device RAM, CPU cores |
| `sentence_submitted` | **every** sentence, not just successes | `sentence`, `distribution`, `words_changed` (vs. this kid's previous sentence), `attempt` (try # in this round) |
| `sentence_blocked` | a sentence contained a blocked word | full `sentence` text |
| `prediction` | a guess was tapped or typed | `prediction`: word, count, typed?, its chance, its pieces |
| `spin_set` | a set of spins finished | `spin_results`: each spin's word, raw token, chance, pieces; counts; skipped animation? |
| `peek` / `xray_toggle` | chance bars opened / X-ray flipped | |
| `error` | the spinner failed | `detail`: where, message |

Logging never stops the game. Events wait in a queue mirrored to
`localStorage` and leave it only after the server confirms they were saved,
so wifi drops and reloads don't lose data.

**Export:** open `/researcher` on the computer running the app, then
**Events CSV** (one row per event, with names joined in) or **Sessions CSV**.

## How it works

1. **Next-token probabilities.** GPT-2 (base model, `Xenova/gpt2` via
   `@huggingface/transformers`) runs on the sentence; we softmax the logits at
   the last position ourselves. No `generate()`, temperature or top-k.
2. **Merge layer** (`lib/normalize.ts`, `lib/merge.ts`). All ~50k tokens
   become kid words: strip the leading space, lowercase, drop attached
   punctuation, merge target-word plurals, sum the probabilities.
   Sentence-ending punctuation → "(sentence ends)". Fragments, commas and
   quotes → "pieces & punctuation". Words below the top 8 → "other words",
   drawn as rainbow slices.
3. **Spins** sample real tokens from the blocked, rescaled distribution.
4. **Finish the word** (`lib/finish.ts`). A spin that lands on a word start
   (`␣D`) or an opening quote keeps drawing pieces until the word ends:
   `␣D + uke` → **duke**.

## Design rationale

- **Spins are the scoreboard.** Kids who only see bars conclude the AI picks
  the tallest bar. Scoring on samples makes randomness visible and "most
  likely ≠ certain" concrete.
- **An honest spinner.** We merge the full vocabulary rather than rescaling
  a top-100 cut, so the long tail shows up as "other words" instead of
  silently inflating the top words.
- **fp16, not 8-bit.** The 8-bit GPT-2 builds shift probabilities by 0.2–0.4
  (total variation); "raining cats and → dogs" drops from 59% to 39%. fp16 is
  effectively exact. Smaller files would teach the wrong numbers.
- **X-ray and word pieces.** "dog", "Dog" and "dogs" are separate tokens, and
  "Fido" is `␣F + ido`. X-ray shows the pieces for curious kids; the main view
  stays in kid words.
- **Predict, then spin.** A guess before every set turns spinning into a
  tested idea. Peek opens only after guessing.
- **Grade-4 text, big targets, no wrong answers early.** Built for school
  Chromebooks at 1366×768 and projectors.
- **The revision sequence is the data.** Every sentence attempt is logged
  with how much it changed, because how kids revise prompts is the
  computational-thinking evidence.

## Status

Prototype on branch `prototype`. Done: model + merge layer, sandbox, server
and browser modes, local-file logging + `/researcher`. Next: rounds (Dog
Trainer, Switcheroo, Perfect 10, Coin Flip), then Supabase logging.
