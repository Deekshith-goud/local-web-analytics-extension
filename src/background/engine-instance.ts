import { TrackingEngine } from "../analytics/tracking-engine";
import { ProductivityClassifier } from "../analytics/productivity-classifier";

export const engine = new TrackingEngine();
export const classifier = new ProductivityClassifier([]);
