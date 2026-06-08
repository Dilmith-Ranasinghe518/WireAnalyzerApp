import React, { useState } from "react";
import { ChevronDown, ChevronUp, Layers, MapPin, Ruler } from "lucide-react";
import type { Job, ColorResult } from "../types/job";

interface ResultsTableProps {
  job: Job;
  activePageIndex: number;
}

// Convert OpenCV BGR to CSS RGB
const colorMap: Record<string, string> = {
  red: "rgb(230, 60, 50)",
  violet: "rgb(113, 65, 183)",
  rose: "rgb(233, 75, 172)",
  green: "rgb(30, 180, 30)",
  blue: "rgb(40, 120, 255)",
  light_blue: "rgb(0, 140, 200)",
  yellow: "rgb(220, 180, 0)",
};

export const ResultsTable: React.FC<ResultsTableProps> = ({ job, activePageIndex }) => {
  const [expandedColors, setExpandedColors] = useState<Record<string, boolean>>({});

  if (!job.summary || !job.pages) return null;

  const toggleExpand = (color: string) => {
    setExpandedColors((prev) => ({
      ...prev,
      [color]: !prev[color],
    }));
  };

  const { by_color, total_pixels, total_length_feet, total_length_meters } = job.summary;

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Layers className="h-5 w-5 text-indigo-400" />
        <h3 className="text-lg font-bold text-slate-100">Wire Length Measurements</h3>
      </div>

      <div className="gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {Object.entries(by_color).map(([colorName, data]) => {
          const isExpanded = !!expandedColors[colorName];
          const dotColor = colorMap[colorName] || "rgb(148, 163, 184)";
          const pageColors = job.pages?.[activePageIndex]?.colors || {};
          const pageColorData: ColorResult | undefined = pageColors[colorName];
          const segments = pageColorData?.segments || [];

          return (
            <div key={colorName} className="glass flex flex-col rounded-xl border overflow-hidden transition-all duration-200" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {/* Card Header */}
              <div 
                className="px-4 py-3 bg-slate-900/60 border-b flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition-colors"
                style={{ borderBottomColor: 'rgba(255,255,255,0.06)' }}
                onClick={() => toggleExpand(colorName)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: dotColor,
                      boxShadow: `0 0 10px ${dotColor}80`,
                    }}
                  />
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider">{colorName.replace("_", " ")}</h4>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </div>

              {/* Card Body - Console Style summary */}
              <div className="p-4 space-y-3 font-mono text-sm">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Pixels</span>
                  <span className="font-semibold">{data.total_pixels ? data.total_pixels.toFixed(1) : "0.0"}</span>
                </div>
                <div className="flex justify-between items-center text-indigo-300">
                  <span className="text-slate-400">Feet</span>
                  <span className="font-bold text-base">{data.total_feet.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center text-emerald-300">
                  <span className="text-slate-400">Meters</span>
                  <span className="font-bold text-base">{data.total_meters.toFixed(3)}</span>
                </div>
              </div>

              {/* Expandable Segments Table */}
              {isExpanded && (
                <div className="bg-slate-950/80 border-t p-3" style={{ borderTopColor: 'rgba(255,255,255,0.04)' }}>
                  
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Page {activePageIndex + 1} Segments</span>
                    <span className="text-[10px] text-slate-500 font-mono">Count: {segments.length}</span>
                  </div>
                  
                  {segments.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto rounded border border-slate-800 scrollbar-thin">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-900 z-10">
                          <tr className="text-slate-400 border-b border-slate-800">
                            <th className="px-2 py-1.5 font-bold uppercase w-10">ID</th>
                            <th className="px-2 py-1.5 font-bold uppercase text-right">Pixels</th>
                            <th className="px-2 py-1.5 font-bold uppercase text-right">Feet</th>
                            <th className="px-2 py-1.5 font-bold uppercase text-right"><MapPin className="h-3 w-3 inline" /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {segments.map((seg) => (
                            <tr key={seg.id} className="border-b border-slate-800/50 hover:bg-slate-800 text-slate-300 font-mono text-[11px]">
                              <td className="px-2 py-1.5 font-semibold text-slate-400">{colorName[0].toUpperCase()}{seg.id}</td>
                              <td className="px-2 py-1.5 text-right">{seg.pixel_length.toFixed(1)}</td>
                              <td className="px-2 py-1.5 text-right text-indigo-300">{seg.length_ft.toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-right text-slate-500 truncate max-w-[60px]" title={`[${seg.bbox.join(",")}]`}>
                                [{seg.bbox.join(",")}]
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-500 font-mono italic">
                      No {colorName} wires on this page.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>


      {/* Full-size Mask Images Section */}
      <div className="mt-8 space-y-8">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-indigo-400" />
          <h3 className="text-lg font-bold text-slate-100">Color Detection Masks</h3>
        </div>
        
        <div className="gap-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {Object.entries(by_color).map(([colorName, data]) => {
            if (!data.total_pixels) return null; // Skip if no wires detected for this color
            const dotColor = colorMap[colorName] || "rgb(148, 163, 184)";
            const imageUrl = `/runs/${job.job_id}/${job.job_id}_mask_${colorName}.png`;
            return (
              <ZoomableMask key={colorName} colorName={colorName} dotColor={dotColor} imageUrl={imageUrl} />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ZoomableMask = ({ imageUrl, colorName, dotColor }: { imageUrl: string; colorName: string; dotColor: string }) => {
  const [zoom, setZoom] = useState(1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = React.useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleZoomReset = () => setZoom(1);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop
    };
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!scrollContainerRef.current) return;
      e.preventDefault();
      const walkX = (e.clientX - dragStart.current.x);
      const walkY = (e.clientY - dragStart.current.y);
      scrollContainerRef.current.scrollLeft = dragStart.current.scrollLeft - walkX;
      scrollContainerRef.current.scrollTop = dragStart.current.scrollTop - walkY;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const btnStyle = { background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' };

  return (
    <div ref={containerRef} className="glass rounded-xl border border-slate-800 overflow-hidden flex flex-col bg-slate-900 shadow-lg min-w-0">
      <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-3 relative z-10 shrink-0">
        <div className="flex items-center gap-3">
          <span
            className="h-3 w-3 rounded-full shrink-0"
            style={{
              backgroundColor: dotColor,
              boxShadow: `0 0 10px ${dotColor}80`,
            }}
          />
          <h4 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">{colorName.replace("_", " ")} Mask</h4>
        </div>
        
        {/* Zoom controls */}
        <div className="flex items-center bg-slate-950/60 rounded-lg border border-slate-800 p-1">
          <button onClick={handleZoomOut} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors" title="Zoom Out" style={btnStyle}>
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <span className="text-[10px] font-mono font-medium text-slate-400 w-10 text-center select-none" style={{ display: 'inline-block' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={handleZoomIn} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors" title="Zoom In" style={btnStyle}>
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <div className="h-3 w-[1px] bg-slate-700 mx-1" />
          <button onClick={handleZoomReset} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors" title="Reset Zoom" style={btnStyle}>
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
          <div className="h-3 w-[1px] bg-slate-700 mx-1" />
          <button onClick={toggleFullscreen} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors" title="Toggle Fullscreen" style={btnStyle}>
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          </button>
        </div>
      </div>
      
      <div 
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        className={`bg-black p-4 overflow-auto flex-1 flex relative min-h-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ 
          alignItems: zoom > 1 ? 'flex-start' : 'center', 
          justifyContent: zoom > 1 ? 'flex-start' : 'center' 
        }}
      >
        <img 
          src={imageUrl}
          alt={`${colorName} mask`}
          className="transition-all duration-200 ease-out rounded shadow-[0_0_15px_rgba(255,255,255,0.05)] m-auto pointer-events-none select-none"
          draggable="false"
          style={{ 
            width: `${zoom * 100}%`, 
            minWidth: `${zoom * 100}%`,
            height: 'auto', 
            objectFit: 'contain'
          }}
        />
      </div>
    </div>
  );
};
