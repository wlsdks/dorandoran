import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase-storage';
import { auth, ensureAuthentication } from '@/lib/auth-session';
import { compressImage } from '@/lib/image-utils';
import { reportClientError } from '@/lib/error-report';

const STALL_MS = 20_000;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

class UploadStalledError extends Error { constructor() { super('업로드가 20초 넘게 진행되지 않아요. 회사·학교 네트워크나 보안 프로그램이 막고 있을 수 있어요. 다른 네트워크에서 다시 시도해주세요.'); this.code = 'upload/stalled'; } }

/**
 * 사진 하나를 줄여서 Storage에 올리고 주소를 돌려준다.
 * 진행률을 알려주고, 20초 동안 진척이 없으면 멈추고 이유를 알린다 — 아무 반응 없이 기다리는 일이 없게.
 */
export async function uploadImage(file, folder, { onProgress } = {}) {
  const context = { name: file?.name?.slice(-12), type: file?.type, size: file?.size };
  try {
    await ensureAuthentication();
    const blob = await compressImage(file);
    context.outType = blob.type; context.outSize = blob.size;
    const contentType = blob.type || 'image/jpeg';
    const path = `${folder}/${auth.currentUser.uid}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${EXT[contentType] || 'jpg'}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, blob, { contentType });
    await new Promise((resolve, reject) => {
      let stall = setTimeout(() => { task.cancel(); reject(new UploadStalledError()); }, STALL_MS);
      task.on('state_changed', (snap) => {
        clearTimeout(stall);
        stall = setTimeout(() => { task.cancel(); reject(new UploadStalledError()); }, STALL_MS);
        onProgress?.(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0);
      }, (error) => { clearTimeout(stall); reject(error); }, () => { clearTimeout(stall); resolve(); });
    });
    return await getDownloadURL(storageRef);
  } catch (error) {
    reportClientError('image-upload', error, context);
    throw error;
  }
}
