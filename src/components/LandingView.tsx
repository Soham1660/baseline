import React from 'react';
import { ArrowRight, FileCheck2, Film, Scale, ShieldCheck, Trash2 } from 'lucide-react';
import type { ApartmentRecord } from '../types/baseline';
import { calculateInspectionSummary, formatCurrencyUsd } from '../utils/evidenceLogic';

interface LandingViewProps {
  apartments: ApartmentRecord[];
  onExploreSample: () => void;
  onOpenNewApartment: () => void;
  onSelectApartment: (apartmentId: string) => void;
  onDeleteApartment: (apartmentId: string) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  apartments,
  onExploreSample,
  onOpenNewApartment,
  onSelectApartment,
  onDeleteApartment,
}) => {
  const userApartments = apartments.filter((a) => !a.isSample);
  const sampleApartment = apartments.find((a) => a.isSample);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-8 sm:py-16">
      {/* Editorial Hero */}
      <section className="grid grid-cols-1 gap-10 border-b border-[#DFDED8] pb-12 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-[#62635F] uppercase">
            Renter Evidence Instrument
          </p>
          <h1
            style={{ textWrap: 'balance' }}
            className="mt-4 font-serif text-[40px] leading-[1.12] tracking-[-0.02em] font-normal text-[#20211F] sm:text-[60px] sm:leading-[1.08]"
          >
            Your apartment. Your evidence.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-[1.6] text-[#454843]">
            BASELINE turns move-in and move-out walkthrough videos into a timestamped,
            human-verified condition record. Match disputed deposit deductions directly
            to video frames and export an organized reconsideration report — without
            creating an account.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onExploreSample}
              className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[#20211F] px-5 py-3 text-sm font-medium text-white hover:bg-[#353734] transition-colors whitespace-nowrap shrink-0"
            >
              <span>Explore Sample Apartment</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onOpenNewApartment}
              className="cursor-pointer rounded-lg border border-[#C5C4BD] bg-white px-5 py-3 text-sm font-medium text-[#20211F] hover:bg-[#F0EEE9] transition-colors whitespace-nowrap shrink-0"
            >
              Create Apartment Record
            </button>
          </div>
        </div>

        {/* Sample Preview Reference Panel */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-[#DFDED8] bg-white p-5">
            <div className="flex items-center justify-between border-b border-[#DFDED8] pb-3">
              <span className="text-[11px] font-semibold tracking-[0.06em] text-[#946B28] uppercase">
                Sample Demonstration
              </span>
              <span className="font-mono text-xs tabular-nums text-[#62635F]">
                Precomputed
              </span>
            </div>
            <p className="mt-3 font-serif text-xl text-[#20211F]">
              {sampleApartment?.unitName ?? '742 Valencia St, Apt 4B'}
            </p>
            <p className="mt-1 text-xs text-[#62635F]">
              Move-in &amp; move-out walkthroughs · 11 timestamped findings · $300 wall deduction matched
            </p>
            <button
              type="button"
              onClick={onExploreSample}
              className="cursor-pointer mt-4 inline-flex w-full items-center justify-between rounded-lg border border-[#DFDED8] bg-[#F8F7F3] px-3.5 py-2.5 text-xs font-medium text-[#20211F] hover:bg-[#F0EEE9] transition-colors"
            >
              <span>Open sample case file</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#62635F]" />
            </button>
          </div>
        </div>
      </section>

      {/* Four-Step Workflow */}
      <section id="workflow" className="border-b border-[#DFDED8] py-12">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
              Inspection Workflow
            </p>
            <h2 className="mt-1 font-serif text-3xl text-[#20211F]">
              Evidence first, at every step
            </h2>
          </div>
          <p className="max-w-md text-sm text-[#62635F]">
            AI findings remain proposals until you confirm, edit, or dismiss them against the original footage.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#DFDED8] bg-white p-5">
            <div className="flex items-center justify-between text-xs text-[#62635F]">
              <span className="font-mono tabular-nums">01</span>
              <Film className="h-4 w-4 text-[#62635F]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#20211F]">
              Capture &amp; Fingerprint
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#62635F]">
              Upload a move-in walkthrough video. BASELINE computes its SHA-256 fingerprint and logs file metadata.
            </p>
          </div>

          <div className="rounded-xl border border-[#DFDED8] bg-white p-5">
            <div className="flex items-center justify-between text-xs text-[#62635F]">
              <span className="font-mono tabular-nums">02</span>
              <FileCheck2 className="h-4 w-4 text-[#62635F]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#20211F]">
              Timestamped Review
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#62635F]">
              Gemini extracts visible conditions with exact timestamps. Click any marker to jump directly to the frame.
            </p>
          </div>

          <div className="rounded-xl border border-[#DFDED8] bg-white p-5">
            <div className="flex items-center justify-between text-xs text-[#62635F]">
              <span className="font-mono tabular-nums">03</span>
              <Scale className="h-4 w-4 text-[#62635F]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#20211F]">
              Conservative Comparison
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#62635F]">
              Compare move-out footage side-by-side with explicit uncertainty when angles or lighting differ.
            </p>
          </div>

          <div className="rounded-xl border border-[#DFDED8] bg-white p-5">
            <div className="flex items-center justify-between text-xs text-[#62635F]">
              <span className="font-mono tabular-nums">04</span>
              <ShieldCheck className="h-4 w-4 text-[#62635F]" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-[#20211F]">
              Claim-to-Evidence Match
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#62635F]">
              Enter a proposed deduction to surface supporting clips, draft a polite reconsideration request, and export a PDF.
            </p>
          </div>
        </div>
      </section>

      {/* Saved Apartment Records */}
      <section id="records" className="border-b border-[#DFDED8] py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
              Your Case Files
            </p>
            <h2 className="mt-1 font-serif text-3xl text-[#20211F]">
              Saved apartment records
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenNewApartment}
            className="cursor-pointer rounded-lg border border-[#C5C4BD] bg-white px-4 py-2 text-xs font-medium text-[#20211F] hover:bg-[#F0EEE9]"
          >
            + Add Apartment
          </button>
        </div>

        {userApartments.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-[#C5C4BD] bg-white/70 p-8 text-center">
            <p className="text-sm font-medium text-[#20211F]">
              No personal apartment records yet.
            </p>
            <p className="mt-1 text-sm text-[#62635F]">
              Create an apartment record to upload your own walkthrough video for live Gemini inspection, or explore the precomputed sample above.
            </p>
          </div>
        ) : (
          <div className="mt-6 divide-y divide-[#DFDED8] rounded-xl border border-[#DFDED8] bg-white">
            {userApartments.map((apt) => {
              const summary = calculateInspectionSummary(apt);
              return (
                <div
                  key={apt.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#62635F]">
                      <span>{apt.cityState || 'Address recorded'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        Deposit {formatCurrencyUsd(apt.securityDepositUsd)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {summary.moveInCount} move-in / {summary.moveOutCount} move-out findings
                      </span>
                    </div>
                    <h3 className="mt-1 font-serif text-xl text-[#20211F]">
                      {apt.unitName}
                    </h3>
                    <p className="mt-0.5 text-xs text-[#62635F]">
                      {apt.landlordOrManagement || 'Landlord unspecified'}
                      {apt.leaseStart ? ` · Lease ${apt.leaseStart}` : ''}
                      {apt.leaseEnd ? ` to ${apt.leaseEnd}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectApartment(apt.id)}
                      className="cursor-pointer rounded-lg bg-[#20211F] px-4 py-2 text-xs font-medium text-white hover:bg-[#353734]"
                    >
                      Open Record
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteApartment(apt.id)}
                      aria-label={`Delete record for ${apt.unitName}`}
                      className="cursor-pointer rounded-lg border border-[#DFDED8] bg-white p-2 text-[#62635F] hover:border-[#C9473D] hover:text-[#C9473D]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Integrity & Privacy Footer Note */}
      <section id="integrity" className="pt-10">
        <div className="grid grid-cols-1 gap-8 rounded-xl border border-[#DFDED8] bg-[#F0EEE9]/60 p-6 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
              Evidence Integrity
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#454843]">
              Every uploaded video receives a SHA-256 cryptographic fingerprint alongside original file metadata. Hashing verifies whether a file was altered after recording, though it does not independently prove the filming date.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
              Private By Default
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#454843]">
              No account is required. Your apartment records stay stored privately in your browser, and videos are only sent to the server when you explicitly run Gemini analysis or comparison.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};
