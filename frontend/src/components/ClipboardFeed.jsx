import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Send, Copy, Clipboard } from 'lucide-react';

export default function ClipboardFeed({ clipboard, sendClipboard }) {
  const [clipboardText, setClipboardText] = useState("");

  const handleClipboardSend = (e) => {
    e.preventDefault();
    if (!clipboardText.trim()) return;

    sendClipboard(clipboardText);
    toast.success("Text synced to clipboard!");
    setClipboardText("");
  };

  const handleCopyText = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-5 space-y-4 animate-scaleUp">
      <form onSubmit={handleClipboardSend} className="flex items-center space-x-2">
        <Input
          type="text"
          value={clipboardText}
          onChange={(e) => setClipboardText(e.target.value)}
          placeholder="Paste code snippet, link, or text to sync..."
          className="flex-grow bg-slate-950 border-slate-900 text-xs focus:ring-indigo-500"
        />
        <Button
          type="submit"
          disabled={!clipboardText.trim()}
          size="icon"
          className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex-shrink-0 cursor-pointer disabled:opacity-30"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {clipboard.length === 0 ? (
        <div className="py-12 text-center text-slate-600">
          <p className="text-xs">No clipboard clips shared yet.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {clipboard.slice().reverse().map((item, i) => (
            <div
              key={i}
              className={`flex items-start justify-between text-xs p-3 rounded-xl border transition-all ${
                item.fromRemote 
                  ? 'bg-indigo-500/5 border-indigo-500/15 text-indigo-300' 
                  : 'bg-slate-950/40 border-slate-900 text-slate-400'
              }`}
            >
              <span className="break-all font-mono leading-relaxed select-all cursor-text text-left flex-grow">
                {item.text}
              </span>
              <button
                onClick={() => handleCopyText(item.text)}
                className="ml-3 p-1 hover:bg-slate-900 rounded text-slate-600 hover:text-slate-300 transition-colors flex-shrink-0"
                title="Copy clip"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
