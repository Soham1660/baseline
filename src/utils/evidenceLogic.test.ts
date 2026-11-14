import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInspectionSummary,
  clampTimestamp,
  classifyObservationConservatively,
  findNearestObservation,
  formatBytes,
  formatCurrencyUsd,
  formatTimestamp,
  getEffectiveObservation,
  getObservationCategory,
  normalizeComparisonClassification,
  parseClaimInput,
  validateAndNormalizeComparisons,
  validateAndNormalizeObservations,
} from './evidenceLogic.ts';
import type { ApartmentRecord, Observation } from '../types/baseline';

test('formatTimestamp formats seconds cleanly as MM:SS and optional tenths', () => {
  assert.equal(formatTimestamp(0), '00:00');
  assert.equal(formatTimestamp(5.8), '00:05');
  assert.equal(formatTimestamp(65), '01:05');
  assert.equal(formatTimestamp(-4), '00:00');
  assert.equal(formatTimestamp(4.8, true), '00:04.8');
  assert.equal(formatTimestamp(10.24, true), '00:10.2');
});

test('parseClaimInput extracts dollar amount and preserves description', () => {
  const parsed = parseClaimInput('Bedroom wall repair — $300');
  assert.equal(parsed.description, 'Bedroom wall repair — $300');
  assert.equal(parsed.amountUsd, 300);

  const decimal = parseClaimInput('Deep cleaning $1,250.50');
  assert.equal(decimal.amountUsd, 1250.5);

  const noAmount = parseClaimInput('General hallway paint touch-up');
  assert.equal(noAmount.amountUsd, null);
});

test('clampTimestamp bounds timestamps within actual video duration', () => {
  assert.equal(clampTimestamp(25, 16), 15.9);
  assert.equal(clampTimestamp(-3, 16), 0);
  assert.equal(clampTimestamp(5.36, 16), 5.4);
});

test('validateAndNormalizeObservations filters malformed rows and sorts by timestamp', () => {
  const input = [
    {
      room: 'Kitchen',
      objectOrSurface: 'Countertop edge',
      visibleCondition: 'Small laminate chip on front edge',
      timestampSeconds: 11.2,
      severity: 'minor',
      confidence: 'high',
    },
    {
      room: '',
      objectOrSurface: 'Missing room',
      visibleCondition: 'Should be skipped',
      timestampSeconds: 2,
    },
    {
      room: 'Bedroom',
      objectOrSurface: 'West wall',
      visibleCondition: 'Hairline plaster crack near window',
      timestampSeconds: 40,
      severity: 'UNKNOWN_VAL',
      confidence: 'low',
      uncertaintyNote: 'Partial shadow in corner',
    },
  ];

  const normalized = validateAndNormalizeObservations(input, 'move-in', 16, 'ai');
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].room, 'Kitchen');
  assert.equal(normalized[1].room, 'Bedroom');
  assert.equal(normalized[1].timestampSeconds, 15.9);
  assert.equal(normalized[1].severity, 'unclear');
  assert.equal(normalized[1].reviewStatus, 'unreviewed');
});

test('getEffectiveObservation preserves original AI observation alongside user edits', () => {
  const obs: Observation = {
    id: 'obs-1',
    inspectionType: 'move-in',
    room: 'Bedroom',
    objectOrSurface: 'West wall',
    visibleCondition: 'Faint line near upper window frame',
    timestampSeconds: 5,
    severity: 'minor',
    confidence: 'moderate',
    reviewStatus: 'edited',
    source: 'ai',
    userEdit: {
      visibleCondition: 'Hairline plaster crack (~6 inches) documented at move-in',
      editedAt: '2026-11-14T00:00:00Z',
    },
  };

  const effective = getEffectiveObservation(obs);
  assert.equal(effective.hasUserEdit, true);
  assert.equal(
    effective.visibleCondition,
    'Hairline plaster crack (~6 inches) documented at move-in'
  );
  assert.equal(obs.visibleCondition, 'Faint line near upper window frame');
});

test('normalizeComparisonClassification enforces conservative 4-state taxonomy', () => {
  assert.equal(
    normalizeComparisonClassification('Potentially pre-existing'),
    'Potentially pre-existing'
  );
  assert.equal(normalizeComparisonClassification('preexisting damage'), 'Potentially pre-existing');
  assert.equal(normalizeComparisonClassification('potentially new scuff'), 'Potentially new');
  assert.equal(normalizeComparisonClassification('No clear change'), 'No clear change');
  assert.equal(normalizeComparisonClassification('unclear lighting'), 'Insufficient evidence');
});

test('validateAndNormalizeComparisons clamps timestamps and provides defaults', () => {
  const rows = validateAndNormalizeComparisons(
    [
      {
        room: 'Bedroom',
        areaOrSurface: 'Upper window drywall',
        classification: 'Potentially pre-existing',
        moveInTimestampSeconds: 5.2,
        moveOutTimestampSeconds: 22,
        moveInSummary: 'Crack visible near trim',
        moveOutSummary: 'Same crack pattern visible',
        reasoning: 'Consistent geometry across both clips.',
      },
    ],
    16,
    16
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].moveInTimestampSeconds, 5.2);
  assert.equal(rows[0].moveOutTimestampSeconds, 15.9);
});

test('findNearestObservation skips dismissed items and finds closest timestamp', () => {
  const obs: Observation[] = [
    {
      id: 'a',
      inspectionType: 'move-in',
      room: 'Living Room',
      objectOrSurface: 'Floor',
      visibleCondition: 'Scuff',
      timestampSeconds: 2.0,
      severity: 'minor',
      confidence: 'high',
      reviewStatus: 'dismissed',
      source: 'ai',
    },
    {
      id: 'b',
      inspectionType: 'move-in',
      room: 'Living Room',
      objectOrSurface: 'Floor',
      visibleCondition: 'Scratch',
      timestampSeconds: 2.5,
      severity: 'minor',
      confidence: 'high',
      reviewStatus: 'confirmed',
      source: 'ai',
    },
  ];
  const nearest = findNearestObservation(obs, 'move-in', 2.2, 1.0);
  assert.equal(nearest?.id, 'b');
});

test('calculateInspectionSummary computes accurate counts and totals', () => {
  const apt: ApartmentRecord = {
    id: 'apt-1',
    isSample: false,
    unitName: '100 Main St',
    cityState: 'Berkeley, CA',
    landlordOrManagement: 'Oak Mgmt',
    leaseStart: '2025-09-01',
    leaseEnd: '2026-08-31',
    securityDepositUsd: 2400,
    createdAt: '2026-09-01T00:00:00Z',
    observations: [
      {
        id: '1',
        inspectionType: 'move-in',
        room: 'Bedroom',
        objectOrSurface: 'Wall',
        visibleCondition: 'Crack',
        timestampSeconds: 5,
        severity: 'minor',
        confidence: 'high',
        reviewStatus: 'confirmed',
        source: 'ai',
      },
      {
        id: '2',
        inspectionType: 'move-out',
        room: 'Bedroom',
        objectOrSurface: 'Baseboard',
        visibleCondition: 'Scuff',
        timestampSeconds: 7,
        severity: 'minor',
        confidence: 'moderate',
        reviewStatus: 'unreviewed',
        source: 'ai',
      },
    ],
    comparisons: [],
    claims: [
      {
        id: 'c1',
        claimText: 'Bedroom wall repair — $300',
        amountUsd: 300,
        matchedObservationIds: ['1'],
        matchedComparisonIds: [],
        assessmentSummary: 'Pre-existing crack documented.',
        evidenceAlignment: 'supports-pre-existing',
        keyTimestamps: [],
        limitationsNote: 'Visual footage only.',
        createdAt: '2026-09-01T00:00:00Z',
        source: 'gemini-live',
      },
    ],
    reconsiderationDraft: {
      recipientName: 'Oak Mgmt',
      subject: 'Deposit Reconsideration',
      body: 'Hello',
    },
  };

  const summary = calculateInspectionSummary(apt);
  assert.equal(summary.moveInCount, 1);
  assert.equal(summary.moveOutCount, 1);
  assert.equal(summary.confirmedCount, 1);
  assert.equal(summary.reviewedCount, 1);
  assert.equal(summary.totalClaimedUsd, 300);
  assert.equal(summary.preExistingClaimCount, 1);
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatCurrencyUsd(300), '$300');
});

test('clean-room regression: intact surfaces, normal features, and distant/shadowed areas yield zero potential-damage findings', () => {
  const cleanRoomRaw = [
    {
      category: 'potential-damage', // even if model over-flags
      room: 'Living Room',
      objectOrSurface: 'Hardwood floor',
      visibleCondition: 'Intact hardwood floor planks across the main seating area.',
      timestampSeconds: 1.4,
      severity: 'minor',
      confidence: 'high',
    },
    {
      category: 'potential-damage',
      room: 'Hallway',
      objectOrSurface: 'Interior doorway',
      visibleCondition: 'A normal doorway leading toward the bedroom.',
      timestampSeconds: 4.1,
      severity: 'minor',
      confidence: 'high',
    },
    {
      category: 'potential-damage',
      room: 'Living Room',
      objectOrSurface: 'Wood stove',
      visibleCondition: 'A black cast-iron wood stove stands against the hearth wall.',
      timestampSeconds: 6.5,
      severity: 'minor',
      confidence: 'high',
    },
    {
      category: 'potential-damage',
      room: 'Bathroom',
      objectOrSurface: 'Vanity and tiled wall',
      visibleCondition: 'Bathroom is too distant to inspect surface details clearly.',
      timestampSeconds: 11.2,
      severity: 'unclear',
      confidence: 'low',
      uncertaintyNote: 'Camera remained in the hallway outside the bathroom.',
    },
    {
      category: 'condition-observation',
      room: 'Kitchen',
      objectOrSurface: 'Backsplash and cabinetry',
      visibleCondition: 'White tiled backsplash and cabinets appear clean with no visible cracks or stains.',
      timestampSeconds: 13.0,
      severity: 'minor',
      confidence: 'high',
    },
  ];

  const normalized = validateAndNormalizeObservations(cleanRoomRaw, 'move-in', 16, 'ai');
  assert.equal(normalized.length, 5);
  const damageFindings = normalized.filter((o) => getObservationCategory(o) === 'potential-damage');
  const coverageNotes = normalized.filter((o) => getObservationCategory(o) === 'condition-observation');

  assert.equal(damageFindings.length, 0);
  assert.equal(coverageNotes.length, 5);
  assert.ok(coverageNotes.every((o) => o.reviewStatus === 'unreviewed'));
});

test('damaged-room regression: visible scratches, cracks, chips, and water stains stay potential-damage and unreviewed', () => {
  const damagedRoomRaw = [
    {
      category: 'potential-damage',
      room: 'Living Room',
      objectOrSurface: 'Oak hardwood floor',
      visibleCondition: 'Two 4-inch diagonal scratches visible in the oak finish near the baseboard.',
      abnormalityDetail: '4-inch diagonal finish scratches on oak planks',
      timestampSeconds: 2.3,
      severity: 'minor',
      confidence: 'high',
    },
    {
      category: 'potential-damage',
      room: 'Bedroom',
      objectOrSurface: 'Upper window drywall',
      visibleCondition: 'Hairline diagonal plaster crack extending roughly 6 inches from window casing.',
      abnormalityDetail: '6-inch hairline plaster crack',
      timestampSeconds: 5.8,
      severity: 'moderate',
      confidence: 'high',
    },
    {
      category: 'potential-damage',
      room: 'Bathroom',
      objectOrSurface: 'Under-sink cabinet floor',
      visibleCondition: 'Dark water stain and warped laminate edge along the sink base.',
      abnormalityDetail: 'Water stain and warped laminate',
      timestampSeconds: 12.1,
      severity: 'significant',
      confidence: 'moderate',
      uncertaintyNote: 'Dim cabinet interior limits view of back corner.',
    },
    {
      category: 'condition-observation',
      room: 'Hallway',
      objectOrSurface: 'Closet doorway',
      visibleCondition: 'Normal painted doorway frame with no visible damage.',
      timestampSeconds: 8.4,
      severity: 'minor',
      confidence: 'high',
    },
  ];

  const normalized = validateAndNormalizeObservations(damagedRoomRaw, 'move-out', 16, 'ai');
  const damageFindings = normalized.filter((o) => getObservationCategory(o) === 'potential-damage');
  const coverageNotes = normalized.filter((o) => getObservationCategory(o) === 'condition-observation');

  assert.equal(damageFindings.length, 3);
  assert.equal(coverageNotes.length, 1);
  assert.equal(damageFindings[0].timestampSeconds, 2.3);
  assert.equal(damageFindings[1].abnormalityDetail, '6-inch hairline plaster crack');
  assert.equal(damageFindings[2].uncertaintyNote, 'Dim cabinet interior limits view of back corner.');
  assert.ok(normalized.every((o) => o.reviewStatus === 'unreviewed'));
});

test('classifyObservationConservatively does not promote explicit condition-observation or infer damage from shadows/furniture', () => {
  assert.equal(
    classifyObservationConservatively({
      rawCategory: 'condition-observation',
      visibleCondition: 'Possible dark mark or shadow on wall',
      severity: 'minor',
    }),
    'condition-observation'
  );
  assert.equal(
    classifyObservationConservatively({
      rawCategory: 'potential-damage',
      visibleCondition: 'Lower wall corner obscured by shadow; cannot be assessed from this angle.',
      severity: 'unclear',
    }),
    'condition-observation'
  );
});

test('calculateInspectionSummary keeps damage counts separate from condition-observation coverage counts', () => {
  const apt: ApartmentRecord = {
    id: 'apt-clean',
    isSample: false,
    unitName: '202 Pine St',
    cityState: 'Berkeley, CA',
    landlordOrManagement: 'Pine Mgmt',
    leaseStart: '2025-09-01',
    leaseEnd: '2026-08-31',
    securityDepositUsd: 2800,
    createdAt: '2026-09-01T00:00:00Z',
    observations: [
      {
        id: 'cov-1',
        inspectionType: 'move-in',
        category: 'condition-observation',
        room: 'Living Room',
        objectOrSurface: 'Hardwood floor',
        visibleCondition: 'Intact hardwood floor',
        timestampSeconds: 1.5,
        severity: 'minor',
        confidence: 'high',
        reviewStatus: 'unreviewed',
        source: 'ai',
      },
      {
        id: 'dmg-1',
        inspectionType: 'move-out',
        category: 'potential-damage',
        room: 'Kitchen',
        objectOrSurface: 'Countertop',
        visibleCondition: 'Small chip on front bevel',
        timestampSeconds: 9.2,
        severity: 'minor',
        confidence: 'high',
        reviewStatus: 'confirmed',
        source: 'ai',
      },
    ],
    comparisons: [],
    claims: [],
    reconsiderationDraft: {
      recipientName: 'Pine Mgmt',
      subject: 'Deposit Reconsideration',
      body: '',
    },
  };

  const summary = calculateInspectionSummary(apt);
  assert.equal(summary.moveInCount, 0);
  assert.equal(summary.moveOutCount, 1);
  assert.equal(summary.coverageCount, 1);
  assert.equal(summary.confirmedCount, 1);
});
