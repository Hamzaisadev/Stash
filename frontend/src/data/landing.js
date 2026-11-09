/**
 * Every visible string on the landing page.
 *
 * HARD RULE: every number and claim here must be literally true against the
 * implementation. A prior audit found the page claiming "no cloud", "no size
 * limits ever" and "100% direct device transfer", none of which the code does.
 * Sources for the figures below:
 *   100 MB / 10 files   backend/src/upload.js       (multer limits)
 *   1 min - 7 days      backend/src/controller.js   (uploadFile clamp)
 *   24 h default        backend/src/controller.js   (parsedMinutes = 1440)
 *   24 h room life      backend/src/controller.js   (cleanupExpiredRooms)
 *   30 clipboard items  backend/src/server.js       (history.shift at > 30)
 *   6-digit codes       backend/src/controller.js   (crypto.randomInt)
 * If a limit changes in the backend, change it here.
 *
 * No user counts, testimonials or client logos: there are no metrics to cite.
 */

export const site = {
  name: "Stash",
  url: "https://stash-ed.vercel.app",
  repo: "https://github.com/Hamzaisadev/Stash",
};

/** Chips in the hero playground. Labels are plausible sample files. */
export const chips = [
  { id: "a", label: "beach.jpg", kind: "image", tone: "coral" },
  { id: "b", label: "setlist.pdf", kind: "doc", tone: "blue" },
  { id: "c", label: "demo.mp3", kind: "audio", tone: "sun" },
  { id: "d", label: "notes.txt", kind: "doc", tone: "ink" },
  { id: "e", label: "logo.svg", kind: "image", tone: "blue" },
];

export const steps = [
  {
    n: "01",
    title: "Drop",
    body: "Drag a file onto the page, or paste it straight from your clipboard. Nothing to install.",
  },
  {
    n: "02",
    title: "Share",
    body: "Send the room link, let them scan the QR code, or read out the 6-digit code.",
  },
  {
    n: "03",
    title: "Catch",
    body: "It lands on the other device in real time. Preview images and audio before downloading.",
  },
];

export const carries = [
  {
    n: "01",
    title: "Files",
    meta: "100 MB each, 10 per upload",
    body: "Any format. Send several at once and they arrive as one zip.",
  },
  {
    n: "02",
    title: "Clipboard",
    meta: "Last 30 entries, synced live",
    body: "Copy a link on your phone, paste it on your laptop a second later.",
  },
  {
    n: "03",
    title: "Screen",
    meta: "WebRTC, browser to browser",
    body: "Cast a tab, a window or your camera to everyone in the room.",
  },
  {
    n: "04",
    title: "Voice notes",
    meta: "Recorded in the browser",
    body: "Record, drop it in the room, play it back anywhere.",
  },
];

export const limits = [
  { value: "100", unit: "MB", label: "Largest file" },
  { value: "10", unit: "files", label: "Per upload" },
  { value: "24", unit: "hours", label: "Then the room is deleted" },
  { value: "0", unit: "accounts", label: "Nothing to sign up for" },
];

export const expiryOptions = [
  { label: "1 min", isDefault: false },
  { label: "1 hour", isDefault: false },
  { label: "24 hours", isDefault: true },
  { label: "7 days", isDefault: false },
];

/**
 * Stated plainly rather than buried. The audit's point was that a security
 * story is only credible when the limitation is disclosed in the same breath.
 */
export const truth = {
  does: [
    "Encrypted in transit, and encrypted at rest by the storage provider.",
    "Room codes and file passwords are stored only as bcrypt hashes.",
    "Files delete themselves on expiry, or the moment they hit a download limit.",
    "No account, no email, no tracking scripts.",
  ],
  doesNot: [
    "Not end-to-end encrypted. Whoever runs the server can read what passes through it.",
    "Not a backup. Anything you put in a room is on its way out.",
  ],
};
