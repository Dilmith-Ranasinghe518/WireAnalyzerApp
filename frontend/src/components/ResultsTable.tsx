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

      {/* Grand Total Card */}
      <div className="glass rounded-xl p-5 border flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'linear-gradient(145deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.7) 100%)' }}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <Ruler className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Grand Total</h4>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{total_pixels ? total_pixels.toFixed(1) : "0.0"} px</p>
          </div>
        </div>
        <div className="flex gap-6 md:gap-8 font-mono">
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">Feet</span>
            <span className="text-xl font-bold text-indigo-400">{total_length_feet.toFixed(3)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">Meters</span>
            <span className="text-xl font-bold text-emerald-400">{total_length_meters.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Full-size Mask Images Section */}
      <div className="mt-8 space-y-8">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-indigo-400" />
          <h3 className="text-lg font-bold text-slate-100">Color Detection Masks</h3>
        </div>
        
        <div className="space-y-8">
          {Object.entries(by_color).map(([colorName, data]) => {
            if (!data.total_pixels) return null; // Skip if no wires detected for this color
            return (
              <div key={colorName} className="glass rounded-xl border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: colorMap[colorName] || "rgb(148, 163, 184)",
                      boxShadow: `0 0 10px ${colorMap[colorName] || "rgb(148, 163, 184)"}80`,
                    }}
                  />
                  <h4 className="font-bold text-slate-200 uppercase tracking-wider">{colorName.replace("_", " ")} Mask</h4>
                </div>
                <div className="bg-black p-4 overflow-auto">
                  <img 
                    src={`/runs/${job.job_id}/${job.job_id}_mask_${colorName}.png`}
                    alt={`${colorName} mask`}
                    className="w-full h-auto rounded"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
