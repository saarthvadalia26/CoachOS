import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CoachOS",
    short_name: "CoachOS",
    description:
      "CoachOS helps coaching institutes manage branches, students, batches, attendance, fees, and staff from one secure dashboard.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8f8fc",
    theme_color: "#3b32b5",
  };
}
