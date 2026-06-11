export function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  
  if (hrs > 0) {
    const remainingMins = min % 60;
    return `${hrs}h ${remainingMins}m`;
  }
  if (min > 0) {
    const remainingSec = sec % 60;
    return remainingSec > 0 ? `${min}m ${remainingSec}s` : `${min}m`;
  }
  return `${sec}s`;
}

export function formatTimer(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (num: number) => String(num).padStart(2, "0");
  if (hrs > 0) return `${hrs}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}
