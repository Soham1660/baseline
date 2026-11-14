import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { ApartmentRecord } from '../types/baseline';

interface CreateApartmentModalProps {
  isOpen: boolean;
  initialRecord?: ApartmentRecord | null;
  onClose: () => void;
  onSave: (data: {
    unitName: string;
    cityState: string;
    landlordOrManagement: string;
    leaseStart: string;
    leaseEnd: string;
    securityDepositUsd: number;
  }) => void;
}

export const CreateApartmentModal: React.FC<CreateApartmentModalProps> = ({
  isOpen,
  initialRecord,
  onClose,
  onSave,
}) => {
  const [unitName, setUnitName] = useState(initialRecord?.unitName ?? '');
  const [cityState, setCityState] = useState(initialRecord?.cityState ?? '');
  const [landlordOrManagement, setLandlordOrManagement] = useState(
    initialRecord?.landlordOrManagement ?? ''
  );
  const [leaseStart, setLeaseStart] = useState(
    initialRecord?.leaseStart ?? new Date().toISOString().slice(0, 10)
  );
  const [leaseEnd, setLeaseEnd] = useState(initialRecord?.leaseEnd ?? '');
  const [depositStr, setDepositStr] = useState(
    initialRecord ? String(initialRecord.securityDepositUsd) : '2400'
  );
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUnit = unitName.trim();
    if (!trimmedUnit) {
      setError('Please enter an apartment street address or unit name.');
      return;
    }
    const parsedDeposit = Number(depositStr.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(parsedDeposit) || parsedDeposit < 0) {
      setError('Please enter a valid security deposit amount (0 or higher).');
      return;
    }
    setError(null);
    onSave({
      unitName: trimmedUnit,
      cityState: cityState.trim(),
      landlordOrManagement: landlordOrManagement.trim(),
      leaseStart: leaseStart.trim(),
      leaseEnd: leaseEnd.trim(),
      securityDepositUsd: parsedDeposit,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="apartment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#20211F]/40 p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#DFDED8] bg-white p-6 sm:p-8 shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-[#DFDED8] pb-4">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
              Apartment Record
            </p>
            <h2
              id="apartment-modal-title"
              className="mt-1 font-serif text-2xl text-[#20211F]"
            >
              {initialRecord ? 'Edit Apartment Details' : 'Create Apartment Record'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close apartment form"
            className="cursor-pointer rounded-lg p-2 text-[#62635F] hover:bg-[#F0EEE9] hover:text-[#20211F]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-[#C9473D]/30 bg-[#FBEDEB] px-3.5 py-2.5 text-sm text-[#93000a]"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="apt-unit-name"
              className="block text-[13px] font-medium text-[#20211F]"
            >
              Unit Address or Identifier *
            </label>
            <input
              id="apt-unit-name"
              type="text"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              placeholder="e.g., 418 Telegraph Ave, Apt 3A"
              className="mt-1.5 w-full rounded-lg border border-[#DFDED8] bg-white px-3.5 py-2.5 text-sm text-[#20211F] placeholder:text-[#90918B] focus:border-[#355E87]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="apt-city-state"
                className="block text-[13px] font-medium text-[#20211F]"
              >
                City, State
              </label>
              <input
                id="apt-city-state"
                type="text"
                value={cityState}
                onChange={(e) => setCityState(e.target.value)}
                placeholder="e.g., Berkeley, CA"
                className="mt-1.5 w-full rounded-lg border border-[#DFDED8] bg-white px-3.5 py-2.5 text-sm text-[#20211F] placeholder:text-[#90918B]"
              />
            </div>

            <div>
              <label
                htmlFor="apt-deposit"
                className="block text-[13px] font-medium text-[#20211F]"
              >
                Security Deposit (USD)
              </label>
              <input
                id="apt-deposit"
                type="number"
                min="0"
                step="1"
                value={depositStr}
                onChange={(e) => setDepositStr(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#DFDED8] bg-white px-3.5 py-2.5 font-mono text-sm tabular-nums text-[#20211F]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="apt-landlord"
              className="block text-[13px] font-medium text-[#20211F]"
            >
              Landlord or Management Company
            </label>
            <input
              id="apt-landlord"
              type="text"
              value={landlordOrManagement}
              onChange={(e) => setLandlordOrManagement(e.target.value)}
              placeholder="e.g., Elmwood Property Management"
              className="mt-1.5 w-full rounded-lg border border-[#DFDED8] bg-white px-3.5 py-2.5 text-sm text-[#20211F] placeholder:text-[#90918B]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="apt-lease-start"
                className="block text-[13px] font-medium text-[#20211F]"
              >
                Lease Start Date
              </label>
              <input
                id="apt-lease-start"
                type="date"
                value={leaseStart}
                onChange={(e) => setLeaseStart(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#DFDED8] bg-white px-3.5 py-2.5 font-mono text-sm text-[#20211F]"
              />
            </div>
            <div>
              <label
                htmlFor="apt-lease-end"
                className="block text-[13px] font-medium text-[#20211F]"
              >
                Lease End Date
              </label>
              <input
                id="apt-lease-end"
                type="date"
                value={leaseEnd}
                onChange={(e) => setLeaseEnd(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#DFDED8] bg-white px-3.5 py-2.5 font-mono text-sm text-[#20211F]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#DFDED8] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-[#DFDED8] bg-white px-4 py-2 text-sm font-medium text-[#20211F] hover:bg-[#F0EEE9]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="cursor-pointer rounded-lg bg-[#20211F] px-5 py-2 text-sm font-medium text-white hover:bg-[#353734]"
            >
              {initialRecord ? 'Save Changes' : 'Create Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
