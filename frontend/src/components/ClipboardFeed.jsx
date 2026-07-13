import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Send, Copy, Check, Trash2 } from 'lucide-react';

export default function ClipboardFeed({ clipboard, sendClipboard, clearClipboard, isRoomHost }) {
  const [clipboardText, setClipboardText] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const handleClipboardSend = (e) => {
    e.preventDefault();
    if (!clipboardText.trim()) return;

    sendClipboard(clipboardText);
    toast.success("Text synced to clipboard!");
    setClipboardText("");
  };

  const handleCopyText = (text, index) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
    setCopiedId(index);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm animate-scaleUp text-left">
      {/* Clipboard Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shared Clipboard ({clipboard.length})</span>
        {isRoomHost && clearClipboard && clipboard.length > 0 && (
          <button
            onClick={() => {
              clearClipboard();
              toast.success("Room clipboard history cleared!");
            }}
            className="p-1 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
            title="Clear clipboard history for all guests"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear board
          </button>
        )}
      </div>

      <form onSubmit={handleClipboardSend} className="flex items-center space-x-2">
        <Input
          type="text"
          value={clipboardText}
          onChange={(e) => setClipboardText(e.target.value)}
          placeholder="Paste code snippet, link, or text to sync..."
          className="flex-grow bg-white border-slate-200 text-slate-800 text-xs focus:ring-red-500 focus:border-red-500"
        />
        <Button
          type="submit"
          disabled={!clipboardText.trim()}
          size="icon"
          className="bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 flex-shrink-0 cursor-pointer disabled:opacity-30"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>

      {clipboard.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <p className="text-xs">No clipboard clips shared yet.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {clipboard.slice().reverse().map((item, i) => (
            <div
              key={i}
              className={`flex items-start justify-between text-xs p-3 rounded-xl border transition-all ${
                item.fromRemote 
                  ? 'bg-red-50 border-red-100 text-red-700' 
                  : 'bg-slate-50 border-slate-205 text-slate-700'
              }`}
            >
              <span className="break-all font-mono leading-relaxed select-all cursor-text text-left flex-grow">
                {item.text}
              </span>
              <button
                onClick={() => handleCopyText(item.text, i)}
                className="ml-3 p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-750 transition-colors flex-shrink-0 cursor-pointer"
                title="Copy clip"
              >
                {copiedId === i ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
