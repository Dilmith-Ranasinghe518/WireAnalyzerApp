import React from "react";
import { FileSpreadsheet } from "lucide-react";
import type { Job } from "../types/job";
import * as XLSX from "xlsx";

interface DownloadButtonProps {
  job: Job;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({ job }) => {
  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();

    const rows: any[] = [];
    
    // Add Scale Info
    rows.push({
      Color: "SCALE",
      "Wire ID": job.scale?.raw || "N/A",
      Pixels: "",
      "Length (ft)": job.scale?.pixels_per_foot ? `1 ft = ${job.scale.pixels_per_foot} px` : "",
      "Length (m)": job.scale?.pixels_per_meter ? `1 m = ${job.scale.pixels_per_meter} px` : "",
    });
    
    rows.push({}); // Empty row

    let grandTotalPixels = 0;
    let grandTotalFt = 0;
    let grandTotalM = 0;

    if (job.pages && job.pages.length > 0) {
      job.pages.forEach((page) => {
        Object.entries(page.colors).forEach(([color, data]) => {
          // Individual segments
          data.segments.forEach((seg) => {
            rows.push({
              Color: color.toUpperCase(),
              "Wire ID": seg.id,
              Pixels: seg.pixel_length,
              "Length (ft)": seg.length_ft,
              "Length (m)": seg.length_m,
            });
          });

          // Color Subtotal
          rows.push({
            Color: `${color.toUpperCase()} SUBTOTAL`,
            "Wire ID": "",
            Pixels: data.total_pixel_length,
            "Length (ft)": data.total_feet,
            "Length (m)": data.total_meters,
          });
          rows.push({}); // Empty row

          grandTotalPixels += data.total_pixel_length;
          grandTotalFt += data.total_feet;
          grandTotalM += data.total_meters;
        });
      });
    }

    // Grand Total
    rows.push({
      Color: "GRAND TOTAL",
      "Wire ID": "",
      Pixels: grandTotalPixels,
      "Length (ft)": grandTotalFt,
      "Length (m)": grandTotalM,
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Wire Analysis");

    // Auto-size columns loosely
    worksheet["!cols"] = [
      { wch: 18 }, // Color
      { wch: 15 }, // Wire ID
      { wch: 12 }, // Pixels
      { wch: 15 }, // Length (ft)
      { wch: 15 }, // Length (m)
    ];

    XLSX.writeFile(workbook, `${job.filename.replace(/\.[^/.]+$/, "")}_analysis.xlsx`);
  };

  return (
    <button
      onClick={handleDownload}
      className="btn-primary"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        textDecoration: "none",
        padding: "12px 24px",
        borderRadius: "8px",
        fontSize: "14px",
        fontWeight: 600,
        width: "100%",
        textAlign: "center",
      }}
    >
      <FileSpreadsheet className="h-4 w-4" />
      <span>Download Excel Report</span>
    </button>
  );
};
