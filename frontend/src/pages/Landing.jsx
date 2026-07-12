import React from 'react';

function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e2e4e9] grain">

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-white/[0.06]" style={{ backdropFilter: 'blur(16px)', background: 'rgba(10, 10, 15, 0.8)' }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-[15px] font-bold tracking-tight text-white">Stash</span>
          <div className="flex items-center gap-6">
            <a href="https://github.com" target="_blank" rel="noopener" className="text-[13px] text-[#888] hover:text-white transition-colors">GitHub</a>
            <a href="/rooms" className="text-[13px] font-medium text-black bg-white hover:bg-[#e0e0e0] px-4 py-1.5 rounded-lg transition-colors">Open Stash</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="animate-fadeUp">
            <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-[#666] mb-6">v2.0 / Open Source</span>
            <h1 className="text-[clamp(2.5rem,6vw,4.25rem)] font-extrabold leading-[1.05] tracking-tight text-white">
              Share files without<br />the ceremony
            </h1>
            <p className="mt-6 text-[17px] leading-relaxed text-[#888] max-w-md mx-auto">
              Drop a file. Get a link. Anyone with the link sees it instantly. Files self-destruct when you decide. No accounts, no installs, no file size lectures.
            </p>
          </div>
          <div className="mt-10 flex items-center justify-center gap-4 animate-fadeUp stagger-2">
            <a href="/rooms" className="inline-flex items-center gap-2 bg-white text-black text-[14px] font-semibold px-6 py-3 rounded-xl hover:bg-[#e8e8e8] transition-all hover:scale-[1.02] active:scale-[0.98]">
              Open Stash
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <span className="text-[13px] text-[#555]">Free forever. No sign-up.</span>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6"><div className="border-t border-white/[0.06]" /></div>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.15em] text-[#555] mb-12 text-center animate-fadeUp">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Drop your file', desc: 'Drag anything into the browser. Photos, videos, documents, folders. It uploads to an encrypted cloud vault.' },
              { step: '02', title: 'Share the room', desc: 'Copy the room link or let nearby devices auto-discover you. Anyone on the same network sees your files instantly.' },
              { step: '03', title: 'It disappears', desc: 'Files self-destruct after your chosen timer. Burn-after-download deletes the file the moment someone grabs it.' }
            ].map((item, i) => (
              <div key={i} className={`animate-fadeUp stagger-${i + 1}`}>
                <span className="text-[11px] font-mono font-semibold text-[#444] block mb-3">{item.step}</span>
                <h3 className="text-[16px] font-bold text-white mb-2">{item.title}</h3>
                <p className="text-[14px] leading-relaxed text-[#777]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6"><div className="border-t border-white/[0.06]" /></div>

      {/* Instant Sharing */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center animate-fadeUp">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#555] mb-4 block">Instant Sharing</span>
          <h2 className="text-[2rem] font-extrabold tracking-tight text-white mb-4">
            Same Wi-Fi? Already connected.
          </h2>
          <p className="text-[15px] leading-relaxed text-[#777] max-w-lg mx-auto mb-8">
            Open Stash on your laptop and your phone. If they share a network, they find each other automatically. No QR codes, no pairing screens, no Bluetooth fumbling. Different network? Create a named room like <span className="font-mono text-[#999] bg-white/[0.04] px-1.5 py-0.5 rounded">/design-team</span> and share the link. Works across cities.
          </p>
          <a href="/rooms" className="inline-flex items-center gap-2 text-[13px] font-semibold text-white border border-white/[0.12] px-5 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all">
            Try instant sharing
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6"><div className="border-t border-white/[0.06]" /></div>

      {/* Voice Drops */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center animate-fadeUp">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#555] mb-4 block">Voice Drops</span>
          <h2 className="text-[2rem] font-extrabold tracking-tight text-white mb-4">
            Say it instead of typing it
          </h2>
          <p className="text-[15px] leading-relaxed text-[#777] max-w-lg mx-auto mb-8">
            Hold the mic button, say what you need to say, release. Your voice drops into the room feed alongside your files. Tell your teammate to check slide three instead of opening a separate chat to explain it.
          </p>
          <a href="/rooms" className="inline-flex items-center gap-2 text-[13px] font-semibold text-white border border-white/[0.12] px-5 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all">
            Record a voice drop
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6"><div className="border-t border-white/[0.06]" /></div>

      {/* Live Screen Share */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center animate-fadeUp">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#555] mb-4 block">Screen Share</span>
          <h2 className="text-[2rem] font-extrabold tracking-tight text-white mb-4">
            Show your screen to anyone in the room
          </h2>
          <p className="text-[15px] leading-relaxed text-[#777] max-w-lg mx-auto mb-8">
            Click share, pick a window, and everyone in the room sees it live. No meetings, no calendar invites, no "can everyone see my screen" moments. Uses the same peer-to-peer technology that powers your file transfers.
          </p>
          <a href="/rooms" className="inline-flex items-center gap-2 text-[13px] font-semibold text-white border border-white/[0.12] px-5 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all">
            Share your screen
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6"><div className="border-t border-white/[0.06]" /></div>

      {/* Security & Media */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center animate-fadeUp">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#555] mb-4 block">Security</span>
          <h2 className="text-[2rem] font-extrabold tracking-tight text-white mb-4">
            Files that know when to leave
          </h2>
          <p className="text-[15px] leading-relaxed text-[#777] max-w-lg mx-auto mb-4">
            Every file gets a countdown. When it hits zero, the file is deleted from the cloud permanently. Need something more aggressive? Burn-after-download destroys the file the instant someone downloads it. Password-lock files so only the right person can open them.
          </p>
          <p className="text-[15px] leading-relaxed text-[#777] max-w-lg mx-auto mb-8">
            Photos and videos are viewable right in the browser. They stream, they don't download. Your media stays in Stash, not scattered across Downloads folders.
          </p>
          <a href="/rooms" className="inline-flex items-center gap-2 text-[13px] font-semibold text-white border border-white/[0.12] px-5 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all">
            Stash something private
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6"><div className="border-t border-white/[0.06]" /></div>

      {/* Clipboard */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center animate-fadeUp">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#555] mb-4 block">Clipboard Sync</span>
          <h2 className="text-[2rem] font-extrabold tracking-tight text-white mb-4">
            Copy on your laptop, paste on your phone
          </h2>
          <p className="text-[15px] leading-relaxed text-[#777] max-w-lg mx-auto mb-8">
            Not everything is a file. Sometimes you just need to move a URL, a code snippet, or a Wi-Fi password between devices. Type it into the shared clipboard and it shows up on every device in the room. Instantly.
          </p>
          <a href="/rooms" className="inline-flex items-center gap-2 text-[13px] font-semibold text-white border border-white/[0.12] px-5 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all">
            Open clipboard
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-bold text-white">Stash</span>
            <span className="text-[12px] font-mono text-[#444]">v2.0.0</span>
          </div>
          <p className="text-[12px] text-[#444]">
            Open source. Built to share, not to track.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
