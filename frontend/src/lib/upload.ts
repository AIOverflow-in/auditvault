// Multipart upload to Cloudflare R2 via presigned per-part URLs.
//
// Flow:
//   1. POST /projects/{id}/files/upload-init  → server creates the multipart
//      upload, presigns N part URLs, returns { fileId, uploadId, key, partSize, parts[] }.
//   2. For each part: PUT the corresponding slice of the file directly to R2.
//      Read the ETag header from the response; if the URL has expired (R2
//      replies 403/SignatureDoesNotMatch), refresh it via
//      GET /projects/{id}/files/{fileId}/parts/{partNumber}/url and retry.
//   3. POST /projects/{id}/files/{fileId}/complete with { parts: [{partNumber, etag}, ...] }.
//      On any fatal error before complete, POST .../abort to clean up.
//
// The browser must be allowed to read the ETag response header — make sure
// the R2 bucket's CORS policy includes "ExposeHeaders": ["ETag"].

import { BROWSER_API_URL } from './api';

export type UploadCategory = 'RAW_DATA' | 'DRAFT_REPORT' | 'FINAL_REPORT' | 'FEEDBACK' | 'OTHER';

export type UploadResult = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category: UploadCategory;
  createdAt: string;
};

export type ProgressFn = (loaded: number, total: number) => void;

type InitResp = {
  fileId: string;
  uploadId: string;
  key: string;
  partSize: number;
  parts: { partNumber: number; url: string }[];
};

const PART_RETRY_LIMIT = 3;

export async function uploadProjectFile(
  projectId: string,
  file: File,
  category: UploadCategory,
  onProgress?: ProgressFn,
): Promise<UploadResult> {
  // 1. Init
  const initRes = await fetch(`${BROWSER_API_URL}/projects/${projectId}/files/upload-init`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      category,
    }),
  });
  if (!initRes.ok) {
    const body = await initRes.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not start upload.');
  }
  const init = (await initRes.json()) as InitResp;

  // 2. Upload parts
  const completed: { partNumber: number; etag: string }[] = [];
  let bytesDone = 0;

  try {
    for (const p of init.parts) {
      const start = (p.partNumber - 1) * init.partSize;
      const end = Math.min(start + init.partSize, file.size);
      const blob = file.slice(start, end);

      const etag = await putPartWithRetry({
        projectId,
        fileId: init.fileId,
        partNumber: p.partNumber,
        url: p.url,
        blob,
      });
      completed.push({ partNumber: p.partNumber, etag });
      bytesDone += blob.size;
      onProgress?.(bytesDone, file.size);
    }
  } catch (err) {
    // Best-effort cleanup so the server doesn't keep a zombie pending row.
    try {
      await fetch(`${BROWSER_API_URL}/projects/${projectId}/files/${init.fileId}/abort`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // already failing — surface the original error
    }
    throw err;
  }

  // 3. Complete
  const completeRes = await fetch(`${BROWSER_API_URL}/projects/${projectId}/files/${init.fileId}/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts: completed }),
  });
  if (!completeRes.ok) {
    const body = await completeRes.json().catch(() => ({}));
    throw new Error(body.error ?? 'Could not finalise upload.');
  }
  const out = (await completeRes.json()) as { file: UploadResult };
  return out.file;
}

type PutArgs = {
  projectId: string;
  fileId: string;
  partNumber: number;
  url: string;
  blob: Blob;
};

// putPartWithRetry handles transient network failures and expired presigned
// URLs. On a 403 we ask the server to mint a fresh URL before retrying.
async function putPartWithRetry(args: PutArgs): Promise<string> {
  let url = args.url;
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= PART_RETRY_LIMIT; attempt++) {
    try {
      const res = await fetch(url, { method: 'PUT', body: args.blob });
      if (res.ok) {
        const etag = res.headers.get('etag') ?? res.headers.get('ETag');
        if (!etag) {
          throw new Error(
            'R2 did not return an ETag header. Check the bucket CORS config exposes "ETag".',
          );
        }
        return etag;
      }

      // Expired URL? Refresh once and retry.
      if (res.status === 403 || res.status === 401) {
        url = await refreshPartURL(args.projectId, args.fileId, args.partNumber);
        continue;
      }

      lastErr = new Error(`R2 part ${args.partNumber} failed (${res.status}).`);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
    // Exponential backoff between retries: 0.5s, 1s, 2s.
    await sleep(500 * attempt);
  }

  throw lastErr ?? new Error(`R2 part ${args.partNumber} failed after retries.`);
}

async function refreshPartURL(projectId: string, fileId: string, partNumber: number): Promise<string> {
  const res = await fetch(
    `${BROWSER_API_URL}/projects/${projectId}/files/${fileId}/parts/${partNumber}/url`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error('Could not refresh upload URL.');
  const body = (await res.json()) as { url: string };
  return body.url;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
