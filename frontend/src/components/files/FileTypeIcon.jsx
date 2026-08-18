import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
} from "lucide-react";
import { getExtension, getFileKind } from "@/lib/fileTypes";
import { cn } from "@/lib/utils";

/**
 * Type tile for files with no visual preview.
 *
 * Deliberately monochrome: the glyph plus the extension label is the
 * differentiator, not colour. Tinting every document kind would turn a grid
 * into a rainbow and steal salience from the red action affordances.
 */

const ICONS = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  pdf: FileText,
  doc: FileText,
  text: FileText,
  sheet: FileSpreadsheet,
  slides: Presentation,
  code: FileCode,
  archive: FileArchive,
  other: File,
};

export default function FileTypeIcon({
  file,
  kind: kindProp,
  size = "md",
  showExtension = true,
  className,
}) {
  const kind = kindProp ?? getFileKind(file);
  const Icon = ICONS[kind] ?? File;
  const extension = getExtension(file?.filename);

  const isCompact = size === "sm";

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center gap-1 bg-slate-100 text-slate-500",
        isCompact ? "size-10 rounded-lg" : "size-full rounded-none",
        className,
      )}
    >
      <Icon
        className={isCompact ? "size-4" : "size-7"}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      {showExtension && extension && !isCompact && (
        <span className="max-w-full truncate px-2 font-mono text-3xs font-semibold text-slate-400">
          {extension.toUpperCase()}
        </span>
      )}
    </div>
  );
}
