import type { Job } from "../types/job";

export interface JobHistoryItem {
  job_id: string;
  filename: string;
  status: string;
  progress_message: string;
  created_at: string;
  completed_at: string | null;
  page_count: number;
  error: string | null;
}

async function saveJob(job: Job) {
  try {
    await fetch("/api/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(job),
    });
  } catch (err) {
    console.error("Failed to save job to backend:", err);
  }
}

export async function listJobs(): Promise<JobHistoryItem[]> {
  try {
    const res = await fetch("/api/jobs");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error("Job not found in database");
  }
  return await res.json();
}

export async function analyzeFile(file: File): Promise<Job> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/analyze", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Failed to upload and analyze schematic.");
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.errors || "Analysis failed");
  }

  if (data.errors && data.errors.trim().length > 0) {
      console.warn("Backend reported errors:", data.errors);
  }

  if (!data.output || data.output.trim() === "") {
      throw new Error(data.errors || "Backend returned empty output");
  }

  const job = parseConsoleOutput(data.output, data.filename);
  await saveJob(job);
  return job;
}

function parseConsoleOutput(stdout: string, filename: string): Job {
  const lines = stdout.split('\n').map(l => l.trimEnd());
  
  const runIdMatch = stdout.match(/Run ID\s*:\s*([a-zA-Z0-9]+)/);
  if (!runIdMatch) {
      throw new Error("Could not parse Run ID from backend output. The analyzer script may have crashed.");
  }
  const jobId = runIdMatch[1];

  const pxFtMatch = stdout.match(/Pixels\/foot\s*:\s*([\d.]+)/);
  const pxMeterMatch = stdout.match(/Pixels\/meter\s*:\s*([\d.]+)/);
  
  const scaleRawMatch = stdout.match(/Scale found\s*:\s*(.+?)\s*\(/);
  const paperInchesMatch = stdout.match(/\(\s*([\d.]+)"\s*=\s*([\d.]+)\s*ft\s*\)/);
  
  const widthMatch = stdout.match(/Image size:\s*(\d+)\s*x\s*(\d+)/);
  
  const grandTotalPxMatch = stdout.match(/Pixel length\s*:\s*([\d.]+)\s*px/);
  const grandTotalLengthMatch = stdout.match(/Real length\s*:\s*([\d.]+)\s*ft\s*\|\s*([\d.]+)\s*m/);

  const job: Job = {
    job_id: jobId,
    status: "complete",
    progress_message: "Done",
    filename: filename,
    page_count: 1,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    error: null,
    scale: {
      raw: scaleRawMatch ? scaleRawMatch[1] : "1/8\"=1'-0\"",
      paper_inches: paperInchesMatch ? parseFloat(paperInchesMatch[1]) : 0.125,
      real_feet: paperInchesMatch ? parseFloat(paperInchesMatch[2]) : 1.0,
      pixels_per_foot: pxFtMatch ? parseFloat(pxFtMatch[1]) : 37.5,
      pixels_per_meter: pxMeterMatch ? parseFloat(pxMeterMatch[1]) : 123.03
    },
    scale_fallback: !scaleRawMatch,
    summary: {
      total_wire_count: 0,
      total_pixels: grandTotalPxMatch ? parseFloat(grandTotalPxMatch[1]) : 0,
      total_length_feet: grandTotalLengthMatch ? parseFloat(grandTotalLengthMatch[1]) : 0,
      total_length_meters: grandTotalLengthMatch ? parseFloat(grandTotalLengthMatch[2]) : 0,
      by_color: {}
    },
    pages: [
      {
        page_index: 0,
        image_width_px: widthMatch ? parseInt(widthMatch[1]) : 2000,
        image_height_px: widthMatch ? parseInt(widthMatch[2]) : 3000,
        colors: {}
      }
    ]
  };

  let currentColor: string | null = null;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const colorMatch = line.match(/^\[([A-Z_]+)\]\s+RGB/);
    if (colorMatch) {
      currentColor = colorMatch[1].toLowerCase();
      inTable = false;
      job.pages![0].colors[currentColor] = {
        segments: [],
        total_pixel_length: 0,
        total_feet: 0,
        total_meters: 0
      };
      job.summary!.by_color[currentColor] = {
        wire_count: 0,
        total_pixels: 0,
        total_feet: 0,
        total_meters: 0
      };
      continue;
    }

    if (currentColor) {
      if (line.includes("ID") && line.includes("Pixels") && line.includes("Feet")) {
        inTable = true;
        continue;
      }

      if (inTable) {
        if (line.trim() === "" || line.startsWith("[") || line.includes("GRAND TOTAL") || line.startsWith("=")) {
          inTable = false;
          continue;
        }

        if (line.trim().startsWith("sub") || line.includes("---")) {
          if (line.trim().startsWith("sub")) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
              const px = parseFloat(parts[1]);
              const ft = parseFloat(parts[2]);
              const m = parseFloat(parts[3]);
              job.pages![0].colors[currentColor].total_pixel_length = px;
              job.pages![0].colors[currentColor].total_feet = ft;
              job.pages![0].colors[currentColor].total_meters = m;

              job.summary!.by_color[currentColor].total_pixels = px;
              job.summary!.by_color[currentColor].total_feet = ft;
              job.summary!.by_color[currentColor].total_meters = m;
            }
          }
          continue;
        }

        const segMatch = line.trim().match(/^([a-zA-Z]+\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+\(([\d,\s]+)\)/);
        if (segMatch) {
          const idStr = segMatch[1].replace(/[a-zA-Z]+/, '');
          const id = parseInt(idStr) || 0;
          const px = parseFloat(segMatch[2]);
          const ft = parseFloat(segMatch[3]);
          const m = parseFloat(segMatch[4]);
          const bboxParts = segMatch[5].split(',').map(s => parseInt(s.trim()));
          
          if (bboxParts.length === 4) {
             job.pages![0].colors[currentColor].segments.push({
               id,
               pixel_length: px,
               length_ft: ft,
               length_m: m,
               bbox: bboxParts as [number, number, number, number]
             });
             job.summary!.total_wire_count++;
             job.summary!.by_color[currentColor].wire_count++;
          }
        }
      }
    }
  }

  return job;
}
