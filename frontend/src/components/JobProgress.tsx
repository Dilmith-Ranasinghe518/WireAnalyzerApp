import React from "react";
import { Loader2, FileImage, Layers, Search, FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";
import type { Job, JobStatus } from "../types/job";

interface JobProgressProps {
  job: Job;
}

interface Step {
  id: number;
  label: string;
  statuses: JobStatus[];
  icon: React.ComponentType<{ className?: string }>;
}

export const JobProgress: React.FC<JobProgressProps> = ({ job }) => {
  const steps: Step[] = [
    { id: 1, label: "Converting PDF", statuses: ["converting"], icon: FileImage },
    { id: 2, label: "Detecting Scale", statuses: ["detecting_scale"], icon: Search },
    { id: 3, label: "Analyzing Wires", statuses: ["analyzing"], icon: Layers },
    { id: 4, label: "Building Excel", statuses: ["building_excel"], icon: FileSpreadsheet },
    { id: 5, label: "Complete", statuses: ["complete"], icon: CheckCircle2 },
  ];

  const getStepStatus = (step: Step) => {
    if (job.status === "error") {
      // Just flag everything after error as pending, the active one as error
      return "pending";
    }

    const currentIdx = steps.findIndex((s) => s.statuses.includes(job.status));
    const stepIdx = steps.findIndex((s) => s.id === step.id);

    if (job.status === "complete") return "complete";

    if (stepIdx < currentIdx) {
      return "complete";
    } else if (stepIdx === currentIdx) {
      return "active";
    } else {
      return "pending";
    }
  };



  return (
    <div className="w-full max-w-4xl mx-auto p-6 rounded-2xl glass animate-fade-in" style={{ borderRadius: "16px" }}>
      {/* Header Info */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className="text-xs text-indigo-400 font-mono tracking-wider uppercase">Processing Blueprint</span>
          <h2 className="text-lg font-bold text-slate-100 truncate max-w-md">{job.filename}</h2>
        </div>
        <div className="text-right">
          <span className="text-xs text-slate-500 block">Job ID</span>
          <span className="text-xs font-mono text-slate-300">{job.job_id.substring(0, 18)}...</span>
        </div>
      </div>

      {/* Steps Row */}
      <div className="relative flex items-center justify-between gap-4 mb-8" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {/* Background connector line */}
        <div className="absolute left-0 right-0 h-0.5 bg-slate-800 -z-10" style={{ height: "2px", left: "40px", right: "40px", position: "absolute", zIndex: -1 }} />

        {steps.map((step) => {
          const status = getStepStatus(step);
          const Icon = step.icon;

          let iconColor = "text-slate-500 bg-slate-900 border-slate-800";
          let labelColor = "text-slate-500";

          if (status === "complete") {
            iconColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
            labelColor = "text-slate-300";
          } else if (status === "active") {
            iconColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.25)] animate-pulse-glow";
            labelColor = "text-indigo-300 font-semibold";
          }

          return (
            <div key={step.id} className="flex flex-col items-center gap-3 relative z-10 flex-1" style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              {/* Step Circle */}
              <div
                className={`h-12 w-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${iconColor}`}
                style={{
                  height: "48px",
                  width: "48px",
                  borderRadius: "50%",
                  borderWidth: "2px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {status === "active" && job.status !== "error" ? (
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              
              {/* Step Label */}
              <span className={`text-xs text-center transition-all ${labelColor}`} style={{ fontSize: "11px" }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress Footer Panel */}
      {job.status === "error" ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-4 animate-fade-in" style={{ borderRadius: "12px", display: "flex", gap: "16px" }}>
          <XCircle className="h-6 w-6 text-rose-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-400">Analysis Process Interrupted</h4>
            <p className="text-xs text-rose-300/80 leading-relaxed font-mono">{job.error}</p>
            <p className="text-xs text-slate-500 mt-2">Check console logs or verify the input PDF file structure is valid.</p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-900/60 flex items-center justify-between" style={{ borderRadius: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="flex items-center gap-3" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {job.status !== "complete" && <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />}
            <span className="text-sm text-slate-300 font-medium">
              {job.progress_message || "Preparing pipeline components..."}
            </span>
          </div>
          {job.page_count > 0 && (
            <span className="text-xs text-slate-500 px-2 py-1 rounded bg-slate-900 border border-slate-800" style={{ borderRadius: "4px" }}>
              Pages detected: {job.page_count}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
