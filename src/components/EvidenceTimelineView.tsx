import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Edit3,
  Film,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  SkipBack,
  SkipForward,
  Upload,
  Video,
  X,
} from 'lucide-react';
import type {
  ApartmentRecord,
  InspectionType,
  Observation,
  ReviewStatus,
  Severity,
  VideoMetadata,
} from '../types/baseline';
import {
  formatBytes,
  formatTimestamp,
  getEffectiveObservation,
  getObservationCategory,
} from '../utils/evidenceLogic';
import {
  captureCurrentVideoFrame,
  computeFileSha256,
  extractVideoThumbnails,
  probeVideoFile,
} from '../utils/videoFrames';
import { deleteVideoBlob, saveVideoBlob } from '../utils/storage';
import {
  formatUiErrorBannerText,
  parseApiErrorResponse,
  type ApiErrorPayload,
} from '../utils/apiErrorFormat';

interface EvidenceTimelineViewProps {
  apartment: ApartmentRecord;
  inspectionType: InspectionType;
  onUpdateVideo: (
    inspectionType: InspectionType,
    video: VideoMetadata,
    newObservations?: Observation[]
  ) => void;
  onUpdateObservation: (obsId: string, updater: (obs: Observation) => Observation) => void;
  onAddManualObservation: (obs: Observation) => void;
  onBatchSetThumbnails: (updates: Array<{ id: string; thumbnailDataUrl: string }>) => void;
  onOpenSample?: () => void;
}

type FilterTab = 'all' | 'unreviewed' | 'confirmed' | 'dismissed';

export const EvidenceTimelineView: React.FC<EvidenceTimelineViewProps> = ({
  apartment,
  inspectionType,
  onUpdateVideo,
  onUpdateObservation,
  onAddManualObservation,
  onBatchSetThumbnails,
  onOpenSample,
}) => {
  const videoMeta =
    inspectionType === 'move-in' ? apartment.moveInVideo : apartment.moveOutVideo;
  const inspectionObservations = useMemo(
    () =>
      apartment.observations
        .filter((o) => o.inspectionType === inspectionType)
        .sort((a, b) => a.timestampSeconds - b.timestampSeconds),
    [apartment.observations, inspectionType]
  );

  const damageObservations = useMemo(
    () =>
      inspectionObservations.filter(
        (o) => getObservationCategory(o) === 'potential-damage'
      ),
    [inspectionObservations]
  );

  const coverageObservations = useMemo(
    () =>
      inspectionObservations.filter(
        (o) => getObservationCategory(o) === 'condition-observation'
      ),
    [inspectionObservations]
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(videoMeta?.durationSeconds || 0);
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null);
  const [showCoverage, setShowCoverage] = useState(false);

  // Filters
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [roomFilter, setRoomFilter] = useState<string>('all');

  // Upload & Analysis states
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [liveErrorBanner, setLiveErrorBanner] = useState<string | null>(null);
  const [dismissedHistoricalError, setDismissedHistoricalError] = useState(false);
  const [retryCooldownSec, setRetryCooldownSec] = useState<number>(0);

  // Camera recording states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Inline Edit states
  const [editingObsId, setEditingObsId] = useState<string | null>(null);
  const [editRoom, setEditRoom] = useState('');
  const [editSurface, setEditSurface] = useState('');
  const [editCondition, setEditCondition] = useState('');
  const [editSeverity, setEditSeverity] = useState<Severity>('minor');
  const [editNote, setEditNote] = useState('');

  // Manual observation modal/form
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualRoom, setManualRoom] = useState('');
  const [manualSurface, setManualSurface] = useState('');
  const [manualCondition, setManualCondition] = useState('');
  const [manualSeverity, setManualSeverity] = useState<Severity>('minor');

  // Sync duration & reset session error state when switching videos
  useEffect(() => {
    setDuration(videoMeta?.durationSeconds || 0);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedObsId(null);
    setRetryCooldownSec(0);
    setLiveErrorBanner(null);
    setDismissedHistoricalError(false);
  }, [videoMeta?.id, inspectionType]);

  // Countdown timer for Retry-After guidance
  useEffect(() => {
    if (retryCooldownSec <= 0) return;
    const timer = window.setInterval(() => {
      setRetryCooldownSec((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryCooldownSec]);

  // Automatically extract missing frame thumbnails whenever video URL & observations exist
  useEffect(() => {
    const url = videoMeta?.objectUrl;
    if (!url) return;
    const missing = inspectionObservations.filter((o) => !o.thumbnailDataUrl);
    if (missing.length === 0) return;

    let cancelled = false;
    const times = missing.map((m) => m.timestampSeconds);
    extractVideoThumbnails(url, times).then((map) => {
      if (cancelled || map.size === 0) return;
      const updates: Array<{ id: string; thumbnailDataUrl: string }> = [];
      for (const obs of missing) {
        const key = Math.max(0, Math.round(obs.timestampSeconds * 10) / 10);
        const dataUrl = map.get(key);
        if (dataUrl) {
          updates.push({ id: obs.id, thumbnailDataUrl: dataUrl });
        }
      }
      if (updates.length > 0) {
        onBatchSetThumbnails(updates);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [videoMeta?.objectUrl, inspectionObservations.length]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const rooms = useMemo(() => {
    const set = new Set<string>();
    damageObservations.forEach((o) => set.add(getEffectiveObservation(o).room));
    return Array.from(set);
  }, [damageObservations]);

  const filteredObservations = useMemo(() => {
    return damageObservations.filter((obs) => {
      if (filterTab === 'unreviewed' && obs.reviewStatus !== 'unreviewed') return false;
      if (
        filterTab === 'confirmed' &&
        obs.reviewStatus !== 'confirmed' &&
        obs.reviewStatus !== 'edited'
      ) {
        return false;
      }
      if (filterTab === 'dismissed' && obs.reviewStatus !== 'dismissed') return false;
      if (filterTab === 'all' && obs.reviewStatus === 'dismissed') return false;
      if (roomFilter !== 'all' && getEffectiveObservation(obs).room !== roomFilter) {
        return false;
      }
      return true;
    });
  }, [damageObservations, filterTab, roomFilter]);

  const seekTo = (seconds: number, obsId?: string) => {
    const v = videoRef.current;
    const target = Math.max(0, Math.min(seconds, duration > 0 ? duration - 0.05 : seconds));
    if (v) {
      v.currentTime = target;
    }
    setCurrentTime(target);
    if (obsId) {
      setSelectedObsId(obsId);
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const handleVideoFileSelected = async (file: File) => {
    setLiveErrorBanner(null);
    setDismissedHistoricalError(false);
    setIsUploading(true);
    setStatusMessage('Computing SHA-256 fingerprint and reading video metadata…');

    try {
      const localUrl = URL.createObjectURL(file);
      const [sha256, probe] = await Promise.all([
        computeFileSha256(file),
        probeVideoFile(localUrl).catch(() => ({ durationSeconds: 0, width: 0, height: 0 })),
      ]);

      const videoId = `${inspectionType}-${Date.now()}`;
      await saveVideoBlob(videoId, file);

      setStatusMessage('Uploading video to analysis endpoint…');
      const formData = new FormData();
      formData.append('video', file);

      const uploadResp = await fetch('/api/videos/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = (await uploadResp.json()) as {
        serverFileId?: string;
        serverAccessToken?: string;
        sha256?: string;
        fileSizeBytes?: number;
        mimeType?: string;
        playbackUrl?: string;
        error?: string;
      };

      if (!uploadResp.ok || !uploadData.serverFileId) {
        throw new Error(uploadData.error || 'Video upload failed.');
      }

      // Clean up previously replaced temporary server file & local blob
      const previousMeta = videoMeta;
      if (previousMeta && !apartment.isSample) {
        deleteVideoBlob(previousMeta.id).catch(() => {});
        if (previousMeta.serverFileId && previousMeta.serverAccessToken) {
          fetch(`/api/videos/${encodeURIComponent(previousMeta.serverFileId)}`, {
            method: 'DELETE',
            headers: { 'x-video-token': previousMeta.serverAccessToken },
          }).catch(() => {});
        }
      }

      const newVideoMeta: VideoMetadata = {
        id: videoId,
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || uploadData.mimeType || 'video/mp4',
        durationSeconds: probe.durationSeconds,
        width: probe.width || undefined,
        height: probe.height || undefined,
        sha256: uploadData.sha256 || sha256,
        lastModifiedIso: file.lastModified
          ? new Date(file.lastModified).toISOString()
          : undefined,
        recordedOrUploadedAt: new Date().toISOString(),
        objectUrl: localUrl,
        serverFileId: uploadData.serverFileId,
        serverAccessToken: uploadData.serverAccessToken,
        analysisSource: 'pending',
      };

      onUpdateVideo(inspectionType, newVideoMeta);
      setIsUploading(false);
      setStatusMessage(null);

      // Immediately launch Gemini analysis
      await runGeminiAnalysis(newVideoMeta, localUrl);
    } catch (err: unknown) {
      setIsUploading(false);
      setStatusMessage(null);
      setLiveErrorBanner(
        err instanceof Error ? err.message : 'Unable to process the selected video file.'
      );
    }
  };

  const runGeminiAnalysis = async (meta: VideoMetadata, playbackUrl?: string) => {
    let activeMeta = meta;

    setLiveErrorBanner(null);
    setDismissedHistoricalError(false);
    setRetryCooldownSec(0);
    setIsAnalyzing(true);
    setStatusMessage('Analyzing walkthrough video with Gemini…');

    try {
      const invokeAnalyze = (targetMeta: VideoMetadata) =>
        fetch('/api/analyze-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverFileId: targetMeta.serverFileId,
            serverAccessToken: targetMeta.serverAccessToken,
            inspectionType,
            unitName: apartment.unitName,
            durationSeconds: targetMeta.durationSeconds || undefined,
          }),
        });

      let resp = activeMeta.serverFileId ? await invokeAnalyze(activeMeta) : null;

      // If temporary server copy expired/restarted (404) but local blob still exists, re-sync existing blob while preserving ID & SHA-256
      if ((!resp || resp.status === 404) && (playbackUrl || activeMeta.objectUrl)) {
        const sourceUrl = playbackUrl || activeMeta.objectUrl!;
        setStatusMessage('Restoring temporary server copy from preserved local video…');
        const blobResp = await fetch(sourceUrl);
        if (blobResp.ok) {
          const blob = await blobResp.blob();
          const formData = new FormData();
          formData.append(
            'video',
            new File([blob], activeMeta.fileName, {
              type: activeMeta.mimeType || blob.type || 'video/mp4',
            })
          );
          const reupResp = await fetch('/api/videos/upload', {
            method: 'POST',
            body: formData,
          });
          const reupData = (await reupResp.json()) as {
            serverFileId?: string;
            serverAccessToken?: string;
            error?: string;
          };
          if (reupResp.ok && reupData.serverFileId) {
            activeMeta = {
              ...activeMeta,
              serverFileId: reupData.serverFileId,
              serverAccessToken: reupData.serverAccessToken,
            };
            onUpdateVideo(inspectionType, activeMeta);
            setStatusMessage('Analyzing walkthrough video with Gemini…');
            resp = await invokeAnalyze(activeMeta);
          }
        }
      }

      if (!resp) {
        throw new Error('Please re-upload the video file so the server can analyze it with Gemini.');
      }

      const data = (await resp.json()) as ApiErrorPayload & {
        model?: string;
        analyzedAt?: string;
        observations?: Observation[];
      };

      if (!resp.ok) {
        const parsedErr = parseApiErrorResponse(data, 'Gemini analysis failed.');
        if (parsedErr.retryAfterSeconds) {
          setRetryCooldownSec(parsedErr.retryAfterSeconds);
        }
        throw new Error(formatUiErrorBannerText(parsedErr));
      }

      const observations = Array.isArray(data.observations) ? data.observations : [];
      const urlToExtract = playbackUrl || activeMeta.objectUrl;
      if (urlToExtract && observations.length > 0) {
        setStatusMessage('Extracting frame stills at detected timestamps…');
        const thumbs = await extractVideoThumbnails(
          urlToExtract,
          observations.map((o) => o.timestampSeconds)
        );
        for (const obs of observations) {
          const key = Math.max(0, Math.round(obs.timestampSeconds * 10) / 10);
          const thumb = thumbs.get(key);
          if (thumb) obs.thumbnailDataUrl = thumb;
        }
      }

      onUpdateVideo(
        inspectionType,
        {
          ...activeMeta,
          analysisSource: 'gemini-live',
          analysisModel: data.model || 'Gemini',
          analyzedAt: data.analyzedAt || new Date().toISOString(),
          analysisError: undefined,
          analysisErrorAt: undefined,
        },
        observations
      );
      setStatusMessage(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Gemini video analysis failed.';
      const failedAt = new Date().toISOString();
      onUpdateVideo(inspectionType, {
        ...activeMeta,
        analysisSource: 'error',
        analysisError: message,
        analysisErrorAt: failedAt,
      });
      setLiveErrorBanner(message);
      setStatusMessage(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openCamera = () => {
    setLiveErrorBanner(null);
    setIsCameraOpen(true);
  };

  const closeCamera = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
    setIsRequestingCamera(false);
    setIsCameraOpen(false);
    setIsRecording(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      return;
    }

      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== 'function' ||
        typeof MediaRecorder === 'undefined'
      ) {
        setLiveErrorBanner(
          'In-browser camera recording is not supported in this browser session. You can upload any MP4, MOV, or WebM video file instead.'
        );
        return;
      }

      setLiveErrorBanner(null);
      setIsRequestingCamera(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        mediaStreamRef.current = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          previewVideoRef.current.play().catch(() => {});
        }

        recordedChunksRef.current = [];
        const recorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : undefined,
        });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = async () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const file = new File(
            [blob],
            `${inspectionType}-walkthrough-${Date.now()}.webm`,
            { type: 'video/webm' }
          );
          closeCamera();
          await handleVideoFileSelected(file);
        };
        recorderRef.current = recorder;
        recorder.start();
        setIsRecording(true);
      } catch {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        setLiveErrorBanner(
          'Camera permission was denied or no camera is available. File upload continues to work without camera access.'
        );
      } finally {
        setIsRequestingCamera(false);
      }
  };

  const startEditing = (obs: Observation) => {
    const eff = getEffectiveObservation(obs);
    setEditingObsId(obs.id);
    setEditRoom(eff.room);
    setEditSurface(eff.objectOrSurface);
    setEditCondition(eff.visibleCondition);
    setEditSeverity(eff.severity);
    setEditNote(obs.userEdit?.note ?? '');
  };

  const saveEdit = (obs: Observation) => {
    if (!editRoom.trim() || !editSurface.trim() || !editCondition.trim()) return;
    onUpdateObservation(obs.id, (prev) => ({
      ...prev,
      reviewStatus: 'edited',
      reviewedAt: new Date().toISOString(),
      userEdit: {
        room: editRoom.trim(),
        objectOrSurface: editSurface.trim(),
        visibleCondition: editCondition.trim(),
        severity: editSeverity,
        note: editNote.trim() || undefined,
        editedAt: new Date().toISOString(),
      },
    }));
    setEditingObsId(null);
  };

  const setReviewStatus = (obs: Observation, status: ReviewStatus) => {
    onUpdateObservation(obs.id, (prev) => ({
      ...prev,
      reviewStatus: status,
      reviewedAt: new Date().toISOString(),
    }));
  };

  const handleAddManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRoom.trim() || !manualSurface.trim() || !manualCondition.trim()) return;
    const thumb = videoRef.current ? captureCurrentVideoFrame(videoRef.current) : undefined;
    const newObs: Observation = {
      id: `${inspectionType}-manual-${Date.now()}`,
      inspectionType,
      category: 'potential-damage',
      room: manualRoom.trim(),
      objectOrSurface: manualSurface.trim(),
      visibleCondition: manualCondition.trim(),
      timestampSeconds: Math.round(currentTime * 10) / 10,
      severity: manualSeverity,
      confidence: 'high',
      reviewStatus: 'confirmed',
      reviewedAt: new Date().toISOString(),
      source: 'manual',
      thumbnailDataUrl: thumb,
    };
    onAddManualObservation(newObs);
    setManualRoom('');
    setManualSurface('');
    setManualCondition('');
    setShowManualForm(false);
    setSelectedObsId(newObs.id);
  };

  const activeCounts = useMemo(() => {
    const nonDismissed = damageObservations.filter((o) => o.reviewStatus !== 'dismissed');
    return {
      all: nonDismissed.length,
      unreviewed: nonDismissed.filter((o) => o.reviewStatus === 'unreviewed').length,
      confirmed: nonDismissed.filter(
        (o) => o.reviewStatus === 'confirmed' || o.reviewStatus === 'edited'
      ).length,
      dismissed: damageObservations.filter((o) => o.reviewStatus === 'dismissed').length,
    };
  }, [damageObservations]);

  const titleLabel =
    inspectionType === 'move-in' ? 'Move-In Inspection' : 'Move-Out Inspection';

  return (
    <main className="mx-auto max-w-[1320px] px-4 py-8 sm:px-8">
      {/* Sample vs Live Notice */}
      {apartment.isSample && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-[#946B28]/30 bg-[#F7F1E3] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[#20211F]">
            <span className="font-semibold text-[#946B28]">Sample Demonstration:</span>{' '}
            Precomputed findings mapped to real sample video timestamps. Create a new apartment record to upload your own video for live Gemini analysis.
          </p>
          <span className="font-mono text-xs text-[#946B28] shrink-0">
            Precomputed
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#DFDED8] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.06em] text-[#62635F] uppercase">
            {apartment.unitName}
          </p>
          <h1 className="mt-1 font-serif text-3xl text-[#20211F] sm:text-4xl">
            {titleLabel}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.mov,.webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleVideoFileSelected(file);
              e.target.value = '';
            }}
          />
          {!apartment.isSample && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isAnalyzing}
                className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-[#C5C4BD] bg-white px-3.5 py-2 text-xs font-medium text-[#20211F] hover:bg-[#F0EEE9] disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{videoMeta ? 'Replace Video' : 'Upload Video'}</span>
              </button>
              {videoMeta && videoMeta.serverFileId && (
                <button
                  type="button"
                  onClick={() => runGeminiAnalysis(videoMeta)}
                  disabled={isAnalyzing || isUploading}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[#20211F] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#353734] disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {isAnalyzing ? 'Analyzing…' : 'Re-run Gemini Analysis'}
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status / Error Alerts */}
      {statusMessage && (
        <div
          role="status"
          className="mt-5 flex items-center gap-3 rounded-xl border border-[#DFDED8] bg-white px-4 py-3 text-sm text-[#20211F]"
        >
          <Loader2 className="h-4 w-4 animate-spin text-[#20211F] shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {liveErrorBanner && (
        <div
          role="alert"
          className="mt-5 flex flex-col gap-3 rounded-xl border border-[#C9473D]/40 bg-[#FBEDEB] px-4 py-3 text-sm text-[#93000a] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p>{liveErrorBanner}</p>
              {videoMeta && (
                <p className="font-mono text-[11px] text-[#93000a]/80">
                  Preserved video: {videoMeta.fileName} · SHA-256 {videoMeta.sha256.slice(0, 16)}…
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {videoMeta && (videoMeta.serverFileId || videoMeta.objectUrl) && (
              <button
                type="button"
                onClick={() => runGeminiAnalysis(videoMeta)}
                disabled={isAnalyzing || isUploading || retryCooldownSec > 0}
                className="cursor-pointer rounded-lg border border-[#C9473D] bg-white px-3 py-1.5 text-xs font-medium text-[#93000a] hover:bg-[#FBEDEB] disabled:opacity-50"
              >
                {retryCooldownSec > 0
                  ? `Retry in ${retryCooldownSec}s`
                  : isAnalyzing
                    ? 'Retrying…'
                    : 'Retry Analysis'}
              </button>
            )}
            {!apartment.isSample && onOpenSample && (
              <button
                type="button"
                onClick={onOpenSample}
                className="cursor-pointer rounded-lg border border-[#946B28]/50 bg-[#F7F1E3] px-3 py-1.5 text-xs font-medium text-[#946B28] hover:bg-[#EFE4CC]"
              >
                Open Sample Demonstration
              </button>
            )}
          </div>
        </div>
      )}

      {!liveErrorBanner &&
        !dismissedHistoricalError &&
        videoMeta?.analysisSource === 'error' &&
        videoMeta.analysisError && (
          <div
            role="status"
            className="mt-5 flex flex-col gap-3 rounded-xl border border-[#946B28]/40 bg-[#F7F1E3] px-4 py-3 text-sm text-[#20211F] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#946B28]" />
              <div className="space-y-1">
                <p className="font-medium text-[#946B28]">
                  Previous Analysis Attempt Failed
                  {videoMeta.analysisErrorAt
                    ? ` (${new Date(videoMeta.analysisErrorAt).toLocaleString()})`
                    : ' (Saved Record)'}
                </p>
                <p className="text-xs text-[#454843]">
                  Recorded message from that earlier attempt: {videoMeta.analysisError}
                </p>
                <p className="font-mono text-[11px] text-[#62635F]">
                  Preserved video: {videoMeta.fileName} · SHA-256 {videoMeta.sha256.slice(0, 16)}… · Click Retry Analysis to run a live check now.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {(videoMeta.serverFileId || videoMeta.objectUrl) && (
                <button
                  type="button"
                  onClick={() => runGeminiAnalysis(videoMeta)}
                  disabled={isAnalyzing || isUploading || retryCooldownSec > 0}
                  className="cursor-pointer rounded-lg bg-[#20211F] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#353734] disabled:opacity-50"
                >
                  {isAnalyzing ? 'Retrying…' : 'Retry Analysis'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDismissedHistoricalError(true);
                  onUpdateVideo(inspectionType, {
                    ...videoMeta,
                    analysisSource: 'pending',
                    analysisError: undefined,
                    analysisErrorAt: undefined,
                  });
                }}
                className="cursor-pointer rounded-lg border border-[#C5C4BD] bg-white px-3 py-1.5 text-xs font-medium text-[#62635F] hover:text-[#20211F]"
              >
                Dismiss Notice
              </button>
            </div>
          </div>
        )}

      {/* Camera Recorder Drawer */}
      {isCameraOpen && (
        <div className="mt-6 rounded-xl border border-[#DFDED8] bg-white p-5">
          <div className="flex items-center justify-between pb-3">
            <h2 className="font-serif text-xl text-[#20211F]">Record Walkthrough Video</h2>
            <button
              type="button"
              onClick={closeCamera}
              className="cursor-pointer rounded-lg border border-[#DFDED8] px-3 py-1.5 text-xs text-[#62635F] hover:text-[#20211F]"
            >
              Close Camera
            </button>
          </div>
          <div className="relative">
            <video
              ref={previewVideoRef}
              muted
              playsInline
              className="aspect-video w-full max-h-[380px] rounded-lg bg-[#20211F] object-cover"
            />
            {!isRecording && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-lg p-6 text-center text-white/85">
                <Video className="h-7 w-7 opacity-70" />
                <p className="mt-2 max-w-md text-xs leading-relaxed">
                  Camera permission will only be requested when you click &ldquo;Start Recording&rdquo; below.
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#62635F]">
              Pan slowly along walls, baseboards, floors, countertops, and fixtures.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  closeCamera();
                  fileInputRef.current?.click();
                }}
                className="cursor-pointer rounded-lg border border-[#DFDED8] bg-white px-3 py-2 text-xs font-medium text-[#20211F] hover:bg-[#F0EEE9]"
              >
                Upload File Instead
              </button>
              <button
                type="button"
                onClick={toggleRecording}
                disabled={isRequestingCamera}
                className={`cursor-pointer rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-50 ${
                  isRecording ? 'bg-[#C9473D]' : 'bg-[#20211F]'
                }`}
              >
                {isRequestingCamera
                  ? 'Requesting Camera…'
                  : isRecording
                    ? 'Stop & Analyze Recording'
                    : 'Start Recording'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Empty State */}
      {!videoMeta && !isCameraOpen && (
        <section className="mt-8 rounded-xl border border-dashed border-[#C5C4BD] bg-white p-8 sm:p-12 text-center">
          <div className="mx-auto max-w-lg">
            <Film className="mx-auto h-8 w-8 text-[#62635F]" />
            <h2 className="mt-4 font-serif text-2xl text-[#20211F]">
              Upload your {inspectionType === 'move-in' ? 'move-in' : 'move-out'} walkthrough video
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#62635F]">
              Select an MP4, MOV, or WebM walkthrough recording. BASELINE computes a SHA-256 fingerprint for file integrity and uses Gemini to detect timestamped room conditions.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[#20211F] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#353734] disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                <span>Select Video File</span>
              </button>
              <button
                type="button"
                onClick={openCamera}
                disabled={isUploading}
                className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-[#C5C4BD] bg-white px-5 py-2.5 text-sm font-medium text-[#20211F] hover:bg-[#F0EEE9]"
              >
                <Video className="h-4 w-4" />
                <span>Record With Camera</span>
              </button>
            </div>
            <p className="mt-5 text-xs text-[#90918B]">
              Private by default. Maximum 150 MB per video.
            </p>
          </div>
        </section>
      )}

      {/* Main Inspection Workspace (Video Player + Interactive Timeline + Findings Ledger) */}
      {videoMeta && (
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Left Column: Video Player & Interactive Evidence Timeline */}
          <div className="space-y-4 lg:col-span-7">
            <div className="overflow-hidden rounded-xl border border-[#DFDED8] bg-white">
              <div className="relative bg-[#1b1c1a]">
                {videoMeta.objectUrl ? (
                  <video
                    ref={videoRef}
                    src={videoMeta.objectUrl}
                    playsInline
                    onClick={togglePlay}
                    onLoadedMetadata={(e) => {
                      const d = e.currentTarget.duration;
                      if (Number.isFinite(d) && d > 0) setDuration(d);
                    }}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    className="aspect-video w-full cursor-pointer object-contain"
                  />
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center p-6 text-center text-white/80">
                    <Film className="h-8 w-8 opacity-60" />
                    <p className="mt-2 text-sm">
                      Local video file reference expired. Re-upload {videoMeta.fileName} to restore frame playback.
                    </p>
                  </div>
                )}
              </div>

              {/* Player Controls + Timeline Scrubber with Evidence Markers */}
              <div className="border-t border-[#DFDED8] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label={isPlaying ? 'Pause video' : 'Play video'}
                      className="cursor-pointer inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#20211F] text-white hover:bg-[#353734]"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => seekTo(currentTime - 1)}
                      aria-label="Step back 1 second"
                      className="cursor-pointer inline-flex h-9 items-center gap-1 rounded-lg border border-[#DFDED8] bg-white px-2.5 text-xs font-mono text-[#20211F] hover:bg-[#F0EEE9]"
                    >
                      <SkipBack className="h-3.5 w-3.5" />
                      <span>1s</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => seekTo(currentTime + 1)}
                      aria-label="Step forward 1 second"
                      className="cursor-pointer inline-flex h-9 items-center gap-1 rounded-lg border border-[#DFDED8] bg-white px-2.5 text-xs font-mono text-[#20211F] hover:bg-[#F0EEE9]"
                    >
                      <span>1s</span>
                      <SkipForward className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="font-mono text-xs tabular-nums text-[#20211F]">
                    <span>{formatTimestamp(currentTime)}</span>
                    <span className="mx-1 text-[#90918B]">/</span>
                    <span className="text-[#62635F]">{formatTimestamp(duration)}</span>
                  </div>
                </div>

                {/* Clickable Timeline Track + Pinned Finding Markers */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-[#62635F]">
                    <span>Evidence Timeline</span>
                    <span>
                      Click any marker to jump to frame ({activeCounts.all} active)
                    </span>
                  </div>

                  <div
                    role="slider"
                    aria-label="Video evidence timeline"
                    aria-valuemin={0}
                    aria-valuemax={duration || 100}
                    aria-valuenow={Math.round(currentTime)}
                    tabIndex={0}
                    onClick={(e) => {
                      if (duration <= 0) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      seekTo(ratio * duration);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowRight') seekTo(currentTime + 1);
                      if (e.key === 'ArrowLeft') seekTo(currentTime - 1);
                    }}
                    className="relative mt-2 h-8 cursor-pointer rounded-lg border border-[#DFDED8] bg-[#F8F7F3]"
                  >
                    {/* Playhead Fill */}
                    <div
                      className="pointer-events-none absolute inset-y-0 left-0 rounded-l-lg bg-[#E9E8E4]"
                      style={{
                        width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                      }}
                    />

                    {/* Playhead Line */}
                    <div
                      className="pointer-events-none absolute inset-y-0 w-[2px] bg-[#20211F]"
                      style={{
                        left: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
                      }}
                    />

                    {/* Potential Damage Markers Only */}
                    {damageObservations
                      .filter((o) => o.reviewStatus !== 'dismissed')
                      .map((obs) => {
                        const pct =
                          duration > 0
                            ? Math.max(2, Math.min(98, (obs.timestampSeconds / duration) * 100))
                            : 0;
                        const isSelected = selectedObsId === obs.id;
                        const markerColor =
                          obs.reviewStatus === 'confirmed'
                            ? 'bg-[#4C735B]'
                            : obs.reviewStatus === 'edited'
                              ? 'bg-[#946B28]'
                              : 'bg-[#C9473D]';
                        const eff = getEffectiveObservation(obs);

                        return (
                          <button
                            key={obs.id}
                            type="button"
                            title={`${formatTimestamp(obs.timestampSeconds)} · ${eff.room}: ${eff.objectOrSurface}`}
                            aria-label={`Jump to ${formatTimestamp(obs.timestampSeconds)} — ${eff.room} ${eff.objectOrSurface}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              seekTo(obs.timestampSeconds, obs.id);
                            }}
                            style={{ left: `${pct}%` }}
                            className={`cursor-pointer absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white transition-transform ${markerColor} ${
                              isSelected ? 'h-4 w-4 scale-125 ring-2 ring-[#20211F]' : 'h-3 w-3 hover:scale-125'
                            }`}
                          />
                        );
                      })}
                  </div>

                  {/* Marker Legend + Add Manual Observation Trigger */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#62635F]">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#C9473D]" />
                        Needs review
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#4C735B]" />
                        Confirmed
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#946B28]" />
                        User edited
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowManualForm((v) => !v)}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#DFDED8] bg-white px-3 py-1.5 text-xs font-medium text-[#20211F] hover:bg-[#F0EEE9]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Mark Observation at {formatTimestamp(currentTime)}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Observation Entry Form */}
            {showManualForm && (
              <form
                onSubmit={handleAddManualSubmit}
                className="rounded-xl border border-[#DFDED8] bg-white p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#20211F]">
                    Add Manual Observation at {formatTimestamp(currentTime)}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowManualForm(false)}
                    aria-label="Close manual observation form"
                    className="cursor-pointer p-1 text-[#62635F] hover:text-[#20211F]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    required
                    value={manualRoom}
                    onChange={(e) => setManualRoom(e.target.value)}
                    placeholder="Room (e.g., Bedroom)"
                    className="rounded-lg border border-[#DFDED8] px-3 py-2 text-xs text-[#20211F]"
                  />
                  <input
                    type="text"
                    required
                    value={manualSurface}
                    onChange={(e) => setManualSurface(e.target.value)}
                    placeholder="Object / Surface"
                    className="rounded-lg border border-[#DFDED8] px-3 py-2 text-xs text-[#20211F]"
                  />
                  <select
                    value={manualSeverity}
                    onChange={(e) => setManualSeverity(e.target.value as Severity)}
                    aria-label="Observation severity"
                    className="rounded-lg border border-[#DFDED8] bg-white px-3 py-2 text-xs text-[#20211F]"
                  >
                    <option value="minor">Minor severity</option>
                    <option value="moderate">Moderate severity</option>
                    <option value="significant">Significant severity</option>
                    <option value="unclear">Unclear</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  required
                  value={manualCondition}
                  onChange={(e) => setManualCondition(e.target.value)}
                  placeholder="Describe the visible condition at this timestamp…"
                  className="w-full rounded-lg border border-[#DFDED8] px-3 py-2 text-xs text-[#20211F]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowManualForm(false)}
                    className="cursor-pointer rounded-lg border border-[#DFDED8] px-3 py-1.5 text-xs text-[#62635F]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="cursor-pointer rounded-lg bg-[#20211F] px-4 py-1.5 text-xs font-medium text-white"
                  >
                    Save Observation
                  </button>
                </div>
              </form>
            )}

            {/* File Metadata & SHA-256 Strip */}
            <div className="rounded-xl border border-[#DFDED8] bg-[#F0EEE9]/60 p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[#20211F]">{videoMeta.fileName}</span>
                <span className="font-mono tabular-nums text-[#62635F]">
                  {formatBytes(videoMeta.fileSizeBytes)} ·{' '}
                  {videoMeta.analysisSource === 'sample-precomputed'
                    ? 'Precomputed sample'
                    : videoMeta.analysisSource === 'gemini-live'
                      ? `Analyzed by ${videoMeta.analysisModel || 'Gemini'}`
                      : videoMeta.analysisSource === 'error'
                        ? 'Analysis failed'
                        : 'Pending analysis'}
                </span>
              </div>
              <p className="mt-1.5 break-all font-mono text-[11px] text-[#62635F]">
                SHA-256: {videoMeta.sha256}
              </p>
            </div>
          </div>

          {/* Right Column: Reviewable Damage Findings Ledger + Optional Inspection Coverage */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-[#DFDED8] bg-white">
            <div className="border-b border-[#DFDED8] p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif text-xl text-[#20211F]">
                  Timestamped Findings
                </h2>
                <select
                  aria-label="Filter by room"
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  className="rounded-lg border border-[#DFDED8] bg-white px-2.5 py-1 text-xs text-[#20211F]"
                >
                  <option value="all">All rooms</option>
                  {rooms.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Segmented Control */}
              <div className="mt-3 flex items-center gap-1 rounded-lg bg-[#F0EEE9] p-1">
                {(
                  [
                    { id: 'all', label: `Active (${activeCounts.all})` },
                    { id: 'unreviewed', label: `Review (${activeCounts.unreviewed})` },
                    { id: 'confirmed', label: `Verified (${activeCounts.confirmed})` },
                    { id: 'dismissed', label: `Dismissed (${activeCounts.dismissed})` },
                  ] as Array<{ id: FilterTab; label: string }>
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterTab(tab.id)}
                    className={`cursor-pointer flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                      filterTab === tab.id
                        ? 'bg-white text-[#20211F] shadow-xs'
                        : 'text-[#62635F] hover:text-[#20211F]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[680px] divide-y divide-[#DFDED8] overflow-y-auto">
              {filteredObservations.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#62635F] space-y-2">
                  {isAnalyzing ? (
                    <p>Gemini is inspecting the video…</p>
                  ) : videoMeta.analysisSource === 'error' ? (
                    <>
                      <p className="font-medium text-[#20211F]">
                        No AI findings from the previous attempt.
                      </p>
                      <p className="text-xs leading-relaxed">
                        Your uploaded video, SHA-256 fingerprint, and any existing reviewed findings remain preserved. Click Retry Analysis above, mark manual timestamped observations directly from the timeline, or open the Sample Demonstration.
                      </p>
                    </>
                  ) : damageObservations.length === 0 && videoMeta.analysisSource === 'gemini-live' ? (
                    <>
                      <p className="font-medium text-[#20211F]">
                        No visible damage findings detected.
                      </p>
                      <p className="text-xs leading-relaxed">
                        {coverageObservations.length > 0
                          ? `${coverageObservations.length} intact or unassessable area note${coverageObservations.length === 1 ? '' : 's'} logged separately under Inspection Coverage below.`
                          : 'No visible scratches, cracks, stains, or physical defects were detected. You can still mark a manual observation at any timestamp.'}
                      </p>
                    </>
                  ) : (
                    <p>No findings match the current filter.</p>
                  )}
                </div>
              ) : (
                filteredObservations.map((obs) => {
                  const eff = getEffectiveObservation(obs);
                  const isSelected = selectedObsId === obs.id;
                  const isEditing = editingObsId === obs.id;

                  return (
                    <div
                      key={obs.id}
                      className={`p-4 transition-colors ${
                        isSelected ? 'bg-[#FBEDEB]/40' : 'hover:bg-[#F8F7F3]/70'
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Clickable Video Frame Thumbnail */}
                        <button
                          type="button"
                          onClick={() => seekTo(obs.timestampSeconds, obs.id)}
                          aria-label={`Jump to frame at ${formatTimestamp(obs.timestampSeconds)} for ${eff.room}`}
                          className="cursor-pointer group relative h-[54px] w-[96px] shrink-0 overflow-hidden rounded-md border border-[#DFDED8] bg-[#F0EEE9]"
                        >
                          {obs.thumbnailDataUrl ? (
                            <img
                              src={obs.thumbnailDataUrl}
                              alt={`${eff.room} at ${formatTimestamp(obs.timestampSeconds)}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-mono text-[#62635F]">
                              {formatTimestamp(obs.timestampSeconds)}
                            </div>
                          )}
                          <span className="absolute bottom-1 right-1 rounded bg-[#20211F]/80 px-1 py-0.5 font-mono text-[10px] tabular-nums text-white">
                            {formatTimestamp(obs.timestampSeconds, true)}
                          </span>
                        </button>

                        {/* Observation Metadata & Text */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#62635F]">
                            <button
                              type="button"
                              onClick={() => seekTo(obs.timestampSeconds, obs.id)}
                              className="cursor-pointer font-mono font-medium tabular-nums text-[#C9473D] hover:underline"
                            >
                              {formatTimestamp(obs.timestampSeconds, true)}
                            </button>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#20211F]">{eff.room}</span>
                            <span aria-hidden="true">·</span>
                            <span className="capitalize">{eff.severity}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                obs.reviewStatus === 'confirmed'
                                  ? 'font-medium text-[#4C735B]'
                                  : obs.reviewStatus === 'edited'
                                    ? 'font-medium text-[#946B28]'
                                    : obs.reviewStatus === 'dismissed'
                                      ? 'text-[#90918B]'
                                      : 'text-[#C9473D]'
                              }
                            >
                              {obs.reviewStatus === 'confirmed'
                                ? 'Confirmed'
                                : obs.reviewStatus === 'edited'
                                  ? 'Edited'
                                  : obs.reviewStatus === 'dismissed'
                                    ? 'Dismissed'
                                    : 'Needs review'}
                            </span>
                          </div>

                          <p className="mt-1 text-xs font-medium text-[#20211F]">
                            {eff.objectOrSurface}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[#454843]">
                            {eff.visibleCondition}
                          </p>

                          {obs.userEdit?.note && (
                            <p className="mt-1.5 text-[11px] italic text-[#4C735B]">
                              Note: {obs.userEdit.note}
                            </p>
                          )}

                          {/* Keep original AI observation visible & separate when edited */}
                          {eff.hasUserEdit && (
                            <div className="mt-2 rounded-md border border-[#DFDED8] bg-[#F8F7F3] px-2.5 py-1.5 text-[11px] text-[#62635F]">
                              <span className="font-medium text-[#454843]">
                                Original AI observation:
                              </span>{' '}
                              {obs.visibleCondition}
                            </div>
                          )}

                          {obs.uncertaintyNote && (
                            <p className="mt-2 rounded-md bg-[#F7F1E3] px-2.5 py-1.5 text-[11px] text-[#946B28]">
                              Uncertainty ({obs.confidence} confidence): {obs.uncertaintyNote}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Inline Edit Drawer */}
                      {isEditing ? (
                        <div className="mt-3 space-y-2 rounded-lg border border-[#DFDED8] bg-[#F8F7F3] p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editRoom}
                              onChange={(e) => setEditRoom(e.target.value)}
                              aria-label="Edit room"
                              className="rounded-md border border-[#DFDED8] bg-white px-2.5 py-1.5 text-xs text-[#20211F]"
                            />
                            <input
                              type="text"
                              value={editSurface}
                              onChange={(e) => setEditSurface(e.target.value)}
                              aria-label="Edit object or surface"
                              className="rounded-md border border-[#DFDED8] bg-white px-2.5 py-1.5 text-xs text-[#20211F]"
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={editCondition}
                            onChange={(e) => setEditCondition(e.target.value)}
                            aria-label="Edit visible condition"
                            className="w-full rounded-md border border-[#DFDED8] bg-white px-2.5 py-1.5 text-xs text-[#20211F]"
                          />
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <select
                              value={editSeverity}
                              onChange={(e) => setEditSeverity(e.target.value as Severity)}
                              aria-label="Edit severity"
                              className="rounded-md border border-[#DFDED8] bg-white px-2.5 py-1.5 text-xs text-[#20211F]"
                            >
                              <option value="minor">Minor</option>
                              <option value="moderate">Moderate</option>
                              <option value="significant">Significant</option>
                              <option value="unclear">Unclear</option>
                            </select>
                            <input
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              placeholder="Optional note (e.g., email date)"
                              className="rounded-md border border-[#DFDED8] bg-white px-2.5 py-1.5 text-xs text-[#20211F]"
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setEditingObsId(null)}
                              className="cursor-pointer rounded-md border border-[#DFDED8] bg-white px-3 py-1 text-xs text-[#62635F]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEdit(obs)}
                              className="cursor-pointer rounded-md bg-[#20211F] px-3 py-1 text-xs font-medium text-white"
                            >
                              Save Edit
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-wrap items-center gap-2 pl-[108px]">
                          {obs.reviewStatus !== 'dismissed' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setReviewStatus(obs, 'confirmed')}
                                className={`cursor-pointer inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                  obs.reviewStatus === 'confirmed'
                                    ? 'border-[#4C735B] bg-[#EAF1EB] text-[#4C735B]'
                                    : 'border-[#DFDED8] bg-white text-[#20211F] hover:bg-[#EAF1EB]'
                                }`}
                              >
                                <Check className="h-3 w-3" />
                                <span>
                                  {obs.reviewStatus === 'confirmed' ? 'Confirmed' : 'Confirm'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditing(obs)}
                                className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-[#DFDED8] bg-white px-2.5 py-1 text-[11px] font-medium text-[#20211F] hover:bg-[#F0EEE9]"
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setReviewStatus(obs, 'dismissed')}
                                className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-[#DFDED8] bg-white px-2.5 py-1 text-[11px] font-medium text-[#62635F] hover:border-[#C9473D] hover:text-[#C9473D]"
                              >
                                <X className="h-3 w-3" />
                                <span>Dismiss</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setReviewStatus(obs, 'unreviewed')}
                              className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-[#DFDED8] bg-white px-2.5 py-1 text-[11px] font-medium text-[#20211F] hover:bg-[#F0EEE9]"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Restore</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            </div>

            {/* Optional Inspection Coverage & Intact Surfaces Section (Non-Damage) */}
            {coverageObservations.length > 0 && (
              <div className="rounded-xl border border-[#DFDED8] bg-white">
                <button
                  type="button"
                  onClick={() => setShowCoverage((v) => !v)}
                  aria-expanded={showCoverage}
                  className="cursor-pointer flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#F8F7F3]/70"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#20211F]">
                      Inspection Coverage &amp; Intact Surfaces ({coverageObservations.length})
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#62635F]">
                      Optional non-damage notes for normal features, intact surfaces, or unassessable views.
                    </p>
                  </div>
                  {showCoverage ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#62635F]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#62635F]" />
                  )}
                </button>

                {showCoverage && (
                  <div className="max-h-[360px] divide-y divide-[#DFDED8] overflow-y-auto border-t border-[#DFDED8]">
                    {coverageObservations.map((obs) => {
                      const isSelected = selectedObsId === obs.id;
                      return (
                        <div
                          key={obs.id}
                          className={`p-3.5 transition-colors ${
                            isSelected ? 'bg-[#F0EEE9]/80' : 'hover:bg-[#F8F7F3]/70'
                          }`}
                        >
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => seekTo(obs.timestampSeconds, obs.id)}
                              aria-label={`Jump to coverage frame at ${formatTimestamp(obs.timestampSeconds)} for ${obs.room}`}
                              className="cursor-pointer relative h-[45px] w-[80px] shrink-0 overflow-hidden rounded-md border border-[#DFDED8] bg-[#F0EEE9]"
                            >
                              {obs.thumbnailDataUrl ? (
                                <img
                                  src={obs.thumbnailDataUrl}
                                  alt={`${obs.room} at ${formatTimestamp(obs.timestampSeconds)}`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center font-mono text-[10px] text-[#62635F]">
                                  {formatTimestamp(obs.timestampSeconds)}
                                </div>
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#62635F]">
                                <button
                                  type="button"
                                  onClick={() => seekTo(obs.timestampSeconds, obs.id)}
                                  className="cursor-pointer font-mono font-medium tabular-nums text-[#20211F] hover:underline"
                                >
                                  {formatTimestamp(obs.timestampSeconds, true)}
                                </button>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-[#20211F]">{obs.room}</span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {/too\s+(?:distant|far|dark|dim|blurry)|cannot\s+(?:be\s+)?(?:assessed|determined|inspected)|unable\s+to\s+(?:assess|determine|inspect)|obscured|insufficient/i.test(
                                    obs.visibleCondition
                                  )
                                    ? 'Unassessable'
                                    : obs.uncertaintyNote
                                      ? 'Limited view'
                                      : 'Intact / Normal'}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs font-medium text-[#20211F]">
                                {obs.objectOrSurface}
                              </p>
                              <p className="mt-0.5 text-xs leading-relaxed text-[#454843]">
                                {obs.visibleCondition}
                              </p>
                              {obs.uncertaintyNote && (
                                <p className="mt-1 text-[11px] text-[#62635F]">
                                  Visibility note ({obs.confidence} confidence): {obs.uncertaintyNote}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
};
