import { jsPDF } from 'jspdf';
import type { ApartmentRecord } from '../types/baseline';
import {
  formatBytes,
  formatCurrencyUsd,
  formatTimestamp,
  getEffectiveObservation,
  getObservationCategory,
} from './evidenceLogic';

export function exportApartmentEvidencePdf(apartment: ApartmentRecord): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageW - margin * 2;
  let y = 54;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 54) {
      doc.addPage();
      y = 54;
    }
  };

  const addSectionHeader = (title: string) => {
    ensureSpace(40);
    y += 10;
    doc.setDrawColor(223, 222, 216);
    doc.setLineWidth(0.75);
    doc.line(margin, y, pageW - margin, y);
    y += 18;
    doc.setFont('times', 'normal');
    doc.setFontSize(15);
    doc.setTextColor(32, 33, 31);
    doc.text(title, margin, y);
    y += 18;
  };

  const addParagraph = (text: string, fontSize = 10, color: [number, number, number] = [55, 56, 52], lineHeight = 14) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(lineHeight + 4);
      doc.text(line, margin, y);
      y += lineHeight;
    }
  };

  // Document Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(98, 99, 95);
  doc.text('BASELINE  ·  APARTMENT CONDITION EVIDENCE REPORT', margin, y);
  y += 22;

  doc.setFont('times', 'normal');
  doc.setFontSize(22);
  doc.setTextColor(32, 33, 31);
  doc.text(apartment.unitName, margin, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(98, 99, 95);
  const metaParts = [
    apartment.cityState,
    `Landlord / Management: ${apartment.landlordOrManagement || 'Unspecified'}`,
    `Lease: ${apartment.leaseStart || 'N/A'} to ${apartment.leaseEnd || 'N/A'}`,
    `Deposit: ${formatCurrencyUsd(apartment.securityDepositUsd)}`,
  ].filter(Boolean);
  // Wrap long metadata so landlord/lease/deposit details never run past the page edge.
  const metaLines = doc.splitTextToSize(metaParts.join('  ·  '), maxWidth) as string[];
  for (const line of metaLines) {
    doc.text(line, margin, y);
    y += 14;
  }

  if (apartment.isSample) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(148, 107, 40);
    doc.text('SAMPLE DEMONSTRATION RECORD — Precomputed inspection data for demonstration purposes.', margin, y);
    y += 14;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(144, 145, 139);
  doc.text(`Generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`, margin, y);
  y += 12;

  // Section 1: Video File Integrity Ledger
  addSectionHeader('1. Video File Integrity & Provenance');
  const videos = [
    { label: 'Move-In Walkthrough', vid: apartment.moveInVideo },
    { label: 'Move-Out Walkthrough', vid: apartment.moveOutVideo },
  ];

  for (const { label, vid } of videos) {
    ensureSpace(58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(32, 33, 31);
    doc.text(label, margin, y);
    y += 13;
    if (!vid) {
      addParagraph('No video file recorded for this inspection.', 9, [144, 145, 139]);
      y += 4;
    } else {
      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(55, 56, 52);
      doc.text(
        `File: ${vid.fileName}  |  Size: ${formatBytes(vid.fileSizeBytes)}  |  Duration: ${formatTimestamp(vid.durationSeconds)}`,
        margin,
        y
      );
      y += 12;
      doc.text(`SHA-256: ${vid.sha256}`, margin, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(98, 99, 95);
      doc.text(
        `Analysis Source: ${vid.analysisSource === 'sample-precomputed' ? 'Precomputed Sample' : `Gemini (${vid.analysisModel || 'Gemini'})`}  |  Recorded/Uploaded: ${vid.recordedOrUploadedAt}`,
        margin,
        y
      );
      y += 16;
    }
  }

  addParagraph(
    'Integrity Note: SHA-256 cryptographic hashing detects any byte-level alteration to a video file after calculation, but it does not independently verify the date, time, or physical location at which the video was filmed.',
    8.5,
    [98, 99, 95],
    12
  );

  // Section 2: Reviewed Potential Damage Findings
  const activeObs = apartment.observations.filter((o) => o.reviewStatus !== 'dismissed');
  const activeDamage = activeObs.filter((o) => getObservationCategory(o) === 'potential-damage');
  const activeCoverage = activeObs.filter((o) => getObservationCategory(o) === 'condition-observation');

  addSectionHeader(`2. Walkthrough Damage Findings (${activeDamage.length})`);
  if (activeDamage.length === 0) {
    addParagraph('No active damage findings logged.');
  } else {
    for (const obs of activeDamage) {
      const effective = getEffectiveObservation(obs);
      const hasThumb = Boolean(obs.thumbnailDataUrl && obs.thumbnailDataUrl.startsWith('data:image/'));
      ensureSpace(hasThumb ? 82 : 52);

      const textStartX = hasThumb ? margin + 108 : margin;
      const textWidth = hasThumb ? maxWidth - 108 : maxWidth;

      if (hasThumb && obs.thumbnailDataUrl) {
        try {
          doc.addImage(obs.thumbnailDataUrl, 'JPEG', margin, y - 4, 96, 54);
        } catch {
          // Ignore invalid thumbnail gracefully
        }
      }

      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(32, 33, 31);
      doc.text(
        `[${obs.inspectionType.toUpperCase()} · ${formatTimestamp(obs.timestampSeconds)}]  ${effective.room} — ${effective.objectOrSurface}`,
        textStartX,
        y + 5
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(55, 56, 52);
      const condLines = doc.splitTextToSize(effective.visibleCondition, textWidth) as string[];
      let lineY = y + 18;
      for (const line of condLines.slice(0, 3)) {
        doc.text(line, textStartX, lineY);
        lineY += 12;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(98, 99, 95);
      const statusLabel =
        obs.reviewStatus === 'confirmed'
          ? 'User Confirmed'
          : obs.reviewStatus === 'edited'
            ? 'User Edited (original preserved)'
            : 'Unreviewed AI Observation';
      doc.text(
        `Severity: ${effective.severity}  ·  Confidence: ${obs.confidence}  ·  Status: ${statusLabel}`,
        textStartX,
        Math.max(lineY + 2, y + 48)
      );

      y = Math.max(lineY + 18, y + (hasThumb ? 66 : 52));
    }
  }

  if (activeCoverage.length > 0) {
    ensureSpace(44);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(98, 99, 95);
    doc.text(`Inspection Coverage & Intact Surfaces — Non-Damage (${activeCoverage.length})`, margin, y);
    y += 14;
    for (const cov of activeCoverage) {
      addParagraph(
        `[${cov.inspectionType.toUpperCase()} · ${formatTimestamp(cov.timestampSeconds)}] ${cov.room} — ${cov.objectOrSurface}: ${cov.visibleCondition}`,
        8.5,
        [85, 88, 82],
        12
      );
    }
    y += 4;
  }

  // Section 3: Move-In vs Move-Out Comparison
  addSectionHeader(`3. Move-In vs. Move-Out Comparison (${apartment.comparisons.length})`);
  if (apartment.comparisons.length === 0) {
    addParagraph('No move-in vs. move-out comparison items have been generated yet.');
  } else {
    for (const cmp of apartment.comparisons) {
      ensureSpace(64);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(32, 33, 31);
      doc.text(`${cmp.room} — ${cmp.areaOrSurface}  [${cmp.classification}]`, margin, y);
      y += 14;
      const miTime = cmp.moveInTimestampSeconds !== null ? formatTimestamp(cmp.moveInTimestampSeconds) : 'N/A';
      const moTime = cmp.moveOutTimestampSeconds !== null ? formatTimestamp(cmp.moveOutTimestampSeconds) : 'N/A';
      addParagraph(`Move-In (${miTime}): ${cmp.moveInSummary}`, 9, [69, 72, 67], 12);
      addParagraph(`Move-Out (${moTime}): ${cmp.moveOutSummary}`, 9, [69, 72, 67], 12);
      addParagraph(`Assessment: ${cmp.reasoning}${cmp.visibilityCaveat ? ` (Caveat: ${cmp.visibilityCaveat})` : ''}`, 9, [98, 99, 95], 12);
      y += 6;
    }
  }

  // Section 4: Claim-to-Evidence Matching
  addSectionHeader(`4. Claim-to-Evidence Matching (${apartment.claims.length})`);
  if (apartment.claims.length === 0) {
    addParagraph('No landlord deduction claims have been entered yet.');
  } else {
    for (const claim of apartment.claims) {
      ensureSpace(70);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(32, 33, 31);
      doc.text(claim.claimText, margin, y);
      y += 14;
      addParagraph(claim.assessmentSummary, 9.5, [32, 33, 31], 13);
      if (claim.keyTimestamps.length > 0) {
        const tsText = claim.keyTimestamps
          .map((k) => `${k.inspectionType.toUpperCase()} ${formatTimestamp(k.timestampSeconds)} (${k.label})`)
          .join('  |  ');
        addParagraph(`Referenced Timestamps: ${tsText}`, 8.5, [98, 99, 95], 12);
      }
      addParagraph(`Limitations: ${claim.limitationsNote}`, 8.5, [98, 99, 95], 12);
      y += 8;
    }
  }

  // Section 5: Reconsideration Request Draft
  if (apartment.reconsiderationDraft.body.trim().length > 0) {
    addSectionHeader('5. Deposit Reconsideration Request');
    addParagraph(`To: ${apartment.reconsiderationDraft.recipientName || 'Property Management'}`, 9.5, [32, 33, 31], 13);
    addParagraph(`Subject: ${apartment.reconsiderationDraft.subject}`, 9.5, [32, 33, 31], 16);
    addParagraph(apartment.reconsiderationDraft.body, 9.5, [45, 46, 43], 13.5);
  }

  const slug = apartment.unitName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  doc.save(`baseline-evidence-report-${slug || 'apartment'}.pdf`);
}
