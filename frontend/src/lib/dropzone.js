/**
 * Drag-and-drop file extraction.
 *
 * `readAllEntries` was previously duplicated verbatim in AppPage.jsx and
 * UploadForm.jsx. The original only read one batch of directory entries;
 * `readEntries` returns at most 100 per call, so this version loops until
 * the reader is drained.
 */

/** Recursively collect every File under a DataTransfer entry (file or directory). */
export async function readAllEntries(entry) {
  if (!entry) return [];

  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file) => resolve([file]),
        () => resolve([]),
      );
    });
  }

  if (entry.isDirectory) {
    const reader = entry.createReader();
    const children = [];

    // readEntries yields max ~100 entries per call and must be drained.
    let batch;
    do {
      batch = await new Promise((resolve) => {
        reader.readEntries(
          (results) => resolve(results),
          () => resolve([]),
        );
      });
      children.push(...batch);
    } while (batch.length > 0);

    const files = [];
    for (const child of children) {
      files.push(...(await readAllEntries(child)));
    }
    return files;
  }

  return [];
}

/**
 * Extract all files from a drop event, recursing into dropped folders.
 * Falls back to `dataTransfer.files` when the entries API is unavailable.
 */
export async function filesFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return [];

  const items = dataTransfer.items;
  if (items && items.length > 0) {
    const entries = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }

    if (entries.length > 0) {
      const files = [];
      for (const entry of entries) {
        files.push(...(await readAllEntries(entry)));
      }
      if (files.length > 0) return files;
    }
  }

  return dataTransfer.files ? Array.from(dataTransfer.files) : [];
}

/** Extract pasted files from a clipboard event. */
export function filesFromClipboard(clipboardData) {
  if (!clipboardData?.items) return [];

  const files = [];
  for (const item of clipboardData.items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  return files;
}
