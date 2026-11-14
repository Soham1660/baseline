import React from 'react';
import { ArrowRight, Edit3, FileText, Film, Lock, ShieldCheck } from 'lucide-react';
import type { ApartmentRecord, AppScreen } from '../types/baseline';
import {
  calculateInspectionSummary,
  formatBytes,
  formatCurrencyUsd,
  formatTimestamp,
} from '../utils/evidenceLogic';

interface ApartmentOverviewViewProps {
  apartment: ApartmentRecord;
  onNavigate: (screen: AppScreen) => void;
  onEditApartment: () => void;
}

export const ApartmentOverviewView: React.FC<ApartmentOverviewViewProps> = ({
  apartment,
  onNavigate,
  onEditApartment,
}) => {
  const summary = calculateInspectionSummary(apartment);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-8 sm:px-8 sm:py-10">
      {apartment.isSample && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-[#946B28]/30 bg-[#F7F1E3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[#20211F]">
            <span className="font-semibold text-[#946B28]">Sample Demonstration:</span>{' '}
            This record uses real sample walkthrough videos with precomputed observations so you can explore the full workflow immediately.
          </div>
          <span className="font-mono text-xs text-[#946B28] shrink-0">
            Precomputed Demo
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#DFDED8] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
            Apartment Case Record
          </p>
          <h1 className="mt-1 font-serif text-3xl text-[#20211F] sm:text-4xl">
            {apartment.unitName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#62635F]">
            {apartment.cityState && <span>{apartment.cityState}</span>}
            {apartment.cityState && <span aria-hidden="true">·</span>}
            <span>{apartment.landlordOrManagement || 'Landlord unspecified'}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              Lease {apartment.leaseStart || 'N/A'} to {apartment.leaseEnd || 'N/A'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums font-medium text-[#20211F]">
              Deposit {formatCurrencyUsd(apartment.securityDepositUsd)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onEditApartment}
          className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-[#DFDED8] bg-white px-3.5 py-2 text-xs font-medium text-[#20211F] hover:bg-[#F0EEE9] self-start sm:self-auto"
        >
          <Edit3 className="h-3.5 w-3.5" />
          <span>Edit Details</span>
        </button>
      </div>

      {/* 4-Column Summary Strip */}
      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#DFDED8] bg-white p-4">
          <p className="text-xs text-[#62635F]">Move-In Observations</p>
          <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-[#20211F]">
            {summary.moveInCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#DFDED8] bg-white p-4">
          <p className="text-xs text-[#62635F]">Move-Out Observations</p>
          <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-[#20211F]">
            {summary.moveOutCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#DFDED8] bg-white p-4">
          <p className="text-xs text-[#62635F]">Human Reviewed</p>
          <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-[#4C735B]">
            {summary.confirmedCount + summary.editedCount}
          </p>
        </div>
        <div className="rounded-xl border border-[#DFDED8] bg-white p-4">
          <p className="text-xs text-[#62635F]">Proposed Deductions</p>
          <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-[#C9473D]">
            {formatCurrencyUsd(summary.totalClaimedUsd)}
          </p>
        </div>
      </section>

      {/* Move-In & Move-Out Walkthrough Panels */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Move-In Panel */}
        <div className="flex flex-col justify-between rounded-xl border border-[#DFDED8] bg-white p-6">
          <div>
            <div className="flex items-center justify-between border-b border-[#DFDED8] pb-3">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-[#62635F]" />
                <h2 className="font-serif text-2xl text-[#20211F]">
                  Move-In Inspection
                </h2>
              </div>
              <span
                className={`text-xs font-medium ${
                  apartment.moveInVideo ? 'text-[#4C735B]' : 'text-[#946B28]'
                }`}
              >
                {apartment.moveInVideo ? 'Recorded' : 'Pending Upload'}
              </span>
            </div>

            {apartment.moveInVideo ? (
              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#62635F]">Source File</dt>
                  <dd className="font-mono text-[#20211F] truncate">
                    {apartment.moveInVideo.fileName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#62635F]">Duration &amp; Size</dt>
                  <dd className="font-mono tabular-nums text-[#20211F]">
                    {formatTimestamp(apartment.moveInVideo.durationSeconds)} ·{' '}
                    {formatBytes(apartment.moveInVideo.fileSizeBytes)}
                  </dd>
                </div>
                <div className="flex flex-col gap-1 pt-1">
                  <dt className="text-[#62635F]">SHA-256 Fingerprint</dt>
                  <dd className="break-all rounded-md bg-[#F0EEE9] px-2.5 py-1.5 font-mono text-[11px] text-[#20211F]">
                    {apartment.moveInVideo.sha256}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-[#62635F]">
                Upload your move-in walkthrough video to compute its SHA-256 hash and extract timestamped baseline conditions with Gemini.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('move-in')}
            className="cursor-pointer mt-6 inline-flex items-center justify-between rounded-lg bg-[#20211F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#353734]"
          >
            <span>
              {apartment.moveInVideo ? 'Inspect Move-In Timeline' : 'Upload Move-In Video'}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Move-Out Panel */}
        <div className="flex flex-col justify-between rounded-xl border border-[#DFDED8] bg-white p-6">
          <div>
            <div className="flex items-center justify-between border-b border-[#DFDED8] pb-3">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-[#62635F]" />
                <h2 className="font-serif text-2xl text-[#20211F]">
                  Move-Out Inspection
                </h2>
              </div>
              <span
                className={`text-xs font-medium ${
                  apartment.moveOutVideo ? 'text-[#4C735B]' : 'text-[#62635F]'
                }`}
              >
                {apartment.moveOutVideo ? 'Recorded' : 'Not Uploaded Yet'}
              </span>
            </div>

            {apartment.moveOutVideo ? (
              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#62635F]">Source File</dt>
                  <dd className="font-mono text-[#20211F] truncate">
                    {apartment.moveOutVideo.fileName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#62635F]">Duration &amp; Size</dt>
                  <dd className="font-mono tabular-nums text-[#20211F]">
                    {formatTimestamp(apartment.moveOutVideo.durationSeconds)} ·{' '}
                    {formatBytes(apartment.moveOutVideo.fileSizeBytes)}
                  </dd>
                </div>
                <div className="flex flex-col gap-1 pt-1">
                  <dt className="text-[#62635F]">SHA-256 Fingerprint</dt>
                  <dd className="break-all rounded-md bg-[#F0EEE9] px-2.5 py-1.5 font-mono text-[11px] text-[#20211F]">
                    {apartment.moveOutVideo.sha256}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-[#62635F]">
                When leaving the apartment, upload a move-out walkthrough to compare conditions conservatively and match landlord deduction claims.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate('move-out')}
            className="cursor-pointer mt-6 inline-flex items-center justify-between rounded-lg border border-[#C5C4BD] bg-white px-4 py-2.5 text-sm font-medium text-[#20211F] hover:bg-[#F0EEE9]"
          >
            <span>
              {apartment.moveOutVideo ? 'Inspect Move-Out Timeline' : 'Upload Move-Out Video'}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Quick Actions Strip for Comparison, Claim Matching, and Report */}
      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate('compare')}
          className="cursor-pointer rounded-xl border border-[#DFDED8] bg-white p-5 text-left hover:border-[#20211F] transition-colors"
        >
          <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
            Comparison Engine
          </p>
          <p className="mt-1 font-serif text-xl text-[#20211F]">
            Compare Inspections
          </p>
          <p className="mt-1 text-xs text-[#62635F]">
            {apartment.comparisons.length} area comparisons logged
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('claims')}
          className="cursor-pointer rounded-xl border border-[#DFDED8] bg-white p-5 text-left hover:border-[#20211F] transition-colors"
        >
          <p className="text-[11px] font-semibold tracking-[0.06em] text-[#C9473D] uppercase">
            Claim Matching
          </p>
          <p className="mt-1 font-serif text-xl text-[#20211F]">
            Match Landlord Deductions
          </p>
          <p className="mt-1 text-xs text-[#62635F]">
            {apartment.claims.length} deduction{apartment.claims.length === 1 ? '' : 's'} analyzed
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('report')}
          className="cursor-pointer rounded-xl border border-[#DFDED8] bg-white p-5 text-left hover:border-[#20211F] transition-colors"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
              Exportable Dossier
            </p>
            <FileText className="h-4 w-4 text-[#62635F]" />
          </div>
          <p className="mt-1 font-serif text-xl text-[#20211F]">
            Evidence Report &amp; PDF
          </p>
          <p className="mt-1 text-xs text-[#62635F]">
            Includes hashes, frames, and letter
          </p>
        </button>
      </section>

      {/* Integrity & Privacy Panel */}
      <section className="mt-8 grid grid-cols-1 gap-6 rounded-xl border border-[#DFDED8] bg-[#F0EEE9]/60 p-6 md:grid-cols-2">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#4C735B]" />
          <div>
            <h3 className="text-sm font-semibold text-[#20211F]">
              File Integrity Verification (SHA-256)
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#454843]">
              SHA-256 hashing detects any subsequent modification to the video file bytes and preserves original file metadata. Note that hashing alone does not independently verify the filming date or physical location.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#62635F]" />
          <div>
            <h3 className="text-sm font-semibold text-[#20211F]">
              Private by Default
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[#454843]">
              This apartment record is private to your browser session. Reports and footage are never published or shared externally unless you download and send the exported PDF.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};
