import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Film, Loader2, Play, RefreshCw, X } from 'lucide-react';
import type {
  ApartmentRecord,
  AppScreen,
  ComparisonClassification,
  ComparisonItem,
} from '../types/baseline';
import {
  formatTimestamp,
  getEffectiveObservation,
  getObservationCategory,
} from '../utils/evidenceLogic';
import { extractVideoThumbnails } from '../utils/videoFrames';
import {
  formatUiErrorBannerText,
  parseApiErrorResponse,
  type ApiErrorPayload,
} from '../utils/apiErrorFormat';

interface ComparisonViewProps {
  apartment: ApartmentRecord;
  onUpdateComparisons: (items: ComparisonItem[]) => void;
  onNavigate: (screen: AppScreen) => void;
  onOpenSample?: () => void;
}

const CLASSIFICATION_STYLES: Record<
  ComparisonClassification,
  { border: string; bg: string; text: string }
> = {
  'Potentially pre-existing': {
    border: 'border-[#4C735B]/40',
    bg: 'bg-[#EAF1EB]',
    text: 'text-[#4C735B]',
  },
  'Potentially new': {
    border: 'border-[#C9473D]/40',
    bg: 'bg-[#FBEDEB]',
    text: 'text-[#C9473D]',
  },
  'No clear change': {
    border: 'border-[#DFDED8]',
    bg: 'bg-[#F0EEE9]',
    text: 'text-[#454843]',
  },
  'Insufficient evidence': {
    border: 'border-[#946B28]/40',
    bg: 'bg-[#F7F1E3]',
    text: 'text-[#946B28]',
  },
};

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  apartment,
  onUpdateComparisons,
  onNavigate,
  onOpenSample,
}) => {
  const [isComparing, setIsComparing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewClip, setPreviewClip] = useState<{
    title: string;
    videoUrl: string;
    timestamp: number;
  } | null>(null);

  const [thumbMap, setThumbMap] = useState<Record<string, string>>({});

  // Extract thumbnails for any comparison timestamps whose linked observations lack cached thumbnails
  useEffect(() => {
    const miUrl = apartment.moveInVideo?.objectUrl;
    const moUrl = apartment.moveOutVideo?.objectUrl;
    const miTimes: number[] = [];
    const moTimes: number[] = [];

    for (const cmp of apartment.comparisons) {
      if (cmp.moveInTimestampSeconds !== null) miTimes.push(cmp.moveInTimestampSeconds);
      if (cmp.moveOutTimestampSeconds !== null) moTimes.push(cmp.moveOutTimestampSeconds);
    }

    let cancelled = false;
    Promise.all([
      miUrl && miTimes.length > 0 ? extractVideoThumbnails(miUrl, miTimes) : Promise.resolve(new Map()),
      moUrl && moTimes.length > 0 ? extractVideoThumbnails(moUrl, moTimes) : Promise.resolve(new Map()),
    ]).then(([miRes, moRes]) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      miRes.forEach((v, k) => {
        next[`mi-${k}`] = v;
      });
      moRes.forEach((v, k) => {
        next[`mo-${k}`] = v;
      });
      if (Object.keys(next).length > 0) {
        setThumbMap((prev) => ({ ...prev, ...next }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    apartment.moveInVideo?.objectUrl,
    apartment.moveOutVideo?.objectUrl,
    apartment.comparisons.length,
  ]);

  const counts = useMemo(() => {
    const map: Record<ComparisonClassification, number> = {
      'Potentially pre-existing': 0,
      'Potentially new': 0,
      'No clear change': 0,
      'Insufficient evidence': 0,
    };
    for (const c of apartment.comparisons) {
      map[c.classification] = (map[c.classification] || 0) + 1;
    }
    return map;
  }, [apartment.comparisons]);

  const runComparison = async () => {
    if (!apartment.moveInVideo || !apartment.moveOutVideo) return;
    setErrorMsg(null);
    setIsComparing(true);

    try {
      const activeMoveIn = apartment.observations
        .filter((o) => o.inspectionType === 'move-in' && o.reviewStatus !== 'dismissed')
        .map((o) => ({
          id: o.id,
          category: getObservationCategory(o),
          timestampSeconds: o.timestampSeconds,
          ...getEffectiveObservation(o),
          reviewStatus: o.reviewStatus,
        }));

      const activeMoveOut = apartment.observations
        .filter((o) => o.inspectionType === 'move-out' && o.reviewStatus !== 'dismissed')
        .map((o) => ({
          id: o.id,
          category: getObservationCategory(o),
          timestampSeconds: o.timestampSeconds,
          ...getEffectiveObservation(o),
          reviewStatus: o.reviewStatus,
        }));

      const resp = await fetch('/api/compare-inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitName: apartment.unitName,
          moveInServerFileId: apartment.moveInVideo.serverFileId,
          moveInAccessToken: apartment.moveInVideo.serverAccessToken,
          moveOutServerFileId: apartment.moveOutVideo.serverFileId,
          moveOutAccessToken: apartment.moveOutVideo.serverAccessToken,
          moveInDurationSeconds: apartment.moveInVideo.durationSeconds,
          moveOutDurationSeconds: apartment.moveOutVideo.durationSeconds,
          moveInObservations: activeMoveIn,
          moveOutObservations: activeMoveOut,
        }),
      });

      const data = (await resp.json()) as ApiErrorPayload & { comparisons?: ComparisonItem[] };
      if (!resp.ok) {
        const parsedErr = parseApiErrorResponse(data, 'Comparison failed.');
        throw new Error(formatUiErrorBannerText(parsedErr));
      }

      onUpdateComparisons(Array.isArray(data.comparisons) ? data.comparisons : []);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to compare inspections.');
    } finally {
      setIsComparing(false);
    }
  };

  const getThumbnailForSide = (
    side: 'mi' | 'mo',
    ts: number | null,
    linkedObsId?: string
  ): string | undefined => {
    if (linkedObsId) {
      const obs = apartment.observations.find((o) => o.id === linkedObsId);
      if (obs?.thumbnailDataUrl) return obs.thumbnailDataUrl;
    }
    if (ts !== null) {
      const key = `${side}-${Math.max(0, Math.round(ts * 10) / 10)}`;
      return thumbMap[key];
    }
    return undefined;
  };

  const missingMoveIn = !apartment.moveInVideo;
  const missingMoveOut = !apartment.moveOutVideo;

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
      {apartment.isSample && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-[#946B28]/30 bg-[#F7F1E3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#20211F]">
            <span className="font-semibold text-[#946B28]">Sample Demonstration:</span>{' '}
            Precomputed conservative comparison across the sample move-in and move-out walkthroughs.
          </p>
          <span className="font-mono text-xs text-[#946B28] shrink-0">Precomputed</span>
        </div>
      )}

      <div className="flex flex-col gap-4 border-b border-[#DFDED8] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
            {apartment.unitName}
          </p>
          <h1 className="mt-1 font-serif text-3xl text-[#20211F] sm:text-4xl">
            Move-In vs. Move-Out Comparison
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#62635F]">
            Conservative side-by-side condition assessment. When angles, lighting, or framing differ, findings stay explicitly marked as uncertain.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!missingMoveIn && !missingMoveOut && (
            <button
              type="button"
              onClick={runComparison}
              disabled={isComparing}
              className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[#20211F] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#353734] disabled:opacity-50"
            >
              {isComparing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>
                {isComparing
                  ? 'Comparing Inspections…'
                  : apartment.comparisons.length > 0
                    ? 'Re-run Comparison'
                    : 'Run Comparison Analysis'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('claims')}
            className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-[#C5C4BD] bg-white px-4 py-2.5 text-xs font-medium text-[#20211F] hover:bg-[#F0EEE9]"
          >
            <span>Match Landlord Claims</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mt-5 flex flex-col gap-3 rounded-xl border border-[#C9473D]/40 bg-[#FBEDEB] px-4 py-3 text-sm text-[#93000a] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          {!apartment.isSample && onOpenSample && (
            <button
              type="button"
              onClick={onOpenSample}
              className="cursor-pointer rounded-lg border border-[#946B28]/50 bg-[#F7F1E3] px-3 py-1.5 text-xs font-medium text-[#946B28] hover:bg-[#EFE4CC] shrink-0"
            >
              Open Sample Demonstration
            </button>
          )}
        </div>
      )}

      {/* Missing video prompt */}
      {(missingMoveIn || missingMoveOut) && (
        <section className="mt-8 rounded-xl border border-dashed border-[#C5C4BD] bg-white p-8 text-center">
          <Film className="mx-auto h-8 w-8 text-[#62635F]" />
          <h2 className="mt-3 font-serif text-2xl text-[#20211F]">
            Both walkthrough videos are needed for comparison
          </h2>
          <p className="mt-2 text-sm text-[#62635F]">
            {missingMoveIn
              ? 'Upload your move-in walkthrough video first.'
              : 'Upload your move-out walkthrough video to compare conditions against your move-in baseline.'}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            {missingMoveIn && (
              <button
                type="button"
                onClick={() => onNavigate('move-in')}
                className="cursor-pointer rounded-lg bg-[#20211F] px-4 py-2 text-xs font-medium text-white"
              >
                Go to Move-In Upload
              </button>
            )}
            {missingMoveOut && (
              <button
                type="button"
                onClick={() => onNavigate('move-out')}
                className="cursor-pointer rounded-lg bg-[#20211F] px-4 py-2 text-xs font-medium text-white"
              >
                Go to Move-Out Upload
              </button>
            )}
          </div>
        </section>
      )}

      {/* Summary Counts */}
      {!missingMoveIn && !missingMoveOut && (
        <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(
            [
              'Potentially pre-existing',
              'Potentially new',
              'No clear change',
              'Insufficient evidence',
            ] as ComparisonClassification[]
          ).map((cls) => (
            <div key={cls} className="rounded-xl border border-[#DFDED8] bg-white p-4">
              <p className="text-xs text-[#62635F]">{cls}</p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-[#20211F]">
                {counts[cls]}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Comparison List */}
      {!missingMoveIn && !missingMoveOut && apartment.comparisons.length > 0 && (
        <section className="mt-6 space-y-5">
          {apartment.comparisons.map((cmp) => {
            const style = CLASSIFICATION_STYLES[cmp.classification];
            const miThumb = getThumbnailForSide(
              'mi',
              cmp.moveInTimestampSeconds,
              cmp.linkedMoveInObservationId
            );
            const moThumb = getThumbnailForSide(
              'mo',
              cmp.moveOutTimestampSeconds,
              cmp.linkedMoveOutObservationId
            );

            return (
              <article
                key={cmp.id}
                className="rounded-xl border border-[#DFDED8] bg-white p-5 sm:p-6"
              >
                <div className="flex flex-col gap-2 border-b border-[#DFDED8] pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#62635F]">{cmp.room}</p>
                    <h2 className="font-serif text-xl text-[#20211F]">
                      {cmp.areaOrSurface}
                    </h2>
                  </div>
                  <span
                    className={`inline-block self-start rounded-md border px-2.5 py-1 text-xs font-medium ${style.border} ${style.bg} ${style.text}`}
                  >
                    {cmp.classification}
                  </span>
                </div>

                {/* Side-by-Side Frame Cards */}
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Move-In Side */}
                  <div className="rounded-lg border border-[#DFDED8] bg-[#F8F7F3] p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#20211F]">Move-In Frame</span>
                      {cmp.moveInTimestampSeconds !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            if (apartment.moveInVideo?.objectUrl) {
                              setPreviewClip({
                                title: `Move-In · ${cmp.room} — ${cmp.areaOrSurface}`,
                                videoUrl: apartment.moveInVideo.objectUrl,
                                timestamp: cmp.moveInTimestampSeconds!,
                              });
                            }
                          }}
                          className="cursor-pointer inline-flex items-center gap-1 font-mono tabular-nums text-[#C9473D] hover:underline"
                        >
                          <Play className="h-3 w-3" />
                          <span>{formatTimestamp(cmp.moveInTimestampSeconds, true)}</span>
                        </button>
                      )}
                    </div>

                    {miThumb && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            apartment.moveInVideo?.objectUrl &&
                            cmp.moveInTimestampSeconds !== null
                          ) {
                            setPreviewClip({
                              title: `Move-In · ${cmp.room} — ${cmp.areaOrSurface}`,
                              videoUrl: apartment.moveInVideo.objectUrl,
                              timestamp: cmp.moveInTimestampSeconds,
                            });
                          }
                        }}
                        className="cursor-pointer mt-2.5 block w-full overflow-hidden rounded-md border border-[#DFDED8] bg-white"
                      >
                        <img
                          src={miThumb}
                          alt={`Move-in frame for ${cmp.areaOrSurface}`}
                          className="aspect-video w-full object-cover"
                        />
                      </button>
                    )}

                    <p className="mt-2.5 text-xs leading-relaxed text-[#454843]">
                      {cmp.moveInSummary}
                    </p>
                  </div>

                  {/* Move-Out Side */}
                  <div className="rounded-lg border border-[#DFDED8] bg-[#F8F7F3] p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#20211F]">Move-Out Frame</span>
                      {cmp.moveOutTimestampSeconds !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            if (apartment.moveOutVideo?.objectUrl) {
                              setPreviewClip({
                                title: `Move-Out · ${cmp.room} — ${cmp.areaOrSurface}`,
                                videoUrl: apartment.moveOutVideo.objectUrl,
                                timestamp: cmp.moveOutTimestampSeconds!,
                              });
                            }
                          }}
                          className="cursor-pointer inline-flex items-center gap-1 font-mono tabular-nums text-[#C9473D] hover:underline"
                        >
                          <Play className="h-3 w-3" />
                          <span>{formatTimestamp(cmp.moveOutTimestampSeconds, true)}</span>
                        </button>
                      )}
                    </div>

                    {moThumb && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            apartment.moveOutVideo?.objectUrl &&
                            cmp.moveOutTimestampSeconds !== null
                          ) {
                            setPreviewClip({
                              title: `Move-Out · ${cmp.room} — ${cmp.areaOrSurface}`,
                              videoUrl: apartment.moveOutVideo.objectUrl,
                              timestamp: cmp.moveOutTimestampSeconds,
                            });
                          }
                        }}
                        className="cursor-pointer mt-2.5 block w-full overflow-hidden rounded-md border border-[#DFDED8] bg-white"
                      >
                        <img
                          src={moThumb}
                          alt={`Move-out frame for ${cmp.areaOrSurface}`}
                          className="aspect-video w-full object-cover"
                        />
                      </button>
                    )}

                    <p className="mt-2.5 text-xs leading-relaxed text-[#454843]">
                      {cmp.moveOutSummary}
                    </p>
                  </div>
                </div>

                {/* Conservative Reasoning & Caveat */}
                <div className="mt-4 space-y-2 border-t border-[#DFDED8] pt-3">
                  <p className="text-sm leading-relaxed text-[#20211F]">
                    {cmp.reasoning}
                  </p>
                  {cmp.visibilityCaveat && (
                    <p className="rounded-md bg-[#F7F1E3] px-3 py-2 text-xs text-[#946B28]">
                      Visibility Caveat: {cmp.visibilityCaveat}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {!missingMoveIn && !missingMoveOut && apartment.comparisons.length === 0 && !isComparing && (
        <section className="mt-8 rounded-xl border border-[#DFDED8] bg-white p-8 text-center">
          <p className="text-sm text-[#62635F]">
            Both walkthrough videos are ready. Click &ldquo;Run Comparison Analysis&rdquo; above to generate a conservative side-by-side comparison.
          </p>
        </section>
      )}

      {/* Frame Clip Inspection Modal */}
      {previewClip && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={previewClip.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#20211F]/50 p-4"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#DFDED8] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#DFDED8] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#20211F]">{previewClip.title}</p>
                <p className="font-mono text-xs text-[#62635F]">
                  Starting at {formatTimestamp(previewClip.timestamp)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewClip(null)}
                aria-label="Close video preview"
                className="cursor-pointer rounded-lg p-1.5 text-[#62635F] hover:bg-[#F0EEE9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <video
              src={previewClip.videoUrl}
              controls
              autoPlay
              onLoadedMetadata={(e) => {
                e.currentTarget.currentTime = previewClip.timestamp;
              }}
              className="aspect-video w-full bg-[#1b1c1a]"
            />
          </div>
        </div>
      )}
    </main>
  );
};
