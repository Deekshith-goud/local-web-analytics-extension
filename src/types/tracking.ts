export type SessionTerminationReason =
  | "tab-switch"
  | "url-change"
  | "idle"
  | "unfocused"
  | "shutdown"
  | "recovery-failed";

export interface ActiveSession {
  sessionId: string;
  domain: string;
  tabId: number | undefined;
  windowId: number | undefined;
  startTime: number;
  lastUpdated: number;
}

export interface ActivityRecord {
  sessionId: string;
  domain: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  terminationReason: SessionTerminationReason;
}

export type TrackingState = "active" | "idle" | "unfocused";

export interface TrackingEvents {
  "session-started": (session: ActiveSession) => void;
  "session-ended": (record: ActivityRecord) => void;
  "idle-state-changed": (state: chrome.idle.IdleState) => void;
}
