import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, AlertTriangle, Loader2 } from "lucide-react";

interface UploadZoneProps {
  onUploadSuccess: (file: File) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onUploadSuccess }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setIsUploading(true);
      setError(null);

      try {
        onUploadSuccess(file);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Something went wrong during PDF upload.");
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"]
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 animate-fade-in">
      <div
        {...getRootProps()}
        className={`glass glass-hover p-12 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed text-center cursor-pointer transition-all duration-300 min-h-[300px] ${
          isDragActive
            ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)] scale-[1.01]"
            : "border-slate-800 bg-slate-950/20 hover:border-slate-700"
        } ${isUploading ? "pointer-events-none opacity-60" : ""}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          borderStyle: "dashed",
          borderRadius: "16px",
          cursor: isUploading ? "default" : "pointer",
        }}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-indigo-500 animate-spin" />
            <h3 className="text-xl font-semibold text-slate-200">Preparing file...</h3>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full bg-slate-900 border border-slate-800 text-indigo-400 transition-transform ${isDragActive ? "scale-110" : "group-hover:scale-105"}`}>
              <UploadCloud className="h-10 w-10" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-slate-100">
                {isDragActive ? "Drop your blueprint here" : "Upload blueprint drawing"}
              </h3>
              <p className="text-sm text-slate-400 max-w-sm">
                Drag and drop your technical layout blueprint here, or click to browse files
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 px-3 py-1.5 rounded-full bg-slate-950/50 border border-slate-900 mt-2">
              <FileText className="h-3.5 w-3.5" />
              <span>PDF and images supported</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-start gap-3 animate-fade-in" style={{ borderRadius: "12px", display: "flex", gap: "12px" }}>
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">Upload failed</h4>
            <p className="text-xs text-rose-300/80">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};
