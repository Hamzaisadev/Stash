# Contributing to Stash

Thanks for being here. This is a small, solo-maintained project, so a short
note before you start saves us both time.

## Before you write code

**Open an issue first** for anything beyond a bug fix or a typo. Stash has a
deliberate strategy — be genuinely good at moving a file between two devices
with no account — and a well-built feature that widens the product is still
likely to be declined. [`docs/ROADMAP.md`](../docs/ROADMAP.md) shows what is
planned and in what order.

Good first contributions: fixing something on the roadmap, improving an error
message, a test for existing behaviour, an accessibility fix.

## Getting set up

```bash
git clone https://github.com/Hamzaisadev/Stash.git
cd Stash

# Backend
cd backend
npm install
cp .env.example .env     # fill in Supabase credentials and TOKEN_SECRET
npm run dev

# Frontend, in a second terminal
cd frontend
npm install
npm run dev
```

You need a Supabase project: run `backend/schema.sql` in its SQL editor and
create a storage bucket named `stash-files`. Generate `TOKEN_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Open `http://localhost:5173`. To test across devices, use your machine's LAN IP
rather than `localhost`, or the phone will have nothing to talk to.

## Before you open a pull request

Run what CI runs:

```bash
cd backend  && npm test
cd frontend && npx eslint src --max-warnings=0
cd frontend && npm run build
```

All three must pass. CI runs them on every PR.

## House rules

A few conventions this codebase holds to. They are not style preferences; each
one exists because breaking it previously caused a real problem.

**Published numbers must be true.** `frontend/src/data/landing.js` and
`frontend/src/data/pricing.js` both carry a hard rule at the top: every limit
and claim must match the implementation. A past audit found the page claiming
"no cloud" and "no size limits ever", neither of which the code did. If you
change a limit in the backend, change the copy in the same commit.

**Comments explain why, not what.** The codebase is commented densely where a
decision is non-obvious — why host tokens never expire, why the webhook needs a
raw body, why upload quota is in memory. Match that. Do not narrate what the
next line does.

**Database changes ship with a migration.** Add a numbered file to
`backend/migrations/` *and* update `schema.sql`, so a fresh install and an
upgrade both land in the same place.

**Security-relevant code gets a test.** Anything touching tokens, licenses,
access control or download limits. See `backend/src/utils/auth.test.js` and
`backend/src/billing/license.test.js` for the pattern — including tests for the
attack, not just the happy path.

**Never commit a secret.** No `.env`, no Supabase service key, no license key.
A license key in a diff is a working credential.

## Commit messages

Conventional Commits, matching the existing history:

```
feat(billing): add team plan
fix(upload): reject files over the plan limit before buffering
docs: correct the room expiry figure on the pricing page
```

## Code of conduct

By participating you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Licensing

Stash is MIT licensed. Contributions are accepted under the same licence.
