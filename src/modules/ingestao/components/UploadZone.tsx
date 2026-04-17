"use client";

import { useRef } from "react";
import { CloudUpload } from "lucide-react";

interface UploadZoneProps {
  onFile: (file: File) => void;
}

export function UploadZone({ onFile }: UploadZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="bg-surface-container-lowest rounded-[1.5rem] shadow-sm border-2 border-dashed border-outline-variant/30 p-12 text-center cursor-pointer hover:border-primary/40 hover:bg-surface-container-low/30 transition-all"
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <CloudUpload className="w-6 h-6 text-primary" />
      </div>
      <p className="font-bold text-on-surface">Arrastar ficheiro ou clicar para selecionar</p>
      <p className="text-xs text-on-surface-variant mt-1">CSV, XLS, XLSX · máx. 10MB</p>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xls,.xlsx"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
