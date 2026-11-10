<!--
Keep this short. The diff says what changed; this says why, and what you
checked. Delete sections that genuinely do not apply.
-->

## What this changes

<!-- One or two sentences. -->

## Why

<!-- The problem being solved, or the issue this closes (Closes #123). -->

## How it was verified

<!-- What you actually ran, not what you intend to run. -->

- [ ] `cd backend && npm test`
- [ ] `cd frontend && npx eslint src --max-warnings=0`
- [ ] `cd frontend && npm run build`
- [ ] Tried it in a browser on a real device

## Checklist

- [ ] No secrets, license keys, room codes or `.env` contents in the diff.
- [ ] If a limit changed in `backend/src/billing/plans.js`, the copy in
      `frontend/src/data/pricing.js` changed in the same commit.
- [ ] If a limit changed in the backend, `frontend/src/data/landing.js` still
      states the truth. Both files carry a hard rule that published numbers
      match the implementation.
- [ ] Database changes ship with a migration in `backend/migrations/`, and
      `schema.sql` was updated to match.
- [ ] New behaviour that can be tested without a network has a test.
