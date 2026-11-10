/**
 * Pricing copy.
 *
 * HARD RULE, inherited from data/landing.js: every number here must be
 * literally true against backend/src/billing/plans.js. If a limit changes
 * there, change it here in the same commit. The page is allowed to be
 * persuasive; it is not allowed to be wrong.
 *
 * Source of every figure: backend/src/billing/plans.js → PLANS[*].limits
 */

export const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    tagline: 'The whole product, for the everyday case.',
    cta: 'Just start',
    highlight: false,
    features: [
      '100 MB per file, 10 files per drop',
      'Rooms live for 24 hours',
      'Expiry from 1 minute to 7 days',
      'Password-locked rooms and burn-after-download',
      'Screen casting and synced clipboard',
      '2 GB of uploads a day',
    ],
    missing: ['No TURN relay — P2P can fail on mobile networks'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$6',
    cadence: 'per month',
    tagline: 'For people who move big files all day.',
    cta: 'Go Pro',
    highlight: true,
    features: [
      '5 GB per file, 50 files per drop',
      'Rooms live for 30 days',
      'Expiry up to 30 days',
      'TURN relay included — transfers work on cellular',
      '100 GB of uploads a day',
      'Clipboard history of 500 entries',
      'API access',
      'Priority support',
    ],
    missing: [],
  },
  {
    id: 'team',
    name: 'Team',
    price: '$24',
    cadence: 'per month',
    tagline: 'Shared rooms, your logo, an audit trail.',
    cta: 'Get Team',
    highlight: false,
    features: [
      '20 GB per file, 200 files per drop',
      'Rooms that never expire',
      'Unlimited rooms',
      '1 TB of uploads a day',
      'Custom branding on your rooms',
      'Clipboard history of 2,000 entries',
      'Everything in Pro',
    ],
    missing: [],
  },
];

/**
 * Stated plainly rather than buried, in the same spirit as the `truth` block on
 * the landing page. An open-source project that starts charging owes people a
 * straight answer about what paying is actually for.
 */
export const honesty = {
  heading: 'What you are paying for',
  points: [
    'Stash is MIT licensed. Self-host it and every limit on this page disappears — set SELF_HOSTED_UNLIMITED=true and you have the Team tier for free, forever.',
    'What you buy here is the hosted instance: the storage, the bandwidth, the TURN relay that makes transfers work on mobile networks, and someone keeping it running.',
    'No account is created. A license key is a string you paste in; it is not an identity and it is not tied to an email we hold.',
    'Still not end-to-end encrypted, on any plan. Whoever runs the server can read what passes through it.',
  ],
};

export const faq = [
  {
    q: 'Can I just self-host it instead of paying?',
    a: 'Yes, and that is a genuinely supported path, not a grudging one. The licence permits it and the repo documents it. Paying is for people who would rather not run a server.',
  },
  {
    q: 'What happens when my license expires?',
    a: 'You drop to the Free plan. Nothing is deleted that was not already going to expire, and rooms created under a paid plan keep the lifetime they were created with.',
  },
  {
    q: 'Do I need an account?',
    a: 'No. You get a license key, you paste it into Stash once, and it lives in your browser. There is nothing to log into.',
  },
  {
    q: 'What if I use the key on two devices?',
    a: 'It works. The daily allowance is shared across everywhere you paste it, which is the only thing being metered.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Yes — mail the address on the repo and the key is revoked and refunded. There is no retention flow to sit through.',
  },
];
