import { useEffect, useState } from "react";
import type { Job } from "../types/job";
import { getJob } from "../api/client";

export function useJobPoller(jobId: string | null, onComplete?: () => void) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setError(null);
      return;
    }

    // Reset error when tracking a new job ID
    setError(null);

    // Initial immediate fetch
    const fetchImmediate = async () => {
      try {
        const data = await getJob(jobId);
        setJob(data);
        if (data.status === "complete") {
          if (onComplete) onComplete();
        }
      } catch (err: any) {
        setError(err.message || "Failed to load job details.");
      }
    };
    fetchImmediate();

    const interval = setInterval(async () => {
      try {
        const data = await getJob(jobId);
        setJob(data);
        if (data.status === "complete" || data.status === "error") {
          clearInterval(interval);
          if (data.status === "complete" && onComplete) {
            onComplete();
          }
        }
      } catch (err: any) {
        console.error("Polling error:", err);
        // Do not crash the app or clear the interval, just log and wait for next interval
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  return { job, setJob, error };
}
