import React from 'react';
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
  const isOwner = (fileId) => {
    const myUploads = JSON.parse(localStorage.getItem('stash_my_uploads') || '[]');
    return myUploads.includes(fileId);
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

  return (
    <div className="space-y-4 animate-fadeIn">
      {room.files.map((file) => (
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
  );
}
