import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Upload,
  ChevronDown,
  ChevronUp,
  Lock,
  Clock,
  Flame,
  Download,
  Eye,
  EyeOff,
} from "lucide-react";

export default function UploadForm({
  uploadFile,
  isUploading,
  uploadProgress,
}) {
  const [files, setFiles] = useState([]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [expiresIn, setExpiresIn] = useState("20");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [burnAfterDownload, setBurnAfterDownload] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [description, setDescription] = useState("");

  const fileInputRef = useRef(null);

  const formatBytes = (bytes, decimals = 1) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const readAllEntries = async (entry) => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((f) => resolve([f]));
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = await new Promise((resolve) => {
        dirReader.readEntries((results) => resolve(results));
      });
      const allFiles = [];
      for (const child of entries) {
        const childFiles = await readAllEntries(child);
        allFiles.push(...childFiles);
      }
      return allFiles;
    }
    return [];
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const allFiles = [];
      const entries = [];

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }

      if (entries.length > 0) {
        for (const entry of entries) {
          const files = await readAllEntries(entry);
          allFiles.push(...files);
        }
      }

      if (allFiles.length > 0) {
        setFiles(allFiles);
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        setFiles(Array.from(e.dataTransfer.files));
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) return;

    const res = await uploadFile(files, {
      password,
      expiresIn,
      maxDownloads: burnAfterDownload ? "1" : maxDownloads,
      description,
    });

    if (res) {
      toast.success("Files stashed successfully!");
      setFiles([]);
      setPassword("");
      setExpiresIn("20");
      setMaxDownloads("");
      setBurnAfterDownload(false);
      setShowAdvanced(false);
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      toast.error("Upload failed");
    }
  };

  return (
    <form
      onSubmit={handleUploadSubmit}
      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-full flex flex-col justify-between min-h-[340px]"
      onDragEnter={handleDrag}
    >
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-50 hover:bg-slate-100/50 flex-grow flex-1 ${
          dragActive
            ? "border-red-400 bg-red-50/50"
            : files.length > 0
              ? "border-red-300 bg-red-50/20"
              : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload
          className={`w-6 h-6 mb-2 transition-colors ${dragActive || files.length > 0 ? "text-red-500 animate-bounce" : "text-slate-400"}`}
        />
        <span className="text-xs font-semibold text-slate-700 text-center truncate max-w-xs px-2">
          {files.length > 0
            ? files.length === 1
              ? files[0].name
              : `${files.length} items ready to stash`
            : "Drag files or select to upload"}
        </span>
        <span className="text-[10px] text-slate-400 mt-1 font-mono">
          {files.length > 0
            ? formatBytes(files.reduce((acc, f) => acc + f.size, 0))
            : "Max total archive size 100MB"}
        </span>
      </div>

      {files.length > 0 && (
        <div className="space-y-4 pt-2">
          {uploadProgress?.status === "uploading" && (
            <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3">
              <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold mb-2">
                <span>Uploading {uploadProgress.fileName}</span>
                <span>{uploadProgress.percent}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-500 transition-all duration-150"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          )}
          {/* Collapsible advanced security config */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full text-[10px] uppercase tracking-wider font-bold text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1">Advanced Settings</span>
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showAdvanced && (
            <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-slideDown">
              {/* Burn limit toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 font-semibold flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-orange-500" />
                  Burn after download
                </span>
                <button
                  type="button"
                  onClick={() => setBurnAfterDownload(!burnAfterDownload)}
                  className={`relative inline-flex h-4.5 w-8.5 items-center rounded-full transition-colors duration-300 focus:outline-none cursor-pointer ${
                    burnAfterDownload ? "bg-orange-550" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 ${
                      burnAfterDownload ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* File Description */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="text-slate-500 text-[10px] leading-none">
                    📝
                  </span>
                  File Description
                </label>
                <Input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional note / description about this file"
                  className="bg-white border-slate-200 text-slate-850 text-xs focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {/* Password configuration */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  Access Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Optional decryption password"
                    className="bg-white border-slate-200 text-slate-850 text-xs pr-10 focus:ring-red-500 focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expiration Configuration */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  Auto-Destroy Expiration
                </label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs outline-none text-slate-650 focus:border-red-500 cursor-pointer"
                >
                  <option value="5">5 Minutes</option>
                  <option value="20">20 Minutes</option>
                  <option value="60">1 Hour</option>
                </select>
              </div>

              {/* Max Download Limit */}
              {!burnAfterDownload && (
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    Max download limit
                  </label>
                  <Input
                    type="number"
                    value={maxDownloads}
                    onChange={(e) => setMaxDownloads(e.target.value)}
                    placeholder="e.g. 5 (Optional)"
                    min="1"
                    className="bg-white border-slate-200 text-slate-855 text-xs focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Submission button with loading indicator spinner */}
          <Button
            type="submit"
            disabled={isUploading}
            className="w-full font-bold cursor-pointer bg-red-500 hover:bg-red-600 text-white shadow-sm"
          >
            {isUploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Uploading items...
              </span>
            ) : burnAfterDownload ? (
              "Stash & Burn"
            ) : (
              "Stash Archive"
            )}
          </Button>
        </div>
      )}
    </form>
  );
}
