export type InspectionType = 'move-in' | 'move-out';

export type Severity = 'minor' | 'moderate' | 'significant' | 'unclear';

export type ConfidenceLevel = 'high' | 'moderate' | 'low';

export type ReviewStatus = 'unreviewed' | 'confirmed' | 'edited' | 'dismissed';

export type ObservationCategory = 'potential-damage' | 'condition-observation';

export type ComparisonClassification =
  | 'Potentially pre-existing'
  | 'Potentially new'
  | 'No clear change'
  | 'Insufficient evidence';

export type EvidenceAlignment =
  | 'supports-pre-existing'
  | 'mixed-or-unclear'
  | 'supports-new-change'
  | 'insufficient-evidence';

export interface UserObservationEdit {
  room?: string;
  objectOrSurface?: string;
  visibleCondition?: string;
  severity?: Severity;
  note?: string;
  editedAt: string;
}

export interface Observation {
  id: string;
  inspectionType: InspectionType;
  category?: ObservationCategory;
  room: string;
  objectOrSurface: string;
  visibleCondition: string;
  abnormalityDetail?: string;
  timestampSeconds: number;
  severity: Severity;
  confidence: ConfidenceLevel;
  uncertaintyNote?: string;
  reviewStatus: ReviewStatus;
  source: 'ai' | 'sample-precomputed' | 'manual';
  thumbnailDataUrl?: string;
  userEdit?: UserObservationEdit;
  reviewedAt?: string;
}

export interface VideoMetadata {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds: number;
  width?: number;
  height?: number;
  sha256: string;
  lastModifiedIso?: string;
  recordedOrUploadedAt: string;
  objectUrl?: string;
  serverFileId?: string;
  serverAccessToken?: string;
  analysisSource: 'gemini-live' | 'sample-precomputed' | 'pending' | 'error';
  analysisModel?: string;
  analyzedAt?: string;
  analysisError?: string;
  analysisErrorAt?: string;
}

export interface ComparisonItem {
  id: string;
  room: string;
  areaOrSurface: string;
  classification: ComparisonClassification;
  moveInTimestampSeconds: number | null;
  moveOutTimestampSeconds: number | null;
  moveInSummary: string;
  moveOutSummary: string;
  reasoning: string;
  visibilityCaveat?: string;
  linkedMoveInObservationId?: string;
  linkedMoveOutObservationId?: string;
  moveInThumbnailDataUrl?: string;
  moveOutThumbnailDataUrl?: string;
}

export interface ClaimTimestampRef {
  inspectionType: InspectionType;
  timestampSeconds: number;
  label: string;
  observationId?: string;
}

export interface ClaimMatch {
  id: string;
  claimText: string;
  amountUsd: number | null;
  matchedObservationIds: string[];
  matchedComparisonIds: string[];
  assessmentSummary: string;
  evidenceAlignment: EvidenceAlignment;
  keyTimestamps: ClaimTimestampRef[];
  limitationsNote: string;
  createdAt: string;
  source: 'gemini-live' | 'sample-precomputed';
}

export interface ReconsiderationDraft {
  recipientName: string;
  subject: string;
  body: string;
  generatedAt?: string;
  source?: 'gemini-live' | 'sample-precomputed' | 'edited';
}

export interface ApartmentRecord {
  id: string;
  isSample: boolean;
  unitName: string;
  cityState: string;
  landlordOrManagement: string;
  leaseStart: string;
  leaseEnd: string;
  securityDepositUsd: number;
  createdAt: string;
  moveInVideo?: VideoMetadata;
  moveOutVideo?: VideoMetadata;
  observations: Observation[];
  comparisons: ComparisonItem[];
  claims: ClaimMatch[];
  reconsiderationDraft: ReconsiderationDraft;
}

export type AppScreen =
  | 'landing'
  | 'overview'
  | 'move-in'
  | 'move-out'
  | 'compare'
  | 'claims'
  | 'reconsideration'
  | 'report';
