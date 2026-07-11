import React from 'react';

function ActionBar({ activeMode, onChangeMode, roomFileCount, clipboardCount }) {
  const modes = [
    { 
      id: 'files', 
      label: 'Files', 
      badge: roomFileCount,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      )
    },
    { 
      id: 'clipboard', 
      label: 'Clipboard', 
      badge: clipboardCount,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )
    },
    { 
      id: 'voice', 
      label: 'Voice Drop', 
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )
    },
    { 
      id: 'screen', 
      label: 'Screen Share', 
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )
    }
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[calc(100%-2rem)]">
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-1.5 shadow-2xl flex items-center justify-between">
        {modes.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onChangeMode(mode.id)}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 sm:py-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
            >
              {mode.icon}
              <span className="text-[10px] sm:text-xs tracking-wide leading-none">{mode.label}</span>
              {mode.badge > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'}`}>
                  {mode.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ActionBar;
