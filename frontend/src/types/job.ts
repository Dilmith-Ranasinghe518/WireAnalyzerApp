export type JobStatus =
  | "pending"
  | "converting"
  | "detecting_scale"
  | "analyzing"
  | "building_excel"
  | "complete"
  | "error";

export interface WireSegment {
  id: number;
  pixel_length: number;
  length_ft: number;
  length_m: number;
  bbox: [number, number, number, number];
}

export interface ColorResult {
  segments: WireSegment[];
  total_pixel_length: number;
  total_feet: number;
  total_meters: number;
}

export interface JobSummaryColor {
  wire_count: number;
  total_pixels: number;
  total_feet: number;
  total_meters: number;
}

export interface Job {
  job_id: string;
  status: JobStatus;
  progress_message: string;
  filename: string;
  page_count: number;
  created_at: string;
  completed_at: string | null;
  error: string | null;
  scale: {
    raw: string;
    paper_inches: number;
    real_feet: number;
    pixels_per_foot: number;
    pixels_per_meter: number;
    found_in?: string;
  } | null;
  scale_fallback: boolean;
  summary: {
    total_wire_count: number;
    total_pixels: number;
    total_length_feet: number;
    total_length_meters: number;
    by_color: Record<string, JobSummaryColor>;
  } | null;
  pages: Array<{
    page_index: number;
    image_width_px: number;
    image_height_px: number;
    colors: Record<string, ColorResult>;
  }> | null;
}
