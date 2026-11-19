export type ThemeId = 'monograph' | 'obsidian' | 'botanical';
export type GazeZone = 'left' | 'center' | 'right';
export type TonalEcho = 'neutral' | 'warm' | 'heavy';
export type SignalSource = 'bridge' | 'sample' | 'keyboard';

export interface SilhouettePoint {
  x: number;
  y: number;
}

export interface LiveSignalPacket {
  ts: number;
  fps: number;
  faceDetected: boolean;
  blinkCut: boolean;
  longBlinkPause: boolean;
  gaze: GazeZone;
  gazeScalar: number;
  breathSteadiness: number;
  breathRate: number | null;
  breathConfidence: number;
  breathWave: number[];
  echo: TonalEcho;
  silhouette: SilhouettePoint[] | null;
}

export interface CameraEntry {
  id: string;
  name: string;
  facing: string;
  lensType: string;
}

export interface BridgeStatus {
  connected: boolean;
  sdkAvailable: boolean;
  apiKeyConfigured: boolean;
  state: string;
  cameras: CameraEntry[];
  validation: string;
  validationHint: string;
  error: string | null;
  errorCode: string | null;
}

export interface SceneRecord {
  sceneIndex: number;
  roman: string;
  title: string;
  holdSeconds: number;
  blinkCuts: number;
  avgBreathSteadiness: number;
  breathRibbon: number[];
  gazeCounts: {
    left: number;
    center: number;
    right: number;
  };
  dominantEcho: TonalEcho;
  unlockedHiddenCount: number;
}

export interface SessionReport {
  startedAt: string;
  completed: boolean;
  source: SignalSource;
  records: SceneRecord[];
}
