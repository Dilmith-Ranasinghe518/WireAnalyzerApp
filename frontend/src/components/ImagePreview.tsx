import React, { useState } from "react";
import { ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight, Ruler, AlertTriangle, Eye } from "lucide-react";
import type { Job } from "../types/job";

interface ImagePreviewProps {
  job: Job;
  activePageIndex: number;
  setActivePageIndex: (index: number) => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  job,
  activePageIndex,
  setActivePageIndex,
}) => {
  const [zoom, setZoom] = useState(1);
  const [isImageLoading, setIsImageLoading] = useState(true);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  const handlePrevPage = () => {
    if (activePageIndex > 0) {
      setIsImageLoading(true);
      setActivePageIndex(activePageIndex - 1);
    }
  };

  const handleNextPage = () => {
    if (job.page_count && activePageIndex < job.page_count - 1) {
      setIsImageLoading(true);
      setActivePageIndex(activePageIndex + 1);
    }
  };

  const imageUrl = `/runs/${job.job_id}/${job.job_id}_annotated.png`;

  return (
    <div className="w-full space-y-4 animate-fade-in">
      {/* Top Controller Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl glass" style={{ borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        
        {/* Scale Badge */}
        <div className="flex items-center gap-3">
          <Ruler className="h-5 w-5 text-indigo-400" />
          {job.scale_fallback ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold animate-pulse-glow" style={{ borderRadius: "8px" }}>
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Fallback Scale Used: 1/8"=1'-0"</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold" style={{ borderRadius: "8px" }}>
              <Ruler className="h-3.5 w-3.5" />
              <span>
                Detected Scale: {job.scale?.raw || "1/8\"=1'-0\""} ({job.scale?.pixels_per_foot.toFixed(1)} px/ft)
              </span>
            </div>
          )}
        </div>

        {/* Zoom & Page Actions */}
        <div className="flex items-center gap-4" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-950/60 rounded-lg border border-slate-900 p-1" style={{ borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center" }}>
            <button
              onClick={handleZoomOut}
              className="p-1.5 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs font-mono font-medium text-slate-400 w-12 text-center select-none" style={{ width: "48px", textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="h-4 w-[1px] bg-slate-800 mx-1" style={{ width: "1px", height: "16px", backgroundColor: "rgba(255,255,255,0.06)", margin: "0 4px" }} />
            <button
              onClick={handleZoomReset}
              className="p-1.5 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-200 transition-colors"
              title="Reset Zoom"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Multipage selectors */}
          {job.page_count > 1 && (
            <div className="flex items-center bg-slate-950/60 rounded-lg border border-slate-900 p-1" style={{ borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center" }}>
              <button
                onClick={handlePrevPage}
                disabled={activePageIndex === 0}
                className="p-1.5 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-slate-300 px-2 select-none">
                Page {activePageIndex + 1} of {job.page_count}
              </span>
              <button
                onClick={handleNextPage}
                disabled={activePageIndex === job.page_count - 1}
                className="p-1.5 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Drawing Canvas Container */}
      <div
        className="w-full h-[600px] rounded-xl border border-slate-900 bg-slate-950/40 relative overflow-auto cursor-grab active:cursor-grabbing flex items-start justify-center p-8"
        style={{
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.06)",
          height: "600px",
          overflow: "auto",
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {isImageLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-20 gap-3" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <LoaderIcon className="h-8 w-8 text-indigo-500 animate-spin" />
            <span className="text-xs text-slate-400 font-mono tracking-wider uppercase">Loading Drawing Overlay...</span>
          </div>
        )}

        {/* Drawing Image overlay with Zoom scale */}
        <div
          className="transition-transform duration-200 ease-out origin-top flex items-center justify-center w-full h-full"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <img
            src={imageUrl}
            alt={`Annotated blueprint - Page ${activePageIndex + 1}`}
            onLoad={() => setIsImageLoading(false)}
            className="rounded shadow-2xl border border-slate-800"
            style={{
              maxWidth: zoom === 1 ? "100%" : "none",
              maxHeight: zoom === 1 ? "100%" : "none",
              objectFit: "contain",
              borderRadius: "4px",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 justify-center text-xs text-slate-500 italic">
        <Eye className="h-3.5 w-3.5" />
        <span>Wires are colored with transparent fills matching the table above. Hover/zoom to see coordinates and IDs.</span>
      </div>
    </div>
  );
};

// Local loader helper
const LoaderIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
