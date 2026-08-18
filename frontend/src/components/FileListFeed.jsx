import { useEffect, useMemo, useState } from "react";
import FileCard from "./FileCard.jsx";
import { FolderOpen, SearchX, Loader2 } from "lucide-react";
import { getFilterCategory, getFileKind } from "@/lib/fileTypes";
import { cn } from "@/lib/utils";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "images", label: "Images 🖼️" },
  { id: "audio", label: "Audio 🔊" },
  { id: "documents", label: "Docs 📄" },
  { id: "other", label: "Others 📦" },
];

const EMPTY = [];

export default function FileListFeed({
  room,
  downloadProgress,
  onDownload,
  onDelete,
  onQr,
  fetchPreviewUrl,
  refreshFiles,
  isOwner,
  isLoading = false,
}) {
  const [activeFilter, setActiveFilter] = useState("all");

  const files = room.files || EMPTY;

  const { counts, categorized } = useMemo(() => {
    const counts = { all: files.length, images: 0, audio: 0, documents: 0, other: 0 };
    const categorized = new Map();
    for (const f of files) {
      const cat = getFilterCategory(getFileKind(f));
      counts[cat] = (counts[cat] || 0) + 1;
      categorized.set(f.id, cat);
    }
    return { counts, categorized };
  }, [files]);

  const nextExpiry = useMemo(
    () => files.reduce((min, f) => (f.expires_at && f.expires_at < min ? f.expires_at : min), Infinity),
    [files],
  );

  useEffect(() => {
    if (!refreshFiles || !Number.isFinite(nextExpiry)) return;
    const delay = nextExpiry - Date.now();
    if (delay > 2147483647) return;
    const timer = setTimeout(refreshFiles, Math.max(delay, 0) + 1000);
    return () => clearTimeout(timer);
  }, [nextExpiry, refreshFiles]);

  const filteredFiles =
    activeFilter === "all"
      ? files
      : files.filter((f) => categorized.get(f.id) === activeFilter);

  if (isLoading && files.length === 0) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-red-500" />
          <span className="text-xs font-semibold">Loading room files...</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-20 bg-slate-100/70 animate-pulse rounded-2xl border border-slate-200/60"
            />
          ))}
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="py-20 text-center text-slate-600 animate-fadeIn">
        <FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-800" />
        <p className="text-xs font-semibold text-slate-400">Feed is empty</p>
        <p className="text-[10px] text-slate-500 mt-1">
          Files uploaded in this room will list here in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Category Selection Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-left select-none">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border active:scale-95 duration-150 shadow-sm",
              activeFilter === filter.id
                ? "bg-red-500 text-white border-red-500 shadow-red-500/10"
                : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300",
            )}
          >
            <span>{filter.label}</span>
            <span
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full font-mono",
                activeFilter === filter.id
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-500",
              )}
            >
              {counts[filter.id]}
            </span>
          </button>
        ))}
      </div>

      {filteredFiles.length === 0 ? (
        <div className="py-16 text-center text-slate-500 border border-slate-100 bg-white rounded-2xl shadow-sm">
          <SearchX className="w-6 h-6 mx-auto mb-2 text-slate-300" />
          <p className="text-xs font-semibold text-slate-400">
            No {activeFilter} items found
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              view="list"
              isOwner={isOwner ? isOwner(file.id) : false}
              downloadProgress={downloadProgress}
              onDownload={onDownload}
              onDelete={onDelete}
              onQr={onQr}
              fetchPreviewUrl={fetchPreviewUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
