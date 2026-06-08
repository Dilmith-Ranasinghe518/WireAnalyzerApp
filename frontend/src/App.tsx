import { useEffect, useState } from "react";
import { Plus, Clock, CheckCircle2, AlertCircle, RefreshCw, Layers, Sparkles, ShieldCheck, Trash2, Ruler } from "lucide-react";
import { listJobs, getJob, deleteJob } from "./api/client";
import type { JobHistoryItem } from "./api/client";
import type { Job } from "./types/job";
import { UploadZone } from "./components/UploadZone";
import { ResultsTable } from "./components/ResultsTable";
import { ImagePreview } from "./components/ImagePreview";
import { DownloadButton } from "./components/DownloadButton";
import { analyzeFile } from "./api/client";

export default function App() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [history, setHistory] = useState<JobHistoryItem[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

  const fetchHistory = async () => {
    setIsRefreshingHistory(true);
    try {
      const data = await listJobs();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load jobs history list:", err);
    } finally {
      setIsRefreshingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (activeJobId && !isAnalyzing) {
       getJob(activeJobId).then(setJob).catch(console.error);
    } else if (!activeJobId) {
       setJob(null);
    }
  }, [activeJobId, isAnalyzing]);

  const handleUploadSuccess = async (file: File) => {
    setIsAnalyzing(true);
    setActiveJobId("new");
    setJob(null);
    
    try {
      const completedJob = await analyzeFile(file);
      setActiveJobId(completedJob.job_id);
      setJob(completedJob);
      setActivePageIndex(0);
      fetchHistory(); 
    } catch (err) {
      console.error("Analysis Failed", err);
      setActiveJobId("error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectJob = (jobId: string) => {
    setActiveJobId(jobId);
    setActivePageIndex(0);
  };

  const handleStartNewAnalysis = () => {
    setActiveJobId(null);
    setActivePageIndex(0);
  };

  const confirmDelete = async () => {
    if (!jobToDelete) return;
    try {
      await deleteJob(jobToDelete);
      if (activeJobId === jobToDelete) {
        handleStartNewAnalysis();
      }
      fetchHistory();
    } catch (err) {
      console.error("Failed to delete job", err);
    } finally {
      setJobToDelete(null);
    }
  };

  return (
    <div className="main-layout text-slate-100 font-sans" style={{ display: "grid", gridTemplateColumns: "320px 1fr", height: "100vh" }}>
      
      <aside
        className="glass border-r border-slate-900 flex flex-col h-full overflow-hidden"
        style={{
          borderRight: "1px solid rgba(255,255,255,0.06)",
          background: "var(--bg-sidebar)",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <div className="p-6 border-b border-slate-900 flex items-center justify-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2.5" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Layers className="h-6 w-6 text-indigo-400 animate-spin-slow" />
            <div>
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wider">WireAnalyzer</h1>
              <span className="text-[10px] text-indigo-400/80 font-semibold tracking-wider font-mono">FastAPI + React</span>
            </div>
          </div>
          <button
            onClick={fetchHistory}
            className="p-1.5 rounded hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-slate-200 transition-colors"
            disabled={isRefreshingHistory}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingHistory ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-900" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={handleStartNewAnalysis}
            className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
            style={{ width: "100%" }}
          >
            <Plus className="h-4 w-4" />
            <span>New Analysis</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase px-2">
            <Clock className="h-3.5 w-3.5" />
            <span>Recent Drawings</span>
          </div>

          {history.length > 0 ? (
            history.map((hItem) => {
              const isActive = hItem.job_id === activeJobId;
              let statusIcon = <Clock className="h-4 w-4 text-amber-500 shrink-0" />;
              
              if (hItem.status === "complete") {
                statusIcon = <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
              } else if (hItem.status === "error") {
                statusIcon = <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />;
              }

              return (
                <div
                  key={hItem.job_id}
                  onClick={() => handleSelectJob(hItem.job_id)}
                  className={`group p-3.5 rounded-xl border cursor-pointer transition-all duration-200 flex items-center gap-3 hover:translate-x-0.5 ${
                    isActive
                      ? "bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.06)]"
                      : "bg-slate-950/20 border-slate-900 hover:border-slate-800 hover:bg-slate-950/40"
                  }`}
                  style={{
                    borderRadius: "12px",
                    display: "flex",
                    gap: "12px",
                    borderWidth: "1px",
                  }}
                >
                  {statusIcon}
                  <div className="space-y-1 overflow-hidden flex-1" style={{ flex: 1 }}>
                    <h4 className="text-xs font-semibold text-slate-200 truncate">{hItem.filename}</h4>
                    <div className="flex items-center justify-between gap-2 text-[10px]" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="text-slate-500 font-mono">
                        {hItem.created_at ? new Date(hItem.created_at).toLocaleDateString() : ""}
                      </span>
                      <span className={`capitalize font-medium ${
                        hItem.status === "complete"
                          ? "text-emerald-500"
                          : hItem.status === "error"
                          ? "text-rose-500"
                          : "text-indigo-400"
                      }`}>
                        {hItem.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-600 text-xs font-mono italic">
              No recent drawings uploaded yet.
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-900 text-center text-[10px] text-slate-600 flex items-center justify-center gap-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <ShieldCheck className="h-3.5 w-3.5 text-slate-600" />
          <span>Local sandbox environment secure</span>
        </div>
      </aside>

      <main className="workspace-container" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        
        <header className="dashboard-header" style={{ height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px" }}>
          <div>
            <span className="text-xs font-mono text-slate-500">System Dashboard</span>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
              <span>Schematic Blueprint Space</span>
              <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" style={{ height: "8px", width: "8px", borderRadius: "50%" }} />
            <span className="text-xs text-slate-400 font-mono">Backend: http://localhost:8000</span>
          </div>
        </header>

        <div className="workspace-content" style={{ flex: 1, overflowY: "auto", padding: "32px" }}>
          {!activeJobId ? (
            <div className="max-w-4xl mx-auto space-y-8 mt-12">
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-extrabold text-slate-100 tracking-tight">Schematic Wire Length Calculator</h2>
                <p className="text-sm text-slate-400 max-w-xl mx-auto">
                  Automatically parse CAD wire segments from high-resolution schematic blueprint drawings. Extract scales using OCR and export professionalOpenpyxl spreadsheets.
                </p>
              </div>
              {/* Wait, UploadZone takes a File directly now? Let's fix that by passing the new handler */}
              <UploadZone onUploadSuccess={handleUploadSuccess as any} />
            </div>
          ) : isAnalyzing ? (
            <div className="flex flex-col items-center justify-center h-[500px]">
              <ScanningLoader />
            </div>
          ) : activeJobId === "error" ? (
            <div className="max-w-2xl mx-auto mt-12 space-y-6">
              <div className="p-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-center">
                 <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-4" />
                 <h3 className="text-lg font-bold text-slate-200 mb-2">Analysis Failed</h3>
                 <p className="text-sm text-slate-400 mb-6">The backend script returned an error or the format was unreadable.</p>
                 <button onClick={handleStartNewAnalysis} className="btn-secondary px-6 inline-flex">
                   Upload a different blueprint
                 </button>
              </div>
            </div>
          ) : job ? (
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-900" style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <span className="text-xs text-indigo-400 font-mono">Analysis Successful</span>
                  <h2 className="text-2xl font-extrabold text-slate-100">{job.filename}</h2>
                </div>
                <div className="flex items-center gap-3 w-72">
                  <button 
                    onClick={() => setJobToDelete(job.job_id)}
                    className="flex items-center justify-center p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors shrink-0"
                    title="Delete Drawing"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                  <div className="flex-1">
                    <DownloadButton job={job} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: "32px" }}>
                
                <div className="lg:col-span-5 space-y-6" style={{ gridColumn: "span 5 / span 5" }}>
                  <ResultsTable job={job} activePageIndex={activePageIndex} />
                </div>

                <div className="lg:col-span-7" style={{ gridColumn: "span 7 / span 7" }}>
                  <ImagePreview
                    job={job}
                    activePageIndex={activePageIndex}
                    setActivePageIndex={setActivePageIndex}
                  />

                  {/* Grand Total Card */}
                  <div className="glass rounded-xl p-5 border flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'linear-gradient(145deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.7) 100%)' }}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                        <Ruler className="h-5 w-5 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Grand Total</h4>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{job.summary?.total_pixels ? job.summary.total_pixels.toFixed(1) : "0.0"} px</p>
                      </div>
                    </div>
                    <div className="flex gap-6 md:gap-8 font-mono">
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">Feet</span>
                        <span className="text-xl font-bold text-indigo-400">{job.summary?.total_length_feet.toFixed(3) || "0.000"}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-500 uppercase tracking-wider mb-1">Meters</span>
                        <span className="text-xl font-bold text-emerald-400">{job.summary?.total_length_meters.toFixed(3) || "0.000"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] gap-3">
              <LoaderIcon className="h-8 w-8 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-500 font-mono tracking-wider uppercase">Loading job workspace...</span>
            </div>
          )}
        </div>
      </main>

      {jobToDelete && (
        <div 
          style={{ 
            position: "fixed", 
            top: 0, left: 0, right: 0, bottom: 0, 
            zIndex: 99999, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            backgroundColor: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)"
          }}
        >
          <div 
            className="glass" 
            style={{ 
              maxWidth: "400px", 
              width: "100%", 
              padding: "24px", 
              borderRadius: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              background: "#0f172a",
              border: "1px solid #1e293b"
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "16px" }}>
              <div style={{ height: "48px", width: "48px", borderRadius: "50%", background: "rgba(244, 63, 94, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertCircle style={{ height: "24px", width: "24px", color: "#f43f5e" }} />
              </div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "bold", color: "#f8fafc", margin: 0 }}>Delete Drawing</h3>
                <p style={{ fontSize: "14px", color: "#94a3b8", marginTop: "8px", margin: 0 }}>Are you sure you want to delete this drawing? This action cannot be undone.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button 
                onClick={() => setJobToDelete(null)}
                className="btn-secondary"
                style={{ flex: 1, justifyContent: "center" }}
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="btn-primary"
                style={{ flex: 1, justifyContent: "center", background: "#f43f5e", boxShadow: "0 4px 12px rgba(244, 63, 94, 0.2)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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

const ScanningLoader = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
    <div style={{ position: 'relative', width: '220px', height: '220px', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '16px', overflow: 'hidden', background: 'rgba(15, 23, 42, 0.6)', boxShadow: '0 0 30px rgba(99, 102, 241, 0.1)' }}>
      {/* Background Grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(99, 102, 241, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.15) 1px, transparent 1px)', backgroundSize: '20px 20px', backgroundPosition: 'center center' }}></div>
      
      {/* Scanning Line */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, height: '3px',
        background: '#818cf8',
        boxShadow: '0 0 15px #818cf8, 0 0 30px #818cf8',
        animation: 'scan 2s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate'
      }} />

      {/* Center pulsating Icon */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Layers style={{ width: '64px', height: '64px', color: '#818cf8', animation: 'pulse-glow-icon 2s infinite ease-in-out' }} />
      </div>

      <style>
        {`
          @keyframes scan {
            0% { transform: translateY(0); }
            100% { transform: translateY(217px); }
          }
          @keyframes pulse-glow-icon {
            0%, 100% { filter: drop-shadow(0 0 8px rgba(129, 140, 248, 0.4)); transform: scale(1); opacity: 0.8; }
            50% { filter: drop-shadow(0 0 20px rgba(129, 140, 248, 0.9)); transform: scale(1.1); opacity: 1; }
          }
          @keyframes dots {
            0%, 20% { content: "."; }
            40% { content: ".."; }
            60%, 100% { content: "..."; }
          }
          .animated-dots::after {
            content: ".";
            animation: dots 1.5s infinite steps(1);
          }
        `}
      </style>
    </div>
    
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#f8fafc', margin: 0, letterSpacing: '0.025em' }}>
        Analyzing Blueprint<span className="animated-dots"></span>
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <p style={{ fontSize: '13px', color: '#cbd5e1', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Processing CAD Segments & Extracting Scales
        </p>
        <p style={{ fontSize: '11px', color: '#818cf8', fontFamily: 'monospace', textTransform: 'uppercase', margin: 0, opacity: 0.8 }}>
          This may take 1-2 minutes depending on file complexity
        </p>
      </div>
    </div>
  </div>
);
