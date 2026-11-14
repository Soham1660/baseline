import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Play,
  Plus,
  Scale,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ApartmentRecord,
  AppScreen,
  ClaimMatch,
  EvidenceAlignment,
} from '../types/baseline';
import {
  formatCurrencyUsd,
  formatTimestamp,
  getEffectiveObservation,
  getObservationCategory,
  parseClaimInput,
} from '../utils/evidenceLogic';
import { extractVideoThumbnails } from '../utils/videoFrames';
import {
  formatUiErrorBannerText,
  parseApiErrorResponse,
  type ApiErrorPayload,
} from '../utils/apiErrorFormat';

interface ClaimMatcherViewProps {
  apartment: ApartmentRecord;
  onAddClaim: (claim: ClaimMatch) => void;
  onDeleteClaim: (claimId: string) => void;
  onNavigate: (screen: AppScreen) => void;
  onOpenSample?: () => void;
}

const ALIGNMENT_LABELS: Record<
  EvidenceAlignment,
  { label: string; border: string; bg: string; text: string }
> = {
  'supports-pre-existing': {
    label: 'Evidence suggests pre-existing condition',
    border: 'border-[#4C735B]/40',
    bg: 'bg-[#EAF1EB]',
    text: 'text-[#4C735B]',
  },
  'mixed-or-unclear': {
    label: 'Mixed or partially unclear evidence',
    border: 'border-[#946B28]/40',
    bg: 'bg-[#F7F1E3]',
    text: 'text-[#946B28]',
  },
  'supports-new-change': {
    label: 'Evidence shows potential new change',
    border: 'border-[#C9473D]/40',
    bg: 'bg-[#FBEDEB]',
    text: 'text-[#C9473D]',
  },
  'insufficient-evidence': {
    label: 'Insufficient visual evidence',
    border: 'border-[#DFDED8]',
    bg: 'bg-[#F0EEE9]',
    text: 'text-[#454843]',
  },
};

export const ClaimMatcherView: React.FC<ClaimMatcherViewProps> = ({
  apartment,
  onAddClaim,
  onDeleteClaim,
  onNavigate,
  onOpenSample,
}) => {
  const [claimInput, setClaimInput] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [frameCache, setFrameCache] = useState<Record<string, string>>({});
  const [previewClip, setPreviewClip] = useState<{
    title: string;
    videoUrl: string;
    timestamp: number;
  } | null>(null);

  // Extract thumbnails for all claim keyTimestamps
  useEffect(() => {
    const miTimes: number[] = [];
    const moTimes: number[] = [];

    for (const claim of apartment.claims) {
      for (const ts of claim.keyTimestamps) {
        if (ts.inspectionType === 'move-in') miTimes.push(ts.timestampSeconds);
        else moTimes.push(ts.timestampSeconds);
      }
    }

    let cancelled = false;
    Promise.all([
      apartment.moveInVideo?.objectUrl && miTimes.length > 0
        ? extractVideoThumbnails(apartment.moveInVideo.objectUrl, miTimes)
        : Promise.resolve(new Map()),
      apartment.moveOutVideo?.objectUrl && moTimes.length > 0
        ? extractVideoThumbnails(apartment.moveOutVideo.objectUrl, moTimes)
        : Promise.resolve(new Map()),
    ]).then(([miMap, moMap]) => {
      if (cancelled) return;
      const updates: Record<string, string> = {};
      miMap.forEach((v, k) => {
        updates[`move-in-${k}`] = v;
      });
      moMap.forEach((v, k) => {
        updates[`move-out-${k}`] = v;
      });
      if (Object.keys(updates).length > 0) {
        setFrameCache((prev) => ({ ...prev, ...updates }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    apartment.claims.length,
    apartment.moveInVideo?.objectUrl,
    apartment.moveOutVideo?.objectUrl,
  ]);

  const submitClaim = async (rawText: string) => {
    const parsed = parseClaimInput(rawText);
    if (!parsed.description) {
      setErrorMsg('Please enter a proposed deduction such as "Bedroom wall repair — $300".');
      return;
    }

    setErrorMsg(null);
    setIsMatching(true);

    try {
      const activeObservations = apartment.observations
        .filter((o) => o.reviewStatus !== 'dismissed')
        .map((o) => ({
          id: o.id,
          category: getObservationCategory(o),
          inspectionType: o.inspectionType,
          timestampSeconds: o.timestampSeconds,
          ...getEffectiveObservation(o),
          confidence: o.confidence,
          uncertaintyNote: o.uncertaintyNote,
          reviewStatus: o.reviewStatus,
        }));

      const resp = await fetch('/api/match-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimText: parsed.description,
          amountUsd: parsed.amountUsd,
          apartmentContext: {
            unitName: apartment.unitName,
            leaseStart: apartment.leaseStart,
            leaseEnd: apartment.leaseEnd,
            hasMoveInVideo: Boolean(apartment.moveInVideo),
            hasMoveOutVideo: Boolean(apartment.moveOutVideo),
          },
          observations: activeObservations,
          comparisons: apartment.comparisons,
        }),
      });

      const data = (await resp.json()) as ClaimMatch & ApiErrorPayload;
      if (!resp.ok) {
        const parsedErr = parseApiErrorResponse(data, 'Unable to match claim against evidence.');
        throw new Error(formatUiErrorBannerText(parsedErr));
      }

      onAddClaim(data);
      setClaimInput('');
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to match claim against visual evidence.'
      );
    } finally {
      setIsMatching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitClaim(claimInput);
  };

  const getThumb = (
    inspectionType: 'move-in' | 'move-out',
    ts: number,
    obsId?: string
  ): string | undefined => {
    if (obsId) {
      const obs = apartment.observations.find((o) => o.id === obsId);
      if (obs?.thumbnailDataUrl) return obs.thumbnailDataUrl;
    }
    const key = `${inspectionType}-${Math.max(0, Math.round(ts * 10) / 10)}`;
    return frameCache[key];
  };

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8">
      {apartment.isSample && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-[#946B28]/30 bg-[#F7F1E3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#20211F]">
            <span className="font-semibold text-[#946B28]">Sample Demonstration:</span>{' '}
            The initial &ldquo;Bedroom wall repair — $300&rdquo; entry is precomputed; entering any new deduction below runs live Gemini matching against these observations.
          </p>
          <span className="font-mono text-xs text-[#946B28] shrink-0">Hybrid Demo</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#DFDED8] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.06em] text-[#C9473D] uppercase">
            Claim-to-Evidence Matching
          </p>
          <h1 className="mt-1 font-serif text-3xl text-[#20211F] sm:text-4xl">
            Match landlord deductions to footage
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#62635F]">
            Enter a line item from your deposit statement to surface supporting move-in and move-out frames and generate a carefully qualified evidence summary.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('reconsideration')}
          className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[#20211F] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#353734] shrink-0 self-start sm:self-auto"
        >
          <span>Draft Reconsideration Request</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Deduction Entry Form */}
      <section className="mt-6 rounded-xl border border-[#DFDED8] bg-white p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="claim-input" className="sr-only">
              Proposed landlord deduction
            </label>
            <input
              id="claim-input"
              type="text"
              value={claimInput}
              onChange={(e) => setClaimInput(e.target.value)}
              placeholder='e.g., Bedroom wall repair — $300'
              className="w-full rounded-lg border border-[#DFDED8] bg-[#F8F7F3] px-4 py-2.5 text-sm text-[#20211F] placeholder:text-[#90918B] focus:bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={isMatching}
            className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-lg bg-[#20211F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#353734] disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {isMatching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>{isMatching ? 'Matching Evidence…' : 'Match Claim'}</span>
          </button>
        </form>

        {/* Quick deduction examples */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#62635F]">
          <span>Try an item:</span>
          {[
            'Kitchen countertop chip repair — $185',
            'Living room oak floor scratch — $240',
            'Bathroom towel bar & caulk — $150',
          ].map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setClaimInput(example)}
              className="cursor-pointer rounded-md border border-[#DFDED8] bg-[#F8F7F3] px-2.5 py-1 text-xs text-[#20211F] hover:bg-[#F0EEE9]"
            >
              {example}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-3 rounded-lg border border-[#C9473D]/40 bg-[#FBEDEB] px-3.5 py-2.5 text-sm text-[#93000a] sm:flex-row sm:items-center sm:justify-between"
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
      </section>

      {/* Matched Claims List */}
      <section className="mt-6 space-y-6">
        {apartment.claims.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#C5C4BD] bg-white p-10 text-center">
            <Scale className="mx-auto h-7 w-7 text-[#62635F]" />
            <p className="mt-3 font-serif text-xl text-[#20211F]">
              No deduction claims matched yet
            </p>
            <p className="mt-1 text-sm text-[#62635F]">
              Enter a proposed charge above to cross-reference your reviewed move-in and move-out video observations.
            </p>
          </div>
        ) : (
          apartment.claims.map((claim) => {
            const alignment = ALIGNMENT_LABELS[claim.evidenceAlignment];
            return (
              <article
                key={claim.id}
                className="rounded-xl border border-[#DFDED8] bg-white p-5 sm:p-6"
              >
                <div className="flex flex-col gap-3 border-b border-[#DFDED8] pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#62635F]">
                      <span>
                        {claim.source === 'sample-precomputed'
                          ? 'Precomputed sample match'
                          : 'Gemini evidence match'}
                      </span>
                      {claim.amountUsd !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-medium tabular-nums text-[#20211F]">
                            {formatCurrencyUsd(claim.amountUsd)}
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-1 font-serif text-2xl text-[#20211F]">
                      {claim.claimText}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 self-start">
                    <span
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${alignment.border} ${alignment.bg} ${alignment.text}`}
                    >
                      {alignment.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteClaim(claim.id)}
                      aria-label={`Remove claim ${claim.claimText}`}
                      className="cursor-pointer rounded-lg border border-[#DFDED8] p-1.5 text-[#62635F] hover:border-[#C9473D] hover:text-[#C9473D]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Supporting Video Frames */}
                {claim.keyTimestamps.length > 0 && (
                  <div className="mt-5">
                    <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
                      Supporting Video Evidence ({claim.keyTimestamps.length})
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {claim.keyTimestamps.map((ref, idx) => {
                        const thumb = getThumb(
                          ref.inspectionType,
                          ref.timestampSeconds,
                          ref.observationId
                        );
                        const videoObj =
                          ref.inspectionType === 'move-in'
                            ? apartment.moveInVideo
                            : apartment.moveOutVideo;

                        return (
                          <div
                            key={`${claim.id}-ts-${idx}`}
                            className="overflow-hidden rounded-lg border border-[#DFDED8] bg-[#F8F7F3]"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (videoObj?.objectUrl) {
                                  setPreviewClip({
                                    title: `${ref.inspectionType === 'move-in' ? 'Move-In' : 'Move-Out'} · ${ref.label}`,
                                    videoUrl: videoObj.objectUrl,
                                    timestamp: ref.timestampSeconds,
                                  });
                                }
                              }}
                              className="cursor-pointer group relative block w-full bg-[#1b1c1a]"
                            >
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt={`${ref.inspectionType} frame at ${formatTimestamp(ref.timestampSeconds)}`}
                                  className="aspect-video w-full object-cover group-hover:opacity-90"
                                />
                              ) : (
                                <div className="flex aspect-video w-full items-center justify-center text-xs font-mono text-white/70">
                                  Frame {formatTimestamp(ref.timestampSeconds)}
                                </div>
                              )}
                              <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-[#20211F]/85 px-2 py-0.5 font-mono text-[11px] tabular-nums text-white">
                                <Play className="h-3 w-3" />
                                <span>
                                  {ref.inspectionType === 'move-in' ? 'MOVE-IN' : 'MOVE-OUT'} ·{' '}
                                  {formatTimestamp(ref.timestampSeconds, true)}
                                </span>
                              </span>
                            </button>
                            <p className="p-3 text-xs leading-relaxed text-[#20211F]">
                              {ref.label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grounded Explanation & Limitations */}
                <div className="mt-5 space-y-3 border-t border-[#DFDED8] pt-4">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
                      Evidence Assessment
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#20211F]">
                      {claim.assessmentSummary}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#DFDED8] bg-[#F8F7F3] px-3.5 py-2.5 text-xs leading-relaxed text-[#454843]">
                    <span className="font-semibold text-[#20211F]">
                      Scope &amp; Limitations:{' '}
                    </span>
                    {claim.limitationsNote}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Inline Video Preview Modal */}
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
                  Seeked to {formatTimestamp(previewClip.timestamp)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewClip(null)}
                aria-label="Close clip preview"
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
