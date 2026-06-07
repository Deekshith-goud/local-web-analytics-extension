import React, { useEffect, useState } from "react";
import type { HistoricalStatsResponse } from "../types/tracking";
import "../style.css";

export default function ReportPage() {
  const [stats, setStats] = useState<HistoricalStatsResponse | null>(null);

  useEffect(() => {
    const startMs = 0;
    const endMs = Date.now();
    chrome.runtime.sendMessage(
      { type: "GET_HISTORICAL_STATS", version: 1, startMs, endMs },
      (res: any) => { setStats(res); }
    );
  }, []);

  return <div>Basic Report Skeleton</div>;
}
