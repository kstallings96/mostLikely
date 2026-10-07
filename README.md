# Most Likely

A ~10-minute classroom activity for middle schoolers: an LLM picks the next
word by spinning a weighted spinner. Likely words come up often, unlikely
words sometimes, and what you type changes the spinner.

> Local prototype. A full README (setup, config, logs, design rationale)
> lands with the last build stage.

```bash
npm install
npm test             # unit tests (merge layer, blocklist, sampling, edit distance)
npm run check-model  # real GPT-2: single-token check + end-to-end smoke test
npm run dev          # http://localhost:3000
```
