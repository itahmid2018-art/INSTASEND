// Helper to recursively extract files from Drag and Drop DataTransfer with full directory support
export interface ExtractedFileResult {
  file: File;
  relativePath: string;
  isFromFolder: boolean;
  folderName?: string;
}

export async function extractFilesAndFoldersFromDataTransfer(
  dataTransfer: DataTransfer
): Promise<{ results: ExtractedFileResult[]; folderCount: number }> {
  const items = dataTransfer.items;
  const results: ExtractedFileResult[] = [];
  let folderCount = 0;

  // Fallback if DataTransferItemList is not supported
  if (!items || items.length === 0) {
    const rawFiles = Array.from(dataTransfer.files || []);
    return {
      results: rawFiles.map(file => ({
        file,
        relativePath: (file as any).webkitRelativePath || file.name,
        isFromFolder: !!(file as any).webkitRelativePath
      })),
      folderCount: 0
    };
  }

  // Helper to read entries in batches of 100 from FileSystemDirectoryReader
  const readAllEntries = (dirReader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
      const allEntries: FileSystemEntry[] = [];
      const readBatch = () => {
        dirReader.readEntries(
          (batch) => {
            if (batch.length === 0) {
              resolve(allEntries);
            } else {
              allEntries.push(...batch);
              readBatch();
            }
          },
          (err) => reject(err)
        );
      };
      readBatch();
    });
  };

  // Recursive traversal
  const traverse = async (
    entry: FileSystemEntry,
    currentPath = '',
    rootFolderName?: string
  ): Promise<void> => {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(
          (f) => resolve(f),
          (err) => reject(err)
        );
      });

      const relPath = currentPath ? `${currentPath}/${file.name}` : file.name;
      results.push({
        file,
        relativePath: relPath,
        isFromFolder: !!rootFolderName,
        folderName: rootFolderName
      });
    } else if (entry.isDirectory) {
      folderCount++;
      const dirEntry = entry as FileSystemDirectoryEntry;
      const folderName = rootFolderName || dirEntry.name;
      const nextPath = currentPath ? `${currentPath}/${dirEntry.name}` : dirEntry.name;

      const dirReader = dirEntry.createReader();
      const entries = await readAllEntries(dirReader);
      for (const child of entries) {
        await traverse(child, nextPath, folderName);
      }
    }
  };

  const initialEntries: { entry: FileSystemEntry; isRoot: boolean }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        initialEntries.push({ entry, isRoot: true });
      } else {
        const file = item.getAsFile();
        if (file) {
          results.push({
            file,
            relativePath: file.name,
            isFromFolder: false
          });
        }
      }
    }
  }

  for (const { entry } of initialEntries) {
    if (entry.isDirectory) {
      await traverse(entry, '', entry.name);
    } else {
      await traverse(entry, '', undefined);
    }
  }

  return { results, folderCount };
}
