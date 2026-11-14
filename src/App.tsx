import { useEffect, useMemo, useState } from 'react';
import type {
  ApartmentRecord,
  AppScreen,
  ClaimMatch,
  ComparisonItem,
  InspectionType,
  Observation,
  ReconsiderationDraft,
  VideoMetadata,
} from './types/baseline';
import { createSampleApartment, SAMPLE_APARTMENT_ID } from './data/sampleApartment';
import { deleteVideoBlob, loadSavedApartments, loadVideoBlobUrl, persistApartments } from './utils/storage';
import { TopNav } from './components/TopNav';
import { LandingView } from './components/LandingView';
import { CreateApartmentModal } from './components/CreateApartmentModal';
import { ApartmentOverviewView } from './components/ApartmentOverviewView';
import { EvidenceTimelineView } from './components/EvidenceTimelineView';
import { ComparisonView } from './components/ComparisonView';
import { ClaimMatcherView } from './components/ClaimMatcherView';
import { ReconsiderationView } from './components/ReconsiderationView';
import { ReportView } from './components/ReportView';

function initializeApartments(): ApartmentRecord[] {
  const saved = loadSavedApartments();
  const hasSample = saved.some((a) => a.id === SAMPLE_APARTMENT_ID);
  if (hasSample) return saved;
  return [createSampleApartment(), ...saved];
}

export default function App() {
  const [apartments, setApartments] = useState<ApartmentRecord[]>(() =>
    initializeApartments()
  );
  const [activeApartmentId, setActiveApartmentId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      return SAMPLE_APARTMENT_ID;
    }
    return null;
  });
  const [activeScreen, setActiveScreen] = useState<AppScreen>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'overview' : 'landing';
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApartment, setEditingApartment] = useState<ApartmentRecord | null>(null);

  // Persist changes to localStorage
  useEffect(() => {
    persistApartments(apartments);
  }, [apartments]);

  // Rehydrate user-uploaded video objectUrls from IndexedDB or server playback URL on startup
  useEffect(() => {
    let cancelled = false;
    async function rehydrate() {
      const updates: Array<{
        aptId: string;
        side: 'moveInVideo' | 'moveOutVideo';
        url: string;
      }> = [];

      for (const apt of apartments) {
        if (apt.isSample) continue;
        for (const side of ['moveInVideo', 'moveOutVideo'] as const) {
          const vid = apt[side];
          if (vid && !vid.objectUrl) {
            const idbUrl = await loadVideoBlobUrl(vid.id);
            if (idbUrl) {
              updates.push({ aptId: apt.id, side, url: idbUrl });
            } else if (vid.serverFileId && vid.serverAccessToken) {
              updates.push({
                aptId: apt.id,
                side,
                url: `/api/videos/${encodeURIComponent(vid.serverFileId)}?token=${encodeURIComponent(vid.serverAccessToken)}`,
              });
            }
          }
        }
      }

      if (!cancelled && updates.length > 0) {
        setApartments((prev) =>
          prev.map((apt) => {
            const matching = updates.filter((u) => u.aptId === apt.id);
            if (matching.length === 0) return apt;
            const next = { ...apt };
            for (const m of matching) {
              const existing = next[m.side];
              if (existing) {
                next[m.side] = { ...existing, objectUrl: m.url };
              }
            }
            return next;
          })
        );
      }
    }
    rehydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeApartment = useMemo(
    () => apartments.find((a) => a.id === activeApartmentId) ?? null,
    [apartments, activeApartmentId]
  );

  const updateActiveApartment = (
    updater: (apt: ApartmentRecord) => ApartmentRecord
  ) => {
    if (!activeApartmentId) return;
    setApartments((prev) =>
      prev.map((apt) => (apt.id === activeApartmentId ? updater(apt) : apt))
    );
  };

  const handleSaveApartment = (data: {
    unitName: string;
    cityState: string;
    landlordOrManagement: string;
    leaseStart: string;
    leaseEnd: string;
    securityDepositUsd: number;
  }) => {
    if (editingApartment) {
      setApartments((prev) =>
        prev.map((apt) =>
          apt.id === editingApartment.id ? { ...apt, ...data } : apt
        )
      );
      setEditingApartment(null);
      setIsModalOpen(false);
      return;
    }

    const newApt: ApartmentRecord = {
      id: `apt-${Date.now()}`,
      isSample: false,
      ...data,
      createdAt: new Date().toISOString(),
      observations: [],
      comparisons: [],
      claims: [],
      reconsiderationDraft: {
        recipientName: data.landlordOrManagement || 'Property Management',
        subject: `Request for Reconsideration of Security Deposit Deductions — ${data.unitName}`,
        body: '',
      },
    };
    setApartments((prev) => [newApt, ...prev]);
    setActiveApartmentId(newApt.id);
    setActiveScreen('overview');
    setIsModalOpen(false);
  };

  const handleDeleteApartment = (id: string) => {
    const target = apartments.find((a) => a.id === id);
    if (target && !target.isSample) {
      for (const vid of [target.moveInVideo, target.moveOutVideo]) {
        if (!vid) continue;
        deleteVideoBlob(vid.id).catch(() => {});
        if (vid.serverFileId && vid.serverAccessToken) {
          fetch(`/api/videos/${encodeURIComponent(vid.serverFileId)}`, {
            method: 'DELETE',
            headers: { 'x-video-token': vid.serverAccessToken },
          }).catch(() => {});
        }
      }
    }
    setApartments((prev) => prev.filter((a) => a.id !== id));
    if (activeApartmentId === id) {
      setActiveApartmentId(null);
      setActiveScreen('landing');
    }
  };

  const handleUpdateVideo = (
    inspectionType: InspectionType,
    video: VideoMetadata,
    newObservations?: Observation[]
  ) => {
    updateActiveApartment((apt) => {
      const prevVideo =
        inspectionType === 'move-in' ? apt.moveInVideo : apt.moveOutVideo;
      const isSameVideo = Boolean(
        prevVideo &&
          (prevVideo.id === video.id ||
            (prevVideo.sha256 && video.sha256 && prevVideo.sha256 === video.sha256))
      );

      const next: ApartmentRecord = {
        ...apt,
        moveInVideo: inspectionType === 'move-in' ? video : apt.moveInVideo,
        moveOutVideo: inspectionType === 'move-out' ? video : apt.moveOutVideo,
      };
      if (newObservations) {
        const preservedOther = apt.observations.filter((o) => {
          if (o.inspectionType !== inspectionType) return true;
          if (o.source === 'manual') return true;
          if (isSameVideo && o.reviewStatus !== 'unreviewed') return true;
          return false;
        });
        next.observations = [...preservedOther, ...newObservations];
      }
      return next;
    });
  };

  const handleUpdateObservation = (
    obsId: string,
    updater: (obs: Observation) => Observation
  ) => {
    updateActiveApartment((apt) => ({
      ...apt,
      observations: apt.observations.map((o) => (o.id === obsId ? updater(o) : o)),
    }));
  };

  const handleAddManualObservation = (obs: Observation) => {
    updateActiveApartment((apt) => ({
      ...apt,
      observations: [...apt.observations, obs],
    }));
  };

  const handleBatchSetThumbnails = (
    updates: Array<{ id: string; thumbnailDataUrl: string }>
  ) => {
    const map = new Map(updates.map((u) => [u.id, u.thumbnailDataUrl]));
    updateActiveApartment((apt) => ({
      ...apt,
      observations: apt.observations.map((o) => {
        const url = map.get(o.id);
        return url ? { ...o, thumbnailDataUrl: url } : o;
      }),
    }));
  };

  const handleUpdateComparisons = (comparisons: ComparisonItem[]) => {
    updateActiveApartment((apt) => ({
      ...apt,
      comparisons,
    }));
  };

  const handleAddClaim = (claim: ClaimMatch) => {
    updateActiveApartment((apt) => ({
      ...apt,
      claims: [claim, ...apt.claims],
    }));
  };

  const handleDeleteClaim = (claimId: string) => {
    updateActiveApartment((apt) => ({
      ...apt,
      claims: apt.claims.filter((c) => c.id !== claimId),
    }));
  };

  const handleUpdateDraft = (draft: ReconsiderationDraft) => {
    updateActiveApartment((apt) => ({
      ...apt,
      reconsiderationDraft: draft,
    }));
  };

  return (
    <div className="min-h-screen bg-[#F8F7F3] text-[#20211F]">
      <TopNav
        activeScreen={activeScreen}
        activeApartment={activeApartment}
        onNavigate={(screen) => setActiveScreen(screen)}
        onOpenNewApartment={() => {
          setEditingApartment(null);
          setIsModalOpen(true);
        }}
        onReturnHome={() => setActiveScreen('landing')}
      />

      {activeScreen === 'landing' || !activeApartment ? (
        <LandingView
          apartments={apartments}
          onExploreSample={() => {
            setActiveApartmentId(SAMPLE_APARTMENT_ID);
            setActiveScreen('overview');
          }}
          onOpenNewApartment={() => {
            setEditingApartment(null);
            setIsModalOpen(true);
          }}
          onSelectApartment={(id) => {
            setActiveApartmentId(id);
            setActiveScreen('overview');
          }}
          onDeleteApartment={handleDeleteApartment}
        />
      ) : activeScreen === 'overview' ? (
        <ApartmentOverviewView
          apartment={activeApartment}
          onNavigate={setActiveScreen}
          onEditApartment={() => {
            setEditingApartment(activeApartment);
            setIsModalOpen(true);
          }}
        />
      ) : activeScreen === 'move-in' ? (
        <EvidenceTimelineView
          apartment={activeApartment}
          inspectionType="move-in"
          onUpdateVideo={handleUpdateVideo}
          onUpdateObservation={handleUpdateObservation}
          onAddManualObservation={handleAddManualObservation}
          onBatchSetThumbnails={handleBatchSetThumbnails}
          onOpenSample={() => {
            setActiveApartmentId(SAMPLE_APARTMENT_ID);
            setActiveScreen('overview');
          }}
        />
      ) : activeScreen === 'move-out' ? (
        <EvidenceTimelineView
          apartment={activeApartment}
          inspectionType="move-out"
          onUpdateVideo={handleUpdateVideo}
          onUpdateObservation={handleUpdateObservation}
          onAddManualObservation={handleAddManualObservation}
          onBatchSetThumbnails={handleBatchSetThumbnails}
          onOpenSample={() => {
            setActiveApartmentId(SAMPLE_APARTMENT_ID);
            setActiveScreen('overview');
          }}
        />
      ) : activeScreen === 'compare' ? (
        <ComparisonView
          apartment={activeApartment}
          onUpdateComparisons={handleUpdateComparisons}
          onNavigate={setActiveScreen}
          onOpenSample={() => {
            setActiveApartmentId(SAMPLE_APARTMENT_ID);
            setActiveScreen('overview');
          }}
        />
      ) : activeScreen === 'claims' ? (
        <ClaimMatcherView
          apartment={activeApartment}
          onAddClaim={handleAddClaim}
          onDeleteClaim={handleDeleteClaim}
          onNavigate={setActiveScreen}
          onOpenSample={() => {
            setActiveApartmentId(SAMPLE_APARTMENT_ID);
            setActiveScreen('overview');
          }}
        />
      ) : activeScreen === 'reconsideration' ? (
        <ReconsiderationView
          apartment={activeApartment}
          onUpdateDraft={handleUpdateDraft}
          onNavigate={setActiveScreen}
          onOpenSample={() => {
            setActiveApartmentId(SAMPLE_APARTMENT_ID);
            setActiveScreen('overview');
          }}
        />
      ) : (
        <ReportView
          apartment={activeApartment}
          onBatchSetThumbnails={handleBatchSetThumbnails}
        />
      )}

      <CreateApartmentModal
        key={editingApartment?.id ?? (isModalOpen ? 'new-open' : 'closed')}
        isOpen={isModalOpen}
        initialRecord={editingApartment}
        onClose={() => {
          setIsModalOpen(false);
          setEditingApartment(null);
        }}
        onSave={handleSaveApartment}
      />
    </div>
  );
}
