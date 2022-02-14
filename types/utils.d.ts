declare function parseDuration(durationString: string): number | null;

type QualityLabel = 'SD' | 'HD' | 'Full HD' | '4K';

declare function getQualityLabel(videoHeight: number): QualityLabel;

export { parseDuration, getQualityLabel, QualityLabel };
