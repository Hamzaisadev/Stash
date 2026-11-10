# Security policy

## Reporting a vulnerability

Report privately through
[GitHub Security Advisories](https://github.com/Hamzaisadev/Stash/security/advisories/new),
or by email to **hamzaisadev@gmail.com**.

Please do not open a public issue for a vulnerability. Rooms on the hosted
instance are live, and a public report is an exploit guide for as long as it
takes to ship a fix.

This is a solo-maintained project. Expect an acknowledgement within a few days,
and a fix for anything confirmed and serious before any public disclosure. You
will be credited unless you would rather not be.

## What is already known and in scope by design

These are documented limitations, not undisclosed bugs. Reporting them is fine,
but they are already understood:

- **Stash is not end-to-end encrypted.** Traffic is encrypted in transit and
  files are encrypted at rest by the storage provider, but whoever operates an
  instance can read what passes through it. This is stated on the landing page,
  in the README, and in the privacy policy.
- **Room access codes are bearer credentials.** Anyone holding a room's 6-digit
  code can enter that room. Codes are stored only as bcrypt hashes and expire
  after 24 hours.
- **License keys are bearer credentials.** A key is deliberately not tied to an
  account, because the product's premise is that nothing asks who you are. A
  shared key works for whoever holds it; what that costs the holder is a shared
  daily upload allowance.
- **Local network auto-discovery groups devices by hashed public IP.** Devices
  behind one NAT — including, say, a university or an office — can land in the
  same auto-discovered room. Use a named room for anything sensitive.
- **Single backend instance.** Room host and clipboard state is in-process, as
  is upload quota accounting. A restart forgives outstanding quota.

## What is in scope

- Authentication bypass on room, host or license tokens
- Forging a license key, or escalating a Pro key to Team
- Reading, writing or deleting files in a room you were never admitted to
- Bypassing the download limit on a burn-after-download file
- Injection, SSRF, or path traversal in upload, download or preview paths
- Webhook signature bypass that mints licenses
- Anything that lets one user exhaust another user's quota

## What is out of scope

- Missing rate limits on endpoints that already have them, without a
  demonstrated bypass
- Reports from automated scanners with no working proof of concept
- Social engineering, physical access, or attacks requiring a compromised device
- Denial of service through sheer volume
- Vulnerabilities in a self-hosted instance caused by that instance's own
  configuration (an unset `TOKEN_SECRET`, a public Supabase service key, a
  missing `ALLOWED_ORIGINS`)

## Supported versions

The `main` branch and the current hosted deployment. There are no backported
security fixes for older tags.
