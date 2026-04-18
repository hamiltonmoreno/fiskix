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
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-dashed border-gray-200 dark:border-gray-700/60 p-12 text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-all duration-300 group"
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <div className="w-14 h-14 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center mx-auto mb-5 group-hover:scale-110 transition-transform duration-300">
        <CloudUpload className="w-7 h-7 text-blue-600 dark:text-blue-400" />
      </div>
      <p className="font-bold text-gray-800 dark:text-gray-100 text-lg">Arrastar ficheiro ou clicar</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Formatos aceites: CSV, XLS, XLSX · máx. 10MB</p>
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
