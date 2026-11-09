/**
 * Privacy policy and Terms / Acceptable Use.
 *
 * These exist because Stash accepts arbitrary uploads from anonymous users:
 * without a stated retention policy, an acceptable-use rule and a takedown
 * contact, there is no basis to act on abuse and no disclosure of what the
 * service does with user data.
 *
 * Content is deliberately factual and matches the implementation:
 *   - 100 MB per file, 10 files per upload   (backend/src/upload.js)
 *   - files expire after 1 min – 7 days      (controller.js uploadFile)
 *   - rooms and contents removed after 24h   (controller.js cleanupExpiredRooms)
 *   - storage is Supabase; not end-to-end encrypted
 *
 * NOT legal advice — have a lawyer review before relying on this commercially.
 */

const CONTACT_EMAIL = "abuse@stash.example";

function Section({ title, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-slate-900 mb-3">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}

function LegalShell({ heading, updated, children }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <header className="border-b border-slate-100">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center">
              <img src="/favicon.svg" alt="" aria-hidden="true" className="w-5 h-5" />
            </div>
            <span className="text-lg font-extrabold tracking-tight">Stash</span>
          </a>
          <a
            href="/rooms"
            className="text-[13px] font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            Open App
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
          {heading}
        </h1>
        <p className="text-sm text-slate-400 font-medium mb-10">
          Last updated: {updated}
        </p>
        {children}
      </main>

      <footer className="border-t border-slate-100 py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
          <a href="/" className="hover:text-slate-900">Home</a>
          <a href="/privacy" className="hover:text-slate-900">Privacy</a>
          <a href="/terms" className="hover:text-slate-900">Terms &amp; Acceptable Use</a>
        </div>
      </footer>
    </div>
  );
}

export function Privacy() {
  return (
    <LegalShell heading="Privacy Policy" updated="8 November 2026">
      <Section title="What Stash is">
        <p>
          Stash is a temporary file-sharing service. You create a room, upload
          files, and share the room link. There are no user accounts.
        </p>
      </Section>

      <Section title="What we collect">
        <p>
          <strong>Files and text you upload.</strong> Stored with our hosting
          provider (Supabase) so other devices in your room can download them.
        </p>
        <p>
          <strong>File metadata.</strong> Filename, size, MIME type, upload
          time, expiry time and download count.
        </p>
        <p>
          <strong>A browser identifier.</strong> A random ID generated in your
          browser and kept in <code>localStorage</code>, used to group the rooms
          you created. It is not linked to any personal information.
        </p>
        <p>
          <strong>Your IP address.</strong> Processed in transit by our host and
          used for rate limiting and, optionally, to group devices that share a
          public IP into the same local room. It is hashed before being used as
          a room identifier.
        </p>
        <p>We do not use advertising or analytics trackers.</p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Files are deleted when they expire (you choose between 1 minute and
          7 days, default 24 hours) or when they reach their download limit.
          Rooms and any remaining contents are deleted 24 hours after creation.
          Deletion removes both the stored file and its database record.
        </p>
      </Section>

      <Section title="Security, and an important limitation">
        <p>
          Traffic is encrypted in transit (HTTPS/WSS) and files are encrypted at
          rest by our storage provider. Room access codes and file passwords are
          stored only as bcrypt hashes.
        </p>
        <p>
          <strong>
            Stash is not end-to-end encrypted. Operators of the service and its
            hosting providers are technically capable of accessing uploaded
            files.
          </strong>{" "}
          Do not use Stash for data you would not trust a hosted service with.
          If you need end-to-end encryption, use a tool built for it.
        </p>
      </Section>

      <Section title="Who else processes your data">
        <p>
          Supabase (database and file storage) and our application hosting
          providers. Anyone you give a room link or access code to can download
          the files in that room.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can delete any file you uploaded from within the room, and a host
          can delete an entire room immediately. Because there are no accounts,
          we cannot identify &quot;your&quot; data beyond what your browser
          holds — clearing site data for Stash removes your local room list and
          tokens.
        </p>
        <p>
          Questions or requests: <a className="text-red-600 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </Section>
    </LegalShell>
  );
}

export function Terms() {
  return (
    <LegalShell heading="Terms & Acceptable Use" updated="8 November 2026">
      <Section title="The service">
        <p>
          Stash is provided free of charge, as-is, with no warranty and no
          uptime guarantee. Files may be deleted at any time, including before
          their stated expiry. Do not use Stash as your only copy of anything.
        </p>
        <p>Current limits: 100 MB per file, 10 files per upload.</p>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to use Stash to store, send or distribute:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Malware, viruses, or anything designed to damage systems.</li>
          <li>
            Child sexual abuse material, or any content that sexualises minors.
          </li>
          <li>
            Content that infringes someone else&apos;s copyright or other
            rights.
          </li>
          <li>
            Material that harasses, threatens, defames or incites violence
            against anyone.
          </li>
          <li>
            Other people&apos;s personal or confidential data without their
            permission.
          </li>
          <li>Phishing pages, scams, or fraudulent material.</li>
          <li>Anything illegal where you or your recipients are located.</li>
        </ul>
        <p>
          You also agree not to attempt to circumvent room access controls or
          rate limits, to access rooms you were not given access to, or to use
          automated means to bulk-upload or scrape content.
        </p>
      </Section>

      <Section title="Reporting abuse and takedowns">
        <p>
          Email{" "}
          <a className="text-red-600 underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>{" "}
          with the room link or file link and a short description of the
          problem. Reports of illegal content are actioned on a best-effort
          basis as quickly as we can, and we may delete any room or file and
          block access without notice.
        </p>
        <p>
          Copyright holders: include the work concerned, the Stash link, your
          contact details, and a statement that you are authorised to act for
          the rights holder.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          To the fullest extent permitted by law, Stash and its maintainers are
          not liable for any loss arising from use of the service, including
          data loss, unauthorised access to a room, or unavailability. You are
          responsible for the content you upload and for who you share room
          links with.
        </p>
      </Section>

      <Section title="Open source">
        <p>
          Stash&apos;s source code is published under the MIT License. The MIT
          License covers the software; it does not grant any warranty for this
          hosted instance.
        </p>
      </Section>
    </LegalShell>
  );
}
