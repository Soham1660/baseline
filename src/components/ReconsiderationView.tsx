import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  FileEdit,
  Loader2,
} from 'lucide-react';
import type {
  ApartmentRecord,
  AppScreen,
  ReconsiderationDraft,
} from '../types/baseline';
import { getEffectiveObservation, getObservationCategory } from '../utils/evidenceLogic';
import {
  formatUiErrorBannerText,
  parseApiErrorResponse,
  type ApiErrorPayload,
} from '../utils/apiErrorFormat';

interface ReconsiderationViewProps {
  apartment: ApartmentRecord;
  onUpdateDraft: (draft: ReconsiderationDraft) => void;
  onNavigate: (screen: AppScreen) => void;
  onOpenSample?: () => void;
}

export const ReconsiderationView: React.FC<ReconsiderationViewProps> = ({
  apartment,
  onUpdateDraft,
  onNavigate,
  onOpenSample,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const draft = apartment.reconsiderationDraft;

  const handleGenerate = async () => {
    setErrorMsg(null);
    setIsGenerating(true);
    try {
      const activeObservations = apartment.observations
        .filter((o) => o.reviewStatus !== 'dismissed')
        .map((o) => ({
          id: o.id,
          category: getObservationCategory(o),
          inspectionType: o.inspectionType,
          timestampSeconds: o.timestampSeconds,
          ...getEffectiveObservation(o),
          reviewStatus: o.reviewStatus,
        }));

      const resp = await fetch('/api/generate-reconsideration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apartment: {
            unitName: apartment.unitName,
            cityState: apartment.cityState,
            landlordOrManagement: apartment.landlordOrManagement,
            leaseStart: apartment.leaseStart,
            leaseEnd: apartment.leaseEnd,
            securityDepositUsd: apartment.securityDepositUsd,
            moveInSha256: apartment.moveInVideo?.sha256,
            moveOutSha256: apartment.moveOutVideo?.sha256,
          },
          claims: apartment.claims,
          observations: activeObservations,
          comparisons: apartment.comparisons,
        }),
      });

      const data = (await resp.json()) as ApiErrorPayload & {
        subject?: string;
        body?: string;
        generatedAt?: string;
      };
      if (!resp.ok) {
        const parsedErr = parseApiErrorResponse(data, 'Failed to generate reconsideration letter.');
        throw new Error(formatUiErrorBannerText(parsedErr));
      }

      onUpdateDraft({
        recipientName:
          draft.recipientName || apartment.landlordOrManagement || 'Property Management',
        subject: data.subject || draft.subject,
        body: data.body || draft.body,
        generatedAt: data.generatedAt || new Date().toISOString(),
        source: 'gemini-live',
      });
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to generate reconsideration draft.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    const fullText = `Subject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failures in restricted frames
    }
  };

  return (
    <main className="mx-auto max-w-[1000px] px-4 py-8 sm:px-8">
      {apartment.isSample && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-[#946B28]/30 bg-[#F7F1E3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#20211F]">
            <span className="font-semibold text-[#946B28]">Sample Demonstration:</span>{' '}
            Precomputed draft grounded in the sample evidence. Click &ldquo;Generate Draft with Gemini&rdquo; to regenerate live from all current claims.
          </p>
          <span className="font-mono text-xs text-[#946B28] shrink-0">Hybrid Demo</span>
        </div>
      )}
      <div className="flex flex-col gap-4 border-b border-[#DFDED8] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
            {apartment.unitName}
          </p>
          <h1 className="mt-1 font-serif text-3xl text-[#20211F] sm:text-4xl">
            Reconsideration Request
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[#62635F]">
            A polite, evidence-grounded letter referencing only reviewed timestamps and verified file fingerprints — without legal jargon or unsupported claims.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-[#C5C4BD] bg-white px-4 py-2.5 text-xs font-medium text-[#20211F] hover:bg-[#F0EEE9] disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileEdit className="h-3.5 w-3.5" />
            )}
            <span>{isGenerating ? 'Drafting…' : 'Generate Draft with Gemini'}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('report')}
            className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[#20211F] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#353734]"
          >
            <span>Preview &amp; Export PDF</span>
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

      <section className="mt-6 rounded-xl border border-[#DFDED8] bg-white p-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="letter-recipient"
              className="block text-xs font-medium text-[#62635F]"
            >
              Recipient (Landlord / Management)
            </label>
            <input
              id="letter-recipient"
              type="text"
              value={draft.recipientName}
              onChange={(e) =>
                onUpdateDraft({ ...draft, recipientName: e.target.value, source: 'edited' })
              }
              className="mt-1.5 w-full rounded-lg border border-[#DFDED8] bg-white px-3.5 py-2 text-sm text-[#20211F]"
            />
          </div>

          <div>
            <label
              htmlFor="letter-subject"
              className="block text-xs font-medium text-[#62635F]"
            >
              Subject Line
            </label>
            <input
              id="letter-subject"
              type="text"
              value={draft.subject}
              onChange={(e) =>
                onUpdateDraft({ ...draft, subject: e.target.value, source: 'edited' })
              }
              className="mt-1.5 w-full rounded-lg border border-[#DFDED8] bg-white px-3.5 py-2 text-sm text-[#20211F]"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="letter-body" className="block text-xs font-medium text-[#62635F]">
              Letter Body (Editable)
            </label>
            <button
              type="button"
              onClick={handleCopy}
              className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-[#20211F] hover:underline"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#4C735B]" />
                  <span className="text-[#4C735B]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Letter</span>
                </>
              )}
            </button>
          </div>
          <textarea
            id="letter-body"
            rows={15}
            value={draft.body}
            onChange={(e) =>
              onUpdateDraft({ ...draft, body: e.target.value, source: 'edited' })
            }
            placeholder="Click 'Generate Draft with Gemini' to compose a polite reconsideration letter based on your matched claims and timestamps, or write directly here."
            className="mt-2 w-full rounded-lg border border-[#DFDED8] bg-[#F8F7F3] p-4 text-sm leading-relaxed text-[#20211F] focus:bg-white"
          />
        </div>

        <p className="text-xs text-[#62635F]">
          This draft is included automatically in Section 5 of your exported PDF Evidence Report.
        </p>
      </section>
    </main>
  );
};
