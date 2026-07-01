// Pure background-settings types in a leaf module (no runtime imports), so both the
// VideoContext and the useBackgroundSettings hook can share them without importing the
// BackgroundThumbnail component — which consumes the context and would form an import cycle.
export type Thumbnail = 'none' | 'blur' | 'image';

export interface BackgroundSettings {
  type: Thumbnail;
  index?: number;
}
