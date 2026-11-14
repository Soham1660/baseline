import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import {
  computeBackoffDelayMs,
  FALLBACK_FREE_VIDEO_MODEL,
  FREE_VIDEO_MODEL_CHAIN,
  parseGeminiApiError,
  PRIMARY_FREE_VIDEO_MODEL,
  sanitizeErrorText,
  shouldTryFreeFallbackModel,
} from './src/utils/geminiErrorParser.ts';
import { validateAndNormalizeObservations } from './src/utils/evidenceLogic.ts';

const PRIMARY_VIDEO_MODEL = PRIMARY_FREE_VIDEO_MODEL;

const PORT = Number(process.env.PORT) || 3000;
const TMP_VIDEO_DIR = path.resolve('.baseline-tmp/videos');
fs.mkdirSync(TMP_VIDEO_DIR, { recursive: true });

const VIDEO_TTL_MS = 30 * 60 * 1000; // Auto-purge temporary uploaded videos after 30 minutes

interface StoredVideoRecord {
  id: string;
  accessToken: string;
  filePath: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

const videoRegistry = new Map<string, StoredVideoRecord>();

function safeUnlink(targetPath: string) {
  try {
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  } catch {
    // Non-fatal cleanup
  }
}

function deleteStoredVideo(id: string) {
  const existing = videoRegistry.get(id);
  if (existing) {
    safeUnlink(existing.filePath);
    videoRegistry.delete(id);
  }
  safeUnlink(path.join(TMP_VIDEO_DIR, `${id}.meta.json`));
}

function isTokenMatch(expected: string, provided: unknown): boolean {
  if (!expected || typeof provided !== 'string' || !provided) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extractVideoToken(req: Request, bodyToken?: unknown): string | undefined {
  const headerToken = req.get('x-video-token');
  if (typeof headerToken === 'string' && headerToken) return headerToken;
  const queryToken = req.query?.token;
  if (typeof queryToken === 'string' && queryToken) return queryToken;
  if (typeof bodyToken === 'string' && bodyToken) return bodyToken;
  return undefined;
}

function purgeExpiredVideos() {
  const cutoff = Date.now() - VIDEO_TTL_MS;
  for (const [id, rec] of videoRegistry.entries()) {
    const createdMs = Date.parse(rec.createdAt);
    if (!Number.isFinite(createdMs) || createdMs < cutoff || !fs.existsSync(rec.filePath)) {
      deleteStoredVideo(id);
    }
  }

  // Also purge any orphaned/expired temp files on disk
  try {
    const entries = fs.readdirSync(TMP_VIDEO_DIR);
    for (const file of entries) {
      const fullPath = path.join(TMP_VIDEO_DIR, file);
      if (file.endsWith('.meta.json')) {
        const id = file.slice(0, -'.meta.json'.length);
        if (!videoRegistry.has(id)) {
          safeUnlink(fullPath);
        }
      } else {
        const id = path.basename(file, path.extname(file));
        const registered = videoRegistry.get(id);
        if (!registered || registered.filePath !== fullPath) {
          const stat = fs.statSync(fullPath);
          if (stat.mtimeMs < cutoff) {
            safeUnlink(fullPath);
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }
}

// Restore valid, non-expired video metadata files across server restarts and purge expired temp files
function loadExistingVideoRegistry() {
  try {
    const cutoff = Date.now() - VIDEO_TTL_MS;
    const entries = fs.readdirSync(TMP_VIDEO_DIR);
    for (const file of entries) {
      if (file.endsWith('.meta.json')) {
        const metaPath = path.join(TMP_VIDEO_DIR, file);
        const raw = fs.readFileSync(metaPath, 'utf8');
        const parsed = JSON.parse(raw) as StoredVideoRecord;
        const createdMs = Date.parse(parsed.createdAt || '');
        const isExpired = !Number.isFinite(createdMs) || createdMs < cutoff;
        if (parsed.id && parsed.accessToken && !isExpired && fs.existsSync(parsed.filePath)) {
          videoRegistry.set(parsed.id, parsed);
        } else {
          if (parsed.filePath) safeUnlink(parsed.filePath);
          safeUnlink(metaPath);
        }
      }
    }
  } catch {
    // Non-fatal
  }
  purgeExpiredVideos();
}
loadExistingVideoRegistry();
setInterval(purgeExpiredVideos, 5 * 60 * 1000).unref();

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets to run live Gemini video analysis.'
    ) as Error & { statusCode?: number; code?: string };
    err.statusCode = 503;
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: { model?: string; maxAttempts?: number } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const parsed = parseGeminiApiError(err, { model: options.model });
      // Do NOT retry spending-cap (limit: 0), daily quota exhaustion, auth errors, or 404s.
      if (!parsed.retryable || attempt >= maxAttempts) {
        throw err;
      }
      const delayMs = computeBackoffDelayMs(attempt, parsed.retryAfterSeconds, 4500);
      if (delayMs === null) {
        // Retry-After exceeds bounded wait threshold; fail promptly with Retry-After metadata for the UI.
        throw err;
      }
      const jitterMs = Math.floor(Math.random() * 250);
      await new Promise((r) => setTimeout(r, delayMs + jitterMs));
    }
  }
  throw lastErr;
}

async function generateWithFreeModelFallback<T>(
  runForModel: (model: string) => Promise<T>
): Promise<{ result: T; modelUsed: string }> {
  const attemptedModels: string[] = [];
  let lastError: unknown;

  for (let i = 0; i < FREE_VIDEO_MODEL_CHAIN.length; i++) {
    const model = FREE_VIDEO_MODEL_CHAIN[i];
    attemptedModels.push(model);
    try {
      // Only run bounded retries on the primary model; test the fallback model once without retry loops.
      const maxAttempts = i === 0 ? 3 : 1;
      const result = await withRetry(() => runForModel(model), { model, maxAttempts });
      return { result, modelUsed: model };
    } catch (err: unknown) {
      lastError = err;
      const parsed = parseGeminiApiError(err, { model });
      const hasNext = i < FREE_VIDEO_MODEL_CHAIN.length - 1;
      if (!hasNext || !shouldTryFreeFallbackModel(parsed)) {
        break;
      }
    }
  }

  const annotated = lastError as { __lastModel?: string; __attemptedModels?: string[] };
  if (annotated && typeof annotated === 'object') {
    annotated.__lastModel = attemptedModels[attemptedModels.length - 1];
    annotated.__attemptedModels = attemptedModels;
  }
  throw lastError;
}

function formatApiError(err: unknown, fallbackModel?: string) {
  const annotated = err as { __lastModel?: string; __attemptedModels?: string[] };
  const model = annotated?.__lastModel || fallbackModel;
  const attemptedModels = annotated?.__attemptedModels || (model ? [model] : []);
  const parsed = parseGeminiApiError(err, { model, attemptedModels });

  // Log credential-safe upstream diagnostic details for server inspection
  console.error('[Gemini API Error]', JSON.stringify({
    httpStatus: parsed.httpStatus,
    upstreamStatus: parsed.upstreamStatus,
    code: parsed.code,
    kind: parsed.kind,
    model: parsed.model,
    attemptedModels,
    quotaMetric: parsed.quotaMetric,
    quotaId: parsed.quotaId,
    quotaValue: parsed.quotaValue,
    quotaDimensions: parsed.quotaDimensions,
    retryAfterSeconds: parsed.retryAfterSeconds,
    errorReason: parsed.errorReason,
    errorMetadata: parsed.errorMetadata,
    upstreamMessage: parsed.upstreamMessage,
  }));

  return {
    status: parsed.httpStatus,
    code: parsed.code,
    message: parsed.userMessage,
    quotaKind: parsed.kind,
    retryable: parsed.retryable,
    retryAfterSeconds: parsed.retryAfterSeconds,
    model: parsed.model,
    attemptedModels,
    quotaMetric: parsed.quotaMetric,
    quotaId: parsed.quotaId,
    quotaDimensions: parsed.quotaDimensions,
    actionHint: parsed.actionHint,
    upstreamStatus: parsed.upstreamStatus,
    upstreamMessage: parsed.upstreamMessage,
  };
}

function clampTs(val: unknown, durationSeconds?: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    return Math.min(Math.round(n * 10) / 10, Math.max(0, Math.round((durationSeconds - 0.1) * 10) / 10));
  }
  return Math.round(n * 10) / 10;
}

function normalizeSeverity(val: unknown): 'minor' | 'moderate' | 'significant' | 'unclear' {
  const s = typeof val === 'string' ? val.trim().toLowerCase() : '';
  if (s === 'minor' || s === 'moderate' || s === 'significant' || s === 'unclear') return s;
  return 'unclear';
}

function normalizeConfidence(val: unknown): 'high' | 'moderate' | 'low' {
  const c = typeof val === 'string' ? val.trim().toLowerCase() : '';
  if (c === 'high' || c === 'moderate' || c === 'low') return c;
  return 'moderate';
}

function normalizeClassification(
  val: unknown
): 'Potentially pre-existing' | 'Potentially new' | 'No clear change' | 'Insufficient evidence' {
  const s = typeof val === 'string' ? val.trim().toLowerCase() : '';
  if (s.includes('pre-existing') || s.includes('preexisting')) return 'Potentially pre-existing';
  if (s.includes('new')) return 'Potentially new';
  if (s.includes('no clear') || s.includes('unchanged') || s.includes('same')) return 'No clear change';
  return 'Insufficient evidence';
}

async function prepareVideoPart(
  ai: GoogleGenAI,
  record: StoredVideoRecord
): Promise<{
  part: Record<string, unknown>;
  cleanup: () => Promise<void>;
}> {
  const stats = fs.statSync(record.filePath);
  const INLINE_LIMIT_BYTES = 14 * 1024 * 1024; // 14 MB inline threshold

  if (stats.size <= INLINE_LIMIT_BYTES) {
    const base64Data = fs.readFileSync(record.filePath).toString('base64');
    return {
      part: {
        inlineData: {
          mimeType: record.mimeType || 'video/mp4',
          data: base64Data,
        },
      },
      cleanup: async () => {},
    };
  }

  const uploaded = await ai.files.upload({
    file: record.filePath,
    config: { mimeType: record.mimeType || 'video/mp4' },
  });

  let current = uploaded;
  const maxWaitMs = 90000;
  const started = Date.now();
  while (current.state === 'PROCESSING' && Date.now() - started < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 2000));
    if (current.name) {
      current = await ai.files.get({ name: current.name });
    }
  }

  if (current.state === 'FAILED') {
    throw new Error('Gemini video processing failed for the uploaded file.');
  }

  return {
    part: {
      fileData: {
        fileUri: current.uri,
        mimeType: current.mimeType || record.mimeType || 'video/mp4',
      },
    },
    cleanup: async () => {
      if (current.name) {
        try {
          await ai.files.delete({ name: current.name });
        } catch {
          // Non-fatal cleanup
        }
      }
    },
  };
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TMP_VIDEO_DIR),
  filename: (_req, file, cb) => {
    const id = `vid-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith('video/') ||
      /\.(mp4|mov|webm|m4v|avi)$/i.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid video file (MP4, MOV, or WebM).'));
    }
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // Serve sample walkthrough files
  app.use('/samples', express.static(path.resolve('public/samples')));

  app.get('/api/health', (_req: Request, res: Response) => {
    const rawKey = process.env.GEMINI_API_KEY;
    const hasGeminiKey = Boolean(rawKey && rawKey !== 'MY_GEMINI_API_KEY');
    res.json({
      ok: true,
      hasGeminiKey,
      primaryModel: PRIMARY_VIDEO_MODEL,
    });
  });

  // 1. Upload video & compute real server-side SHA-256 (private per-upload access token)
  app.post('/api/videos/upload', (req: Request, res: Response) => {
    upload.single('video')(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        const code = (uploadErr as { code?: string })?.code;
        if (code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: 'Video exceeds the 150 MB upload limit.' });
          return;
        }
        const msg = uploadErr instanceof Error ? uploadErr.message : 'Invalid video upload.';
        res.status(400).json({ error: msg });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No video file provided.' });
        return;
      }

      try {
        const hash = crypto.createHash('sha256');
        await new Promise<void>((resolve, reject) => {
          const stream = fs.createReadStream(file.path);
          stream.on('data', (chunk) => hash.update(chunk));
          stream.on('end', () => resolve());
          stream.on('error', reject);
        });
        const sha256 = hash.digest('hex');

        const id = path.basename(file.filename, path.extname(file.filename));
        const accessToken = crypto.randomBytes(16).toString('hex');
        const record: StoredVideoRecord = {
          id,
          accessToken,
          filePath: file.path,
          mimeType: file.mimetype || 'video/mp4',
          originalName: file.originalname,
          sizeBytes: file.size,
          sha256,
          createdAt: new Date().toISOString(),
        };
        videoRegistry.set(id, record);
        fs.writeFileSync(path.join(TMP_VIDEO_DIR, `${id}.meta.json`), JSON.stringify(record));

        res.json({
          serverFileId: id,
          serverAccessToken: accessToken,
          sha256,
          fileSizeBytes: file.size,
          mimeType: record.mimeType,
          playbackUrl: `/api/videos/${id}?token=${encodeURIComponent(accessToken)}`,
        });
      } catch (err: unknown) {
        safeUnlink(file.path);
        const message = err instanceof Error ? err.message : 'Upload failed.';
        res.status(500).json({ error: message });
      }
    });
  });

  // 2. Private range-capable video playback endpoint (requires upload access token)
  app.get('/api/videos/:id', (req: Request, res: Response) => {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const record = videoRegistry.get(idParam);
    if (!record || !fs.existsSync(record.filePath)) {
      res.status(404).json({ error: 'Video file not found on server.' });
      return;
    }

    const token = extractVideoToken(req);
    if (!isTokenMatch(record.accessToken, token)) {
      res.status(403).json({ error: 'Access token required for private video.' });
      return;
    }

    const stat = fs.statSync(record.filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(record.filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': record.mimeType,
        'Cache-Control': 'private, no-store',
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': record.mimeType,
        'Cache-Control': 'private, no-store',
      });
      fs.createReadStream(record.filePath).pipe(res);
    }
  });

  // 2b. Explicit temporary server video deletion endpoint (requires upload access token)
  app.delete('/api/videos/:id', (req: Request, res: Response) => {
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const record = videoRegistry.get(idParam);
    if (!record) {
      res.json({ ok: true, deleted: false });
      return;
    }

    const token = extractVideoToken(req, (req.body as { serverAccessToken?: unknown } | undefined)?.serverAccessToken);
    if (!isTokenMatch(record.accessToken, token)) {
      res.status(403).json({ error: 'Access token required to delete private video.' });
      return;
    }

    deleteStoredVideo(idParam);
    res.json({ ok: true, deleted: true });
  });

  // 3. Analyze a real uploaded walkthrough video with Gemini native video understanding
  app.post('/api/analyze-video', async (req: Request, res: Response) => {
    const { serverFileId, serverAccessToken, inspectionType, unitName, durationSeconds } = req.body as {
      serverFileId?: string;
      serverAccessToken?: string;
      inspectionType?: 'move-in' | 'move-out';
      unitName?: string;
      durationSeconds?: number;
    };

    if (!serverFileId) {
      res.status(400).json({ error: 'Missing serverFileId for video analysis.' });
      return;
    }

    const record = videoRegistry.get(serverFileId);
    if (!record || !fs.existsSync(record.filePath)) {
      res.status(404).json({
        error: 'Uploaded video file is no longer available on the server. Please re-upload the video.',
      });
      return;
    }

    const token = extractVideoToken(req, serverAccessToken);
    if (!isTokenMatch(record.accessToken, token)) {
      res.status(403).json({ error: 'Invalid or missing access token for uploaded video.' });
      return;
    }

    let cleanup = async () => {};
    try {
      const ai = getGeminiClient();
      const prepared = await prepareVideoPart(ai, record);
      cleanup = prepared.cleanup;

      const safeDuration =
        typeof durationSeconds === 'number' && Number.isFinite(durationSeconds) && durationSeconds > 0
          ? durationSeconds
          : undefined;

      const safeInspectionType = inspectionType === 'move-out' ? 'move-out' : 'move-in';
      const prompt = [
        `You are inspecting an apartment ${safeInspectionType} walkthrough video${unitName ? ` for "${unitName}"` : ''}.`,
        safeDuration
          ? `The video duration is ${safeDuration.toFixed(1)} seconds. Every timestampSeconds MUST be strictly between 0 and ${safeDuration.toFixed(1)}.`
          : 'Record the exact timestampSeconds where each observation is clearly visible in the video.',
        'Classification rules (STRICT):',
        '1. "potential-damage": Use ONLY when a specific, identifiable physical defect is directly observable in the video — such as visible scratches, scuffs, cracks, stains, dents, holes, chips, corrosion, water damage, peeling paint, broken/loose hardware, or abnormal discoloration.',
        '   - Look carefully across walls, floors, baseboards, countertops, and fixtures for genuine visible scratches, scuffs, cracks, chips, stains, dents, water marks, or broken/loose hardware.',
        '   - You MUST observe actual visible evidence of the defect before flagging "potential-damage".',
        '   - Provide a precise description of the abnormality (type, appearance, surface location) in visibleCondition and abnormalityDetail, with the exact timestampSeconds where it is clearest.',
        '   - NEVER infer damage from shadows, poor lighting, furniture/clutter, normal household appliances/fixtures (such as a wood stove, doorway, cabinetry, or radiator), or distant/blurry/inaccessible surfaces.',
        '   - If NO physical defect is visible anywhere in the video, return ZERO "potential-damage" items. Do NOT force or fabricate damage findings.',
        '2. "condition-observation": Use for intact/clean surfaces, normal architectural features or appliances, household items without surface damage, or areas where damage cannot be assessed (too distant, shadows, dim lighting, motion blur, or furniture obstruction).',
        '   - Keep condition-observation entries concise and factual; note visibility limits honestly in uncertaintyNote when an area cannot be assessed.',
        'Output rules:',
        '- Return 0 to 12 total entries ordered chronologically. Prioritize accurate evidence over maximizing the number of findings.',
        '- NEVER invent unseen damage, timestamps outside the video, or legal liability.',
      ].join('\n');

      const { result: response, modelUsed } = await generateWithFreeModelFallback((model) =>
        ai.models.generateContent({
          model,
          contents: {
            parts: [prepared.part, { text: prompt }],
          },
          config: {
            systemInstruction:
              'You are a careful, conservative visual inspection assistant for renters. Distinguish strictly between visible physical damage ("potential-damage") and intact/normal or unassessable surfaces ("condition-observation"). Return zero potential-damage items when no defect is clearly visible, preserve uncertainty honestly, and never fabricate defects.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                observations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      category: {
                        type: Type.STRING,
                        description:
                          'Strictly "potential-damage" (only if a concrete physical defect is clearly visible) or "condition-observation" (intact surface, normal feature, or area too distant/dim/obstructed to assess).',
                      },
                      room: {
                        type: Type.STRING,
                        description: 'Room name, e.g. Bedroom, Living Room, Kitchen, Bathroom',
                      },
                      objectOrSurface: {
                        type: Type.STRING,
                        description: 'Specific wall, floor, countertop, fixture, or surface',
                      },
                      visibleCondition: {
                        type: Type.STRING,
                        description:
                          'Factual description of what is visible; for potential-damage, precisely describe the visible abnormality.',
                      },
                      abnormalityDetail: {
                        type: Type.STRING,
                        description:
                          'For potential-damage only: concise specification of the visible defect (e.g. "6-inch hairline plaster crack"). Leave empty for condition-observation.',
                      },
                      timestampSeconds: {
                        type: Type.NUMBER,
                        description: 'Exact timestamp in seconds where the surface or defect is clearly visible',
                      },
                      severity: {
                        type: Type.STRING,
                        description: 'One of: minor, moderate, significant, unclear (use unclear when unassessable)',
                      },
                      confidence: {
                        type: Type.STRING,
                        description: 'One of: high, moderate, low',
                      },
                      uncertaintyNote: {
                        type: Type.STRING,
                        description: 'Optional note on lighting, distance, angle, or blur limitations',
                      },
                    },
                    required: [
                      'category',
                      'room',
                      'objectOrSurface',
                      'visibleCondition',
                      'timestampSeconds',
                      'severity',
                      'confidence',
                    ],
                  },
                },
              },
              required: ['observations'],
            },
          },
        })
      );

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as { observations?: unknown[] };
      const rawObs = Array.isArray(parsed.observations) ? parsed.observations : [];

      const normalized = validateAndNormalizeObservations(
        rawObs,
        safeInspectionType,
        safeDuration,
        'ai'
      );

      res.json({
        model: modelUsed,
        analyzedAt: new Date().toISOString(),
        observations: normalized,
      });
    } catch (err: unknown) {
      const formatted = formatApiError(err, PRIMARY_VIDEO_MODEL);
      if (formatted.retryAfterSeconds) {
        res.setHeader('Retry-After', String(formatted.retryAfterSeconds));
      }
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
        quotaKind: formatted.quotaKind,
        retryable: formatted.retryable,
        retryAfterSeconds: formatted.retryAfterSeconds,
        model: formatted.model,
        attemptedModels: formatted.attemptedModels,
        quotaMetric: formatted.quotaMetric,
        quotaId: formatted.quotaId,
        actionHint: formatted.actionHint,
        upstreamStatus: formatted.upstreamStatus,
      });
    } finally {
      await cleanup();
    }
  });

  // 4. Compare move-in & move-out inspections conservatively
  app.post('/api/compare-inspections', async (req: Request, res: Response) => {
    const {
      unitName,
      moveInServerFileId,
      moveInAccessToken,
      moveOutServerFileId,
      moveOutAccessToken,
      moveInDurationSeconds,
      moveOutDurationSeconds,
      moveInObservations,
      moveOutObservations,
    } = req.body as {
      unitName?: string;
      moveInServerFileId?: string;
      moveInAccessToken?: string;
      moveOutServerFileId?: string;
      moveOutAccessToken?: string;
      moveInDurationSeconds?: number;
      moveOutDurationSeconds?: number;
      moveInObservations?: unknown[];
      moveOutObservations?: unknown[];
    };

    const cleanups: Array<() => Promise<void>> = [];
    try {
      const ai = getGeminiClient();
      const parts: Array<Record<string, unknown>> = [];

      if (moveInServerFileId && videoRegistry.has(moveInServerFileId)) {
        const rec = videoRegistry.get(moveInServerFileId)!;
        if (fs.existsSync(rec.filePath)) {
          if (!isTokenMatch(rec.accessToken, moveInAccessToken)) {
            res.status(403).json({ error: 'Invalid or missing access token for move-in video.' });
            return;
          }
          const p = await prepareVideoPart(ai, rec);
          parts.push({ text: 'VIDEO 1 — MOVE-IN WALKTHROUGH:' }, p.part);
          cleanups.push(p.cleanup);
        }
      }

      if (moveOutServerFileId && videoRegistry.has(moveOutServerFileId)) {
        const rec = videoRegistry.get(moveOutServerFileId)!;
        if (fs.existsSync(rec.filePath)) {
          if (!isTokenMatch(rec.accessToken, moveOutAccessToken)) {
            res.status(403).json({ error: 'Invalid or missing access token for move-out video.' });
            return;
          }
          const p = await prepareVideoPart(ai, rec);
          parts.push({ text: 'VIDEO 2 — MOVE-OUT WALKTHROUGH:' }, p.part);
          cleanups.push(p.cleanup);
        }
      }

      const prompt = [
        `Compare the move-in and move-out inspections for "${unitName || 'Apartment'}".`,
        'Reviewed Move-In Observations:',
        JSON.stringify(moveInObservations || [], null, 2),
        'Reviewed Move-Out Observations:',
        JSON.stringify(moveOutObservations || [], null, 2),
        'Rules:',
        '- Classify each comparable room/surface using ONLY one of these four exact conservative classifications:',
        '  1. "Potentially pre-existing"',
        '  2. "Potentially new"',
        '  3. "No clear change"',
        '  4. "Insufficient evidence"',
        '- Entries marked category: "condition-observation" represent intact surfaces, normal features, or unassessable views (not damage findings). Do NOT treat them as damage unless an actual defect appeared.',
        '- NEVER claim 100% certainty when camera angles, distance, or lighting differ, or when a surface is only visible in one video.',
        '- Include linkedMoveInObservationId and linkedMoveOutObservationId when matching an existing observation id.',
        '- Keep timestamps strictly within each video duration.',
      ].join('\n\n');

      parts.push({ text: prompt });

      const { result: response } = await generateWithFreeModelFallback((model) =>
        ai.models.generateContent({
          model,
          contents: { parts },
          config: {
            systemInstruction:
              'You compare move-in and move-out apartment evidence conservatively. You never overstate certainty when angles, lighting, or framing differ.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                comparisons: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      room: { type: Type.STRING },
                      areaOrSurface: { type: Type.STRING },
                      classification: { type: Type.STRING },
                      moveInTimestampSeconds: { type: Type.NUMBER, nullable: true },
                      moveOutTimestampSeconds: { type: Type.NUMBER, nullable: true },
                      moveInSummary: { type: Type.STRING },
                      moveOutSummary: { type: Type.STRING },
                      reasoning: { type: Type.STRING },
                      visibilityCaveat: { type: Type.STRING },
                      linkedMoveInObservationId: { type: Type.STRING },
                      linkedMoveOutObservationId: { type: Type.STRING },
                    },
                    required: ['room', 'areaOrSurface', 'classification', 'moveInSummary', 'moveOutSummary', 'reasoning'],
                  },
                },
              },
              required: ['comparisons'],
            },
          },
        })
      );

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText) as { comparisons?: unknown[] };
      const rawItems = Array.isArray(parsed.comparisons) ? parsed.comparisons : [];

      const comparisons = rawItems
        .map((item, idx) => {
          if (!item || typeof item !== 'object') return null;
          const r = item as Record<string, unknown>;
          const room = typeof r.room === 'string' ? r.room.trim() : '';
          const areaOrSurface = typeof r.areaOrSurface === 'string' ? r.areaOrSurface.trim() : '';
          const reasoning = typeof r.reasoning === 'string' ? r.reasoning.trim() : '';
          if (!room || !areaOrSurface || !reasoning) return null;
          return {
            id: `cmp-${Date.now()}-${idx}`,
            room,
            areaOrSurface,
            classification: normalizeClassification(r.classification),
            moveInTimestampSeconds:
              r.moveInTimestampSeconds === null || r.moveInTimestampSeconds === undefined
                ? null
                : clampTs(r.moveInTimestampSeconds, moveInDurationSeconds),
            moveOutTimestampSeconds:
              r.moveOutTimestampSeconds === null || r.moveOutTimestampSeconds === undefined
                ? null
                : clampTs(r.moveOutTimestampSeconds, moveOutDurationSeconds),
            moveInSummary:
              typeof r.moveInSummary === 'string' && r.moveInSummary.trim()
                ? r.moveInSummary.trim()
                : 'Not clearly visible in move-in footage.',
            moveOutSummary:
              typeof r.moveOutSummary === 'string' && r.moveOutSummary.trim()
                ? r.moveOutSummary.trim()
                : 'Not clearly visible in move-out footage.',
            reasoning,
            visibilityCaveat:
              typeof r.visibilityCaveat === 'string' && r.visibilityCaveat.trim()
                ? r.visibilityCaveat.trim()
                : undefined,
            linkedMoveInObservationId:
              typeof r.linkedMoveInObservationId === 'string' && r.linkedMoveInObservationId.trim()
                ? r.linkedMoveInObservationId.trim()
                : undefined,
            linkedMoveOutObservationId:
              typeof r.linkedMoveOutObservationId === 'string' && r.linkedMoveOutObservationId.trim()
                ? r.linkedMoveOutObservationId.trim()
                : undefined,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      res.json({ comparisons });
    } catch (err: unknown) {
      const formatted = formatApiError(err, PRIMARY_VIDEO_MODEL);
      if (formatted.retryAfterSeconds) {
        res.setHeader('Retry-After', String(formatted.retryAfterSeconds));
      }
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
        quotaKind: formatted.quotaKind,
        retryable: formatted.retryable,
        retryAfterSeconds: formatted.retryAfterSeconds,
        model: formatted.model,
        actionHint: formatted.actionHint,
      });
    } finally {
      for (const fn of cleanups) {
        await fn();
      }
    }
  });

  // 5. Claim-to-Evidence Matching (signature feature)
  app.post('/api/match-claim', async (req: Request, res: Response) => {
    const { claimText, amountUsd, apartmentContext, observations, comparisons } = req.body as {
      claimText?: string;
      amountUsd?: number | null;
      apartmentContext?: Record<string, unknown>;
      observations?: unknown[];
      comparisons?: unknown[];
    };

    if (!claimText || !claimText.trim()) {
      res.status(400).json({ error: 'Please enter a proposed deduction description.' });
      return;
    }

    try {
      const ai = getGeminiClient();
      const prompt = [
        `Proposed landlord deduction: "${claimText.trim()}"${amountUsd !== null && amountUsd !== undefined ? ` ($${amountUsd})` : ''}`,
        `Apartment context: ${JSON.stringify(apartmentContext || {})}`,
        `Reviewed & active observations: ${JSON.stringify(observations || [], null, 2)}`,
        `Move-in vs. move-out comparisons: ${JSON.stringify(comparisons || [], null, 2)}`,
        'Task:',
        '- Match this proposed deduction strictly against the provided observations and comparisons.',
        '- Distinguish "potential-damage" findings from "condition-observation" coverage notes (which describe intact surfaces, normal features, or unassessable views).',
        '- Identify exact observation IDs (matchedObservationIds) and comparison IDs (matchedComparisonIds) that relate to the room/surface in the claim.',
        '- Extract keyTimestamps referencing ONLY timestamps present in the provided observations/comparisons.',
        '- Classify evidenceAlignment as one of: "supports-pre-existing", "mixed-or-unclear", "supports-new-change", "insufficient-evidence".',
        '- Write a clear, factual assessmentSummary grounded strictly in the matched observations.',
        '- Write a candid limitationsNote explaining what the footage does not prove (angles, lighting, unfilmed areas, cleaning vs. repair scope).',
        '- NEVER invent observations, timestamps, legal conclusions, or statutory citations.',
      ].join('\n\n');

      const { result: response } = await generateWithFreeModelFallback((model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction:
              'You match landlord deposit deductions strictly to documented visual observations and comparison records. Never invent evidence or give legal advice.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                matchedObservationIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                matchedComparisonIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                evidenceAlignment: { type: Type.STRING },
                assessmentSummary: { type: Type.STRING },
                limitationsNote: { type: Type.STRING },
                keyTimestamps: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      inspectionType: { type: Type.STRING },
                      timestampSeconds: { type: Type.NUMBER },
                      label: { type: Type.STRING },
                      observationId: { type: Type.STRING },
                    },
                    required: ['inspectionType', 'timestampSeconds', 'label'],
                  },
                },
              },
              required: [
                'matchedObservationIds',
                'matchedComparisonIds',
                'evidenceAlignment',
                'assessmentSummary',
                'limitationsNote',
                'keyTimestamps',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      const alignmentRaw = typeof parsed.evidenceAlignment === 'string' ? parsed.evidenceAlignment : '';
      const validAlignments = new Set([
        'supports-pre-existing',
        'mixed-or-unclear',
        'supports-new-change',
        'insufficient-evidence',
      ]);

      const rawKeyTs = Array.isArray(parsed.keyTimestamps) ? parsed.keyTimestamps : [];
      const keyTimestamps = rawKeyTs
        .map((k) => {
          if (!k || typeof k !== 'object') return null;
          const rec = k as Record<string, unknown>;
          return {
            inspectionType: rec.inspectionType === 'move-out' ? 'move-out' : 'move-in',
            timestampSeconds: clampTs(rec.timestampSeconds),
            label: typeof rec.label === 'string' ? rec.label.trim() : 'Inspection frame',
            observationId:
              typeof rec.observationId === 'string' && rec.observationId.trim()
                ? rec.observationId.trim()
                : undefined,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      res.json({
        id: `claim-${Date.now()}`,
        claimText: claimText.trim(),
        amountUsd: typeof amountUsd === 'number' && Number.isFinite(amountUsd) ? amountUsd : null,
        matchedObservationIds: Array.isArray(parsed.matchedObservationIds)
          ? parsed.matchedObservationIds.filter((s): s is string => typeof s === 'string')
          : [],
        matchedComparisonIds: Array.isArray(parsed.matchedComparisonIds)
          ? parsed.matchedComparisonIds.filter((s): s is string => typeof s === 'string')
          : [],
        evidenceAlignment: validAlignments.has(alignmentRaw) ? alignmentRaw : 'insufficient-evidence',
        assessmentSummary:
          typeof parsed.assessmentSummary === 'string' && parsed.assessmentSummary.trim()
            ? parsed.assessmentSummary.trim()
            : 'Insufficient documented visual evidence to match this deduction.',
        limitationsNote:
          typeof parsed.limitationsNote === 'string' && parsed.limitationsNote.trim()
            ? parsed.limitationsNote.trim()
            : 'Assessment is limited to areas clearly visible in the submitted walkthrough recordings.',
        keyTimestamps,
        createdAt: new Date().toISOString(),
        source: 'gemini-live',
      });
    } catch (err: unknown) {
      const formatted = formatApiError(err, PRIMARY_VIDEO_MODEL);
      if (formatted.retryAfterSeconds) {
        res.setHeader('Retry-After', String(formatted.retryAfterSeconds));
      }
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
        quotaKind: formatted.quotaKind,
        retryable: formatted.retryable,
        retryAfterSeconds: formatted.retryAfterSeconds,
        model: formatted.model,
        actionHint: formatted.actionHint,
      });
    }
  });

  // 6. Generate polite reconsideration request letter grounded strictly in reviewed observations
  app.post('/api/generate-reconsideration', async (req: Request, res: Response) => {
    const { apartment, claims, observations, comparisons } = req.body as {
      apartment?: Record<string, unknown>;
      claims?: unknown[];
      observations?: unknown[];
      comparisons?: unknown[];
    };

    try {
      const ai = getGeminiClient();
      const prompt = [
        'Draft a polite, calm, factual deposit reconsideration request from the resident to the landlord/property manager.',
        `Apartment details: ${JSON.stringify(apartment || {})}`,
        `Matched deduction claims: ${JSON.stringify(claims || [], null, 2)}`,
        `Reviewed observations: ${JSON.stringify(observations || [], null, 2)}`,
        `Comparison findings: ${JSON.stringify(comparisons || [], null, 2)}`,
        'Strict guidelines:',
        '- Maintain a respectful, cooperative, matter-of-fact tone.',
        '- Reference ONLY the specific timestamps, room observations, and SHA-256 video identifiers provided above.',
        '- Acknowledge any limitations or items where evidence is unclear rather than overclaiming.',
        '- NEVER invent legal rules, cite statutes/code sections, or threaten litigation.',
      ].join('\n\n');

      const { result: response } = await generateWithFreeModelFallback((model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction:
              'You write polite, factual deposit reconsideration requests grounded strictly in reviewed video timestamps and visual observations. Never invent legal statutes or make legal conclusions.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                subject: { type: Type.STRING },
                body: { type: Type.STRING },
              },
              required: ['subject', 'body'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as { subject?: string; body?: string };
      res.json({
        subject:
          typeof parsed.subject === 'string' && parsed.subject.trim()
            ? parsed.subject.trim()
            : `Request for Reconsideration of Deposit Deductions`,
        body: typeof parsed.body === 'string' ? parsed.body.trim() : '',
        generatedAt: new Date().toISOString(),
        source: 'gemini-live',
      });
    } catch (err: unknown) {
      const formatted = formatApiError(err, PRIMARY_VIDEO_MODEL);
      if (formatted.retryAfterSeconds) {
        res.setHeader('Retry-After', String(formatted.retryAfterSeconds));
      }
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
        quotaKind: formatted.quotaKind,
        retryable: formatted.retryable,
        retryAfterSeconds: formatted.retryAfterSeconds,
        model: formatted.model,
        actionHint: formatted.actionHint,
      });
    }
  });

  // Return JSON 404 for any unmatched /api/* route instead of falling through to SPA HTML
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Vite dev middleware vs production static serving
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (process.env.NODE_ENV !== 'development' &&
      (Boolean(process.env.K_SERVICE || process.env.K_REVISION) ||
        fs.existsSync(path.resolve('dist/index.html'))));

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve('dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path === '/api' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BASELINE server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start BASELINE server:', err);
  process.exit(1);
});
