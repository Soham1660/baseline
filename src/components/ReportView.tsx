import React, { useEffect, useState } from 'react';
import { Check, Download, Printer } from 'lucide-react';
import type { ApartmentRecord } from '../types/baseline';
import {
  formatBytes,
  formatCurrencyUsd,
  formatTimestamp,
  getEffectiveObservation,
  getObservationCategory,
} from '../utils/evidenceLogic';
import { exportApartmentEvidencePdf } from '../utils/pdfExport';
import { extractVideoThumbnails } from '../utils/videoFrames';

interface ReportViewProps {
  apartment: ApartmentRecord;
  onBatchSetThumbnails?: (updates: Array<{ id: string; thumbnailDataUrl: string }>) => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  apartment,
  onBatchSetThumbnails,
}) => {
  const [exported, setExported] = useState(false);

  const activeObservations = apartment.observations.filter(
    (o) => o.reviewStatus !== 'dismissed'
  );
  const activeDamageObservations = activeObservations.filter(
    (o) => getObservationCategory(o) === 'potential-damage'
  );
  const coverageObservations = activeObservations.filter(
    (o) => getObservationCategory(o) === 'condition-observation'
  );

  useEffect(() => {
    if (!onBatchSetThumbnails) return;
    const missingMi = activeObservations.filter(
      (o) => o.inspectionType === 'move-in' && !o.thumbnailDataUrl
    );
    const missingMo = activeObservations.filter(
      (o) => o.inspectionType === 'move-out' && !o.thumbnailDataUrl
    );

    const miUrl = apartment.moveInVideo?.objectUrl;
    const moUrl = apartment.moveOutVideo?.objectUrl;

    if ((missingMi.length === 0 || !miUrl) && (missingMo.length === 0 || !moUrl)) {
      return;
    }

    let cancelled = false;
    Promise.all([
      missingMi.length > 0 && miUrl
        ? extractVideoThumbnails(
            miUrl,
            missingMi.map((m) => m.timestampSeconds)
          )
        : Promise.resolve(new Map<number, string>()),
      missingMo.length > 0 && moUrl
        ? extractVideoThumbnails(
            moUrl,
            missingMo.map((m) => m.timestampSeconds)
          )
        : Promise.resolve(new Map<number, string>()),
    ]).then(([miMap, moMap]) => {
      if (cancelled) return;
      const updates: Array<{ id: string; thumbnailDataUrl: string }> = [];
      for (const obs of missingMi) {
        const key = Math.max(0, Math.round(obs.timestampSeconds * 10) / 10);
        const url = miMap.get(key);
        if (url) updates.push({ id: obs.id, thumbnailDataUrl: url });
      }
      for (const obs of missingMo) {
        const key = Math.max(0, Math.round(obs.timestampSeconds * 10) / 10);
        const url = moMap.get(key);
        if (url) updates.push({ id: obs.id, thumbnailDataUrl: url });
      }
      if (updates.length > 0) {
        onBatchSetThumbnails(updates);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    apartment.id,
    apartment.moveInVideo?.objectUrl,
    apartment.moveOutVideo?.objectUrl,
    activeObservations.length,
  ]);

  const handleDownloadPdf = () => {
    exportApartmentEvidencePdf(apartment);
    setExported(true);
    setTimeout(() => setExported(false), 2500);
  };

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 sm:px-8">
      {/* Toolbar */}
      <div className="no-print mb-6 flex flex-col gap-4 border-b border-[#DFDED8] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
            Evidence Dossier
          </p>
          <h1 className="mt-1 font-serif text-3xl text-[#20211F] sm:text-4xl">
            Report Preview &amp; PDF Export
          </h1>
          <p className="mt-1 text-sm text-[#62635F]">
            Includes video file SHA-256 fingerprints, timestamped video stills, comparison notes, matched claims, and your reconsideration letter.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => window.print()}
            className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-[#C5C4BD] bg-white px-4 py-2.5 text-xs font-medium text-[#20211F] hover:bg-[#F0EEE9]"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print View</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[#20211F] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#353734]"
          >
            {exported ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>PDF Downloaded</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Download Evidence PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editorial Document Sheet */}
      <article className="rounded-xl border border-[#DFDED8] bg-white p-6 shadow-xs sm:p-10">
        <header className="border-b border-[#DFDED8] pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold tracking-[0.08em] text-[#62635F] uppercase">
            <span>BASELINE · Apartment Condition Evidence Report</span>
            {apartment.isSample && (
              <span className="text-[#946B28]">Sample Demonstration Record</span>
            )}
          </div>
          <h2 className="mt-3 font-serif text-3xl text-[#20211F]">
            {apartment.unitName}
          </h2>
          <p className="mt-1.5 text-sm text-[#62635F]">
            {[
              apartment.cityState,
              `Management: ${apartment.landlordOrManagement || 'Unspecified'}`,
              `Lease: ${apartment.leaseStart || 'N/A'} to ${apartment.leaseEnd || 'N/A'}`,
              `Deposit: ${formatCurrencyUsd(apartment.securityDepositUsd)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </header>

        {/* Section 1: File Integrity */}
        <section className="border-b border-[#DFDED8] py-6">
          <h3 className="font-serif text-xl text-[#20211F]">
            1. Video File Integrity &amp; Provenance
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              { label: 'Move-In Walkthrough', video: apartment.moveInVideo },
              { label: 'Move-Out Walkthrough', video: apartment.moveOutVideo },
            ].map(({ label, video }) => (
              <div
                key={label}
                className="rounded-lg border border-[#DFDED8] bg-[#F8F7F3] p-4 text-xs"
              >
                <p className="font-semibold text-[#20211F]">{label}</p>
                {video ? (
                  <div className="mt-2 space-y-1 text-[#454843]">
                    <p className="font-mono">{video.fileName}</p>
                    <p className="font-mono tabular-nums">
                      Duration: {formatTimestamp(video.durationSeconds)} · Size:{' '}
                      {formatBytes(video.fileSizeBytes)}
                    </p>
                    <p className="break-all font-mono text-[11px] text-[#20211F]">
                      SHA-256: {video.sha256}
                    </p>
                    <p className="font-mono text-[11px] text-[#62635F]">
                      Analysis:{' '}
                      {video.analysisSource === 'sample-precomputed'
                        ? 'Precomputed Sample'
                        : video.analysisSource === 'gemini-live'
                          ? `Gemini (${video.analysisModel || 'Gemini'})`
                          : video.analysisSource}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-[#90918B]">No video recorded.</p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#62635F]">
            Integrity Disclosure: SHA-256 hashing detects any byte-level alteration to a video file after calculation, but does not independently verify the date or location of filming.
          </p>
        </section>

        {/* Section 2: Reviewed Potential Damage Observations */}
        <section className="border-b border-[#DFDED8] py-6">
          <h3 className="font-serif text-xl text-[#20211F]">
            2. Walkthrough Damage Findings ({activeDamageObservations.length})
          </h3>
          {activeDamageObservations.length === 0 ? (
            <p className="mt-3 text-sm text-[#62635F]">
              No active damage findings recorded.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-[#DFDED8]">
              {activeDamageObservations.map((obs) => {
                const eff = getEffectiveObservation(obs);
                return (
                  <div key={obs.id} className="flex gap-4 py-4">
                    {obs.thumbnailDataUrl && (
                      <img
                        src={obs.thumbnailDataUrl}
                        alt={`${eff.room} at ${formatTimestamp(obs.timestampSeconds)}`}
                        className="h-[54px] w-[96px] shrink-0 rounded border border-[#DFDED8] object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#62635F]">
                        <span className="font-mono font-medium uppercase text-[#20211F]">
                          {obs.inspectionType} · {formatTimestamp(obs.timestampSeconds, true)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#20211F]">{eff.room}</span>
                        <span aria-hidden="true">·</span>
                        <span>{eff.objectOrSurface}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {obs.reviewStatus === 'confirmed'
                            ? 'Confirmed'
                            : obs.reviewStatus === 'edited'
                              ? 'User Edited'
                              : 'Unreviewed AI'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[#20211F]">{eff.visibleCondition}</p>
                      {eff.hasUserEdit && (
                        <p className="mt-1 text-xs text-[#62635F]">
                          Original AI observation: {obs.visibleCondition}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {coverageObservations.length > 0 && (
            <div className="mt-5 rounded-lg border border-[#DFDED8] bg-[#F8F7F3] p-4">
              <h4 className="text-xs font-semibold tracking-[0.04em] text-[#62635F] uppercase">
                Inspection Coverage &amp; Intact Surfaces ({coverageObservations.length})
              </h4>
              <div className="mt-3 divide-y divide-[#DFDED8]">
                {coverageObservations.map((obs) => (
                  <div key={obs.id} className="flex gap-3 py-2.5 text-xs">
                    {obs.thumbnailDataUrl && (
                      <img
                        src={obs.thumbnailDataUrl}
                        alt={`${obs.room} at ${formatTimestamp(obs.timestampSeconds)}`}
                        className="h-[40px] w-[72px] shrink-0 rounded border border-[#DFDED8] object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] text-[#62635F]">
                        {obs.inspectionType.toUpperCase()} · {formatTimestamp(obs.timestampSeconds, true)} · {obs.room} — {obs.objectOrSurface}
                      </p>
                      <p className="mt-0.5 text-[#454843]">{obs.visibleCondition}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Section 3: Comparison Summary */}
        <section className="border-b border-[#DFDED8] py-6">
          <h3 className="font-serif text-xl text-[#20211F]">
            3. Move-In vs. Move-Out Comparison ({apartment.comparisons.length})
          </h3>
          {apartment.comparisons.length === 0 ? (
            <p className="mt-3 text-sm text-[#62635F]">
              No comparison findings generated yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {apartment.comparisons.map((cmp) => (
                <div
                  key={cmp.id}
                  className="rounded-lg border border-[#DFDED8] bg-[#F8F7F3] p-4 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#20211F]">
                      {cmp.room} — {cmp.areaOrSurface}
                    </span>
                    <span className="font-medium text-[#20211F]">{cmp.classification}</span>
                  </div>
                  <p className="mt-1.5 text-[#454843]">{cmp.reasoning}</p>
                  {cmp.visibilityCaveat && (
                    <p className="mt-1 text-[#946B28]">Caveat: {cmp.visibilityCaveat}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 4: Claim-to-Evidence Matches */}
        <section className="border-b border-[#DFDED8] py-6">
          <h3 className="font-serif text-xl text-[#20211F]">
            4. Claim-to-Evidence Matches ({apartment.claims.length})
          </h3>
          {apartment.claims.length === 0 ? (
            <p className="mt-3 text-sm text-[#62635F]">
              No proposed deductions analyzed yet.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {apartment.claims.map((c) => (
                <div key={c.id} className="rounded-lg border border-[#DFDED8] p-4">
                  <h4 className="font-serif text-lg text-[#20211F]">{c.claimText}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#20211F]">
                    {c.assessmentSummary}
                  </p>
                  <p className="mt-2 text-xs text-[#62635F]">
                    Limitations: {c.limitationsNote}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 5: Reconsideration Letter */}
        <section className="pt-6">
          <h3 className="font-serif text-xl text-[#20211F]">
            5. Reconsideration Request
          </h3>
          {apartment.reconsiderationDraft.body.trim() ? (
            <div className="mt-4 rounded-lg border border-[#DFDED8] bg-[#F8F7F3] p-5 text-sm leading-relaxed text-[#20211F]">
              <p className="text-xs text-[#62635F]">
                To: {apartment.reconsiderationDraft.recipientName || 'Property Management'}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#20211F]">
                Subject: {apartment.reconsiderationDraft.subject}
              </p>
              <div className="mt-4 whitespace-pre-wrap">{apartment.reconsiderationDraft.body}</div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[#62635F]">
              No reconsideration letter drafted yet.
            </p>
          )}
        </section>
      </article>
    </main>
  );
};
