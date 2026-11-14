import type {
  ApartmentRecord,
  ComparisonClassification,
  ComparisonItem,
  ConfidenceLevel,
  EvidenceAlignment,
  InspectionType,
  Observation,
  ObservationCategory,
  Severity,
} from '../types/baseline';

export function formatTimestamp(seconds: number, includeTenths = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) return includeTenths ? '00:00.0' : '00:00';
  if (includeTenths) {
    const roundedTenths = Math.round(seconds * 10);
    const totalSecs = Math.floor(roundedTenths / 10);
    const tenths = roundedTenths % 10;
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
  }
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatCurrencyUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 'Amount unspecified';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function parseClaimInput(raw: string): {
  description: string;
  amountUsd: number | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { description: '', amountUsd: null };
  }
  const match = trimmed.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/);
  let amountUsd: number | null = null;
  if (match && match[1]) {
    const parsed = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(parsed) && parsed >= 0) {
      amountUsd = parsed;
    }
  }
  return {
    description: trimmed,
    amountUsd,
  };
}

const VALID_SEVERITIES = new Set<Severity>(['minor', 'moderate', 'significant', 'unclear']);
const VALID_CONFIDENCE = new Set<ConfidenceLevel>(['high', 'moderate', 'low']);

export function normalizeSeverity(value: unknown): Severity {
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase() as Severity;
    if (VALID_SEVERITIES.has(lower)) return lower;
  }
  return 'unclear';
}

export function normalizeConfidence(value: unknown): ConfidenceLevel {
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase() as ConfidenceLevel;
    if (VALID_CONFIDENCE.has(lower)) return lower;
  }
  return 'moderate';
}

export function clampTimestamp(seconds: unknown, durationSeconds?: number): number {
  const num = typeof seconds === 'number' ? seconds : Number(seconds);
  if (!Number.isFinite(num) || num < 0) return 0;
  if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    return Math.min(Math.round(num * 10) / 10, Math.max(0, Math.round((durationSeconds - 0.1) * 10) / 10));
  }
  return Math.round(num * 10) / 10;
}

export function getObservationCategory(
  obs: Pick<Observation, 'category'>
): ObservationCategory {
  return obs.category === 'condition-observation' ? 'condition-observation' : 'potential-damage';
}

export function normalizeObservationCategory(value: unknown): ObservationCategory | undefined {
  if (typeof value !== 'string') return undefined;
  const norm = value.trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (norm === 'condition-observation' || norm === 'condition' || norm === 'coverage' || norm === 'intact') {
    return 'condition-observation';
  }
  if (norm === 'potential-damage' || norm === 'damage' || norm === 'defect') {
    return 'potential-damage';
  }
  return undefined;
}

const NEGATED_DEFECT_CLAUSE_RE =
  /\b(?:no|without|free\s+of|absent\s+of|not\s+showing|none\s+of)\s+(?:any\s+)?(?:visible\s+|obvious\s+|apparent\s+|clear\s+)?(?:damage|defects?|scratches|scuffs|cracks|stains|dents|holes|chips|issues|wear|marks|abrasions|discoloration)\b/gi;

const POSITIVE_DEFECT_EVIDENCE_RE =
  /\b(?:scratch(?:ed|es|ing)?|scuff(?:ed|s|ing)?|crack(?:ed|s|ing)?|stain(?:ed|s|ing)?|dent(?:ed|s)?|hole(?:s)?|chip(?:ped|s|ping)?|corrosi(?:on|ve)|rust(?:ed|y|ing)?|water\s*(?:damage|mark|stain|ring|leak)|leak(?:ing|s)?|mold|mildew|peel(?:ing|ed)?|flak(?:ing|ed)|bubbl(?:ing|ed)|warp(?:ed|ing)?|gouge(?:d|s)?|tear(?:s|ing)?|torn|ripped|burn(?:t|ed|s)?|scorch(?:ed)?|broken|shattered|loose\s+(?:handle|hinge|bracket|bar|fixture|knob|tile|outlet|trim|board|plank)|missing\s+(?:piece|tile|cover|screw|cap|hardware|paint|trim)|nail[- ]?pop|discolor(?:ed|ation)|rub\s*mark|dark\s*mark|smudge|abrasion|split|splinter(?:ed|ing)?|swollen|rot(?:ted|ting)?|pitting|damaged)\b/i;

const INTACT_OR_NORMAL_RE =
  /\b(?:appears?\s+intact|looks?\s+intact|is\s+intact|clean\s+and\s+intact|appears?\s+clean|looks?\s+clean|normal\s+(?:condition|appearance|doorway|fixture|feature|wall|floor|room|finish)|good\s+condition|undamaged|well[- ]maintained|in\s+working\s+order|no\s+(?:visible\s+)?(?:damage|defects?|issues?)\s*(?:seen|visible|observed|detected)?)\b/i;

const UNASSESSABLE_VIEW_RE =
  /\b(?:too\s+(?:distant|far|dark|dim|blurry)|cannot\s+(?:be\s+)?(?:assessed|determined|inspected|verified)|unable\s+to\s+(?:assess|determine|inspect|verify|see\s+clearly)|obscured\s+by\s+(?:shadow|lighting|furniture|glare|distance)|inaccessible|out\s+of\s+focus|motion\s+blur\s+prevents|insufficient\s+(?:lighting|detail|resolution|visibility))\b/i;

/**
 * Strictly separates potential physical damage from ordinary room descriptions,
 * intact surfaces, normal features, or unassessable/distant/shadowed areas.
 */
export function classifyObservationConservatively(input: {
  rawCategory?: unknown;
  visibleCondition: string;
  abnormalityDetail?: string;
  severity: Severity;
}): ObservationCategory {
  const explicit = normalizeObservationCategory(input.rawCategory);
  if (explicit === 'condition-observation') {
    return 'condition-observation';
  }

  const combined = `${input.visibleCondition} ${input.abnormalityDetail || ''}`.trim();
  const withoutNegated = combined.replace(NEGATED_DEFECT_CLAUSE_RE, ' ');
  const hasPositiveDefect = POSITIVE_DEFECT_EVIDENCE_RE.test(withoutNegated);

  // Unassessable views (too distant, heavy shadow, obscured by furniture) without a clear defect
  if (UNASSESSABLE_VIEW_RE.test(combined) && !hasPositiveDefect) {
    return 'condition-observation';
  }

  // Unclear severity without identifiable defect evidence cannot be flagged as damage
  if (input.severity === 'unclear' && !hasPositiveDefect) {
    return 'condition-observation';
  }

  // Intact/normal descriptions without a non-negated physical defect
  if (INTACT_OR_NORMAL_RE.test(combined) && !hasPositiveDefect) {
    return 'condition-observation';
  }

  // Require at least one identifiable defect signal before creating a potential-damage finding
  if (!hasPositiveDefect) {
    return 'condition-observation';
  }

  return 'potential-damage';
}

export function validateAndNormalizeObservations(
  rawItems: unknown,
  inspectionType: InspectionType,
  durationSeconds?: number,
  source: 'ai' | 'sample-precomputed' | 'manual' = 'ai'
): Observation[] {
  if (!Array.isArray(rawItems)) return [];
  const results: Observation[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const room = typeof rec.room === 'string' ? rec.room.trim() : '';
    const objectOrSurface =
      typeof rec.objectOrSurface === 'string' ? rec.objectOrSurface.trim() : '';
    const visibleCondition =
      typeof rec.visibleCondition === 'string' ? rec.visibleCondition.trim() : '';

    if (!room || !objectOrSurface || !visibleCondition) continue;

    const timestampSeconds = clampTimestamp(rec.timestampSeconds, durationSeconds);
    const severity = normalizeSeverity(rec.severity);
    const confidence = normalizeConfidence(rec.confidence);
    const uncertaintyNote =
      typeof rec.uncertaintyNote === 'string' && rec.uncertaintyNote.trim().length > 0
        ? rec.uncertaintyNote.trim()
        : undefined;
    const abnormalityDetail =
      typeof rec.abnormalityDetail === 'string' && rec.abnormalityDetail.trim().length > 0
        ? rec.abnormalityDetail.trim()
        : undefined;

    const category: ObservationCategory =
      source === 'ai'
        ? classifyObservationConservatively({
            rawCategory: rec.category,
            visibleCondition,
            abnormalityDetail,
            severity,
          })
        : normalizeObservationCategory(rec.category) || 'potential-damage';

    results.push({
      id: `${inspectionType}-obs-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      inspectionType,
      category,
      room,
      objectOrSurface,
      visibleCondition,
      ...(category === 'potential-damage' && abnormalityDetail ? { abnormalityDetail } : {}),
      timestampSeconds,
      severity,
      confidence,
      uncertaintyNote,
      reviewStatus: 'unreviewed',
      source,
    });
  }

  return results.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
}

const VALID_CLASSIFICATIONS: ComparisonClassification[] = [
  'Potentially pre-existing',
  'Potentially new',
  'No clear change',
  'Insufficient evidence',
];

export function normalizeComparisonClassification(value: unknown): ComparisonClassification {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    const matched = VALID_CLASSIFICATIONS.find((c) => c.toLowerCase() === trimmed);
    if (matched) return matched;
    if (trimmed.includes('pre-existing') || trimmed.includes('preexisting')) {
      return 'Potentially pre-existing';
    }
    if (trimmed.includes('new')) return 'Potentially new';
    if (trimmed.includes('no clear') || trimmed.includes('unchanged') || trimmed.includes('same')) {
      return 'No clear change';
    }
  }
  return 'Insufficient evidence';
}

export function validateAndNormalizeComparisons(
  rawItems: unknown,
  moveInDuration?: number,
  moveOutDuration?: number
): ComparisonItem[] {
  if (!Array.isArray(rawItems)) return [];
  const items: ComparisonItem[] = [];

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const room = typeof rec.room === 'string' ? rec.room.trim() : '';
    const areaOrSurface = typeof rec.areaOrSurface === 'string' ? rec.areaOrSurface.trim() : '';
    const reasoning = typeof rec.reasoning === 'string' ? rec.reasoning.trim() : '';
    if (!room || !areaOrSurface || !reasoning) continue;

    const moveInTimestampSeconds =
      rec.moveInTimestampSeconds === null || rec.moveInTimestampSeconds === undefined
        ? null
        : clampTimestamp(rec.moveInTimestampSeconds, moveInDuration);
    const moveOutTimestampSeconds =
      rec.moveOutTimestampSeconds === null || rec.moveOutTimestampSeconds === undefined
        ? null
        : clampTimestamp(rec.moveOutTimestampSeconds, moveOutDuration);

    items.push({
      id: `cmp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      room,
      areaOrSurface,
      classification: normalizeComparisonClassification(rec.classification),
      moveInTimestampSeconds,
      moveOutTimestampSeconds,
      moveInSummary:
        typeof rec.moveInSummary === 'string' && rec.moveInSummary.trim()
          ? rec.moveInSummary.trim()
          : 'Not clearly documented in move-in footage.',
      moveOutSummary:
        typeof rec.moveOutSummary === 'string' && rec.moveOutSummary.trim()
          ? rec.moveOutSummary.trim()
          : 'Not clearly documented in move-out footage.',
      reasoning,
      visibilityCaveat:
        typeof rec.visibilityCaveat === 'string' && rec.visibilityCaveat.trim()
          ? rec.visibilityCaveat.trim()
          : undefined,
      linkedMoveInObservationId:
        typeof rec.linkedMoveInObservationId === 'string' ? rec.linkedMoveInObservationId : undefined,
      linkedMoveOutObservationId:
        typeof rec.linkedMoveOutObservationId === 'string' ? rec.linkedMoveOutObservationId : undefined,
    });
  }

  return items;
}

const VALID_ALIGNMENTS = new Set<EvidenceAlignment>([
  'supports-pre-existing',
  'mixed-or-unclear',
  'supports-new-change',
  'insufficient-evidence',
]);

export function normalizeEvidenceAlignment(value: unknown): EvidenceAlignment {
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase() as EvidenceAlignment;
    if (VALID_ALIGNMENTS.has(lower)) return lower;
  }
  return 'insufficient-evidence';
}

export function getEffectiveObservation(obs: Observation): {
  room: string;
  objectOrSurface: string;
  visibleCondition: string;
  severity: Severity;
  hasUserEdit: boolean;
} {
  if (!obs.userEdit) {
    return {
      room: obs.room,
      objectOrSurface: obs.objectOrSurface,
      visibleCondition: obs.visibleCondition,
      severity: obs.severity,
      hasUserEdit: false,
    };
  }
  return {
    room: obs.userEdit.room ?? obs.room,
    objectOrSurface: obs.userEdit.objectOrSurface ?? obs.objectOrSurface,
    visibleCondition: obs.userEdit.visibleCondition ?? obs.visibleCondition,
    severity: obs.userEdit.severity ?? obs.severity,
    hasUserEdit: true,
  };
}

export function findNearestObservation(
  observations: Observation[],
  inspectionType: InspectionType,
  timestampSeconds: number,
  toleranceSeconds = 1.5
): Observation | null {
  const candidates = observations.filter(
    (o) => o.inspectionType === inspectionType && o.reviewStatus !== 'dismissed'
  );
  let best: Observation | null = null;
  let bestDelta = Infinity;
  for (const obs of candidates) {
    const delta = Math.abs(obs.timestampSeconds - timestampSeconds);
    if (delta <= toleranceSeconds && delta < bestDelta) {
      best = obs;
      bestDelta = delta;
    }
  }
  return best;
}

export function calculateInspectionSummary(apartment: ApartmentRecord): {
  moveInCount: number;
  moveOutCount: number;
  coverageCount: number;
  reviewedCount: number;
  confirmedCount: number;
  editedCount: number;
  dismissedCount: number;
  totalClaimedUsd: number;
  preExistingClaimCount: number;
} {
  const damageObs = apartment.observations.filter(
    (o) => getObservationCategory(o) === 'potential-damage'
  );
  const coverageCount = apartment.observations.filter(
    (o) => getObservationCategory(o) === 'condition-observation'
  ).length;
  const active = damageObs.filter((o) => o.reviewStatus !== 'dismissed');
  const moveInCount = active.filter((o) => o.inspectionType === 'move-in').length;
  const moveOutCount = active.filter((o) => o.inspectionType === 'move-out').length;
  const confirmedCount = damageObs.filter((o) => o.reviewStatus === 'confirmed').length;
  const editedCount = damageObs.filter((o) => o.reviewStatus === 'edited').length;
  const dismissedCount = damageObs.filter((o) => o.reviewStatus === 'dismissed').length;
  const reviewedCount = confirmedCount + editedCount + dismissedCount;

  const totalClaimedUsd = apartment.claims.reduce(
    (sum, c) => sum + (c.amountUsd !== null && Number.isFinite(c.amountUsd) ? c.amountUsd : 0),
    0
  );
  const preExistingClaimCount = apartment.claims.filter(
    (c) => c.evidenceAlignment === 'supports-pre-existing'
  ).length;

  return {
    moveInCount,
    moveOutCount,
    coverageCount,
    reviewedCount,
    confirmedCount,
    editedCount,
    dismissedCount,
    totalClaimedUsd,
    preExistingClaimCount,
  };
}
