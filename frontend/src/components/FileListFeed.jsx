import React, { useState } from 'react';
import FileCard from './FileCard.jsx';
import { FolderOpen } from 'lucide-react';

export default function FileListFeed({
  room,
  downloadProgress,
  onDownload,
  onDelete,
  onQr,
  fetchPreviewUrl,
  refreshFiles
}) {
  const [activeFilter, setActiveFilter] = useState('all');

  const isOwner = (fileId) => {
    const myUploads = JSON.parse(localStorage.getItem('stash_my_uploads') || '[]');
    return myUploads.includes(fileId);
  };

  const getFileCategory = (file) => {
    const filename = file.filename?.toLowerCase() || '';
    const mime = file.mime_type?.toLowerCase() || '';
    const ext = filename.split('.').pop() || '';

    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'svg', 'bmp'];
    const videoExtensions = ['mp4', 'mov', 'webm', 'ogg', 'mkv', 'avi', 'm4v'];
    const audioExtensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
    const docExtensions = ['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'md', 'json', 'csv'];

    const isVoiceNote = filename.startsWith('voice-drop-');

    if (mime.startsWith('image/') || imageExtensions.includes(ext)) {
      return 'images';
    }
    if (mime.startsWith('video/') || videoExtensions.includes(ext)) {
      return 'images'; // Group videos under visual images/media filter
    }
    if (mime.startsWith('audio/') || audioExtensions.includes(ext) || isVoiceNote) {
      return 'audio';
    }
    if (mime.startsWith('text/') || mime.startsWith('application/pdf') || docExtensions.includes(ext)) {
      return 'documents';
    }
    return 'other';
  };

  if (!room.files || room.files.length === 0) {
    return (
      <div className="py-20 text-center text-slate-600 animate-fadeIn">
        <FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-800" />
        <p className="text-xs font-semibold text-slate-400">Feed is empty</p>
        <p className="text-[10px] text-slate-500 mt-1">Files uploaded in this room will list here in real-time.</p>
      </div>
    );
  }

  const filteredFiles = room.files.filter(f => {
    if (activeFilter === 'all') return true;
    return getFileCategory(f) === activeFilter;
  });

  const filters = [
    { id: 'all', label: 'All', count: room.files.length },
    { id: 'images', label: 'Images 🖼️', count: room.files.filter(f => getFileCategory(f) === 'images').length },
    { id: 'audio', label: 'Audio 🔊', count: room.files.filter(f => getFileCategory(f) === 'audio').length },
    { id: 'documents', label: 'Docs 📄', count: room.files.filter(f => getFileCategory(f) === 'documents').length },
    { id: 'other', label: 'Others 📦', count: room.files.filter(f => getFileCategory(f) === 'other').length }
  ];

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Category Selection Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-left select-none">
        {filters.map(filter => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border active:scale-95 duration-150 shadow-sm ${
              activeFilter === filter.id
                ? 'bg-red-500 text-white border-red-500 shadow-red-500/10'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-350'
            }`}
          >
            <span>{filter.label}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
              activeFilter === filter.id
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {filter.count}
            </span>
          </button>
        ))}
      </div>

      {filteredFiles.length === 0 ? (
        <div className="py-16 text-center text-slate-550 border border-slate-100 bg-white rounded-2xl shadow-sm">
          <FolderOpen className="w-6 h-6 mx-auto mb-2 text-slate-300" />
          <p className="text-xs font-semibold text-slate-400">No {activeFilter} items found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              isOwner={isOwner(file.id)}
              downloadProgress={downloadProgress}
              onDownload={onDownload}
              onDelete={onDelete}
              onQr={onQr}
              fetchPreviewUrl={fetchPreviewUrl}
              refreshFiles={refreshFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}
