import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uploadUserAvatar } from '@/runtime/client/use-cases/avatar-upload-use-cases';
import { asMock } from '../../../test-utils/mock-helpers';

vi.mock('@/config/client/firebase-client', () => ({
  storage: { _isMockStorage: true },
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

describe('firebase-storage-helpers › uploadUserAvatar', () => {
  let drawImageSpy;
  let toBlobImpl;
  let originalCreateImageBitmap;
  let originalGetContext;
  let originalToBlob;

  /**
   * 建立 stub 用的 ImageBitmap 物件。
   * @param {number} width - 圖片寬度。
   * @param {number} height - 圖片高度。
   * @returns {{width:number,height:number}} 模擬 bitmap。
   */
  function fakeBitmap(width, height) {
    return { width, height };
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // jsdom 沒有 createImageBitmap，手動裝上
    originalCreateImageBitmap = window.createImageBitmap;
    /** @type {any} */ (window).createImageBitmap = vi.fn();

    // jsdom 的 canvas.getContext 回 null，用 stub 頂住壓縮流程
    drawImageSpy = vi.fn();
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    /** @type {any} */ (HTMLCanvasElement.prototype).getContext = vi.fn(() => ({
      drawImage: drawImageSpy,
    }));

    // jsdom 的 canvas.toBlob 行為不穩，直接換成受控版
    toBlobImpl = (cb) => cb(new Blob(['fake-bytes'], { type: 'image/png' }));
    originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function stubToBlob(cb) {
      toBlobImpl(cb);
    };

    // 預設:ref 回帶路徑的 stub、uploadBytes resolve、getDownloadURL 給固定 URL
    asMock(ref).mockImplementation((_storage, path) => ({ _path: path }));
    asMock(uploadBytes).mockResolvedValue({});
    asMock(getDownloadURL).mockResolvedValue('https://fake-cdn/avatar.png');
  });

  afterEach(() => {
    /** @type {any} */ (window).createImageBitmap = originalCreateImageBitmap;
    /** @type {any} */ (HTMLCanvasElement.prototype).getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  });

  it('不縮放小圖並回傳帶 cache-bust 的 URL（URL 無 query 用 ?v=）', async () => {
    asMock(window.createImageBitmap).mockResolvedValue(fakeBitmap(200, 300));

    const file = new File(['raw'], 'avatar.png', { type: 'image/png' });
    const url = await uploadUserAvatar(file, 'uid-1');

    expect(drawImageSpy).toHaveBeenCalledWith(expect.anything(), 0, 0, 200, 300);
    expect(ref).toHaveBeenCalledWith({ _isMockStorage: true }, 'users/uid-1/avatar.png');
    expect(uploadBytes).toHaveBeenCalledWith(
      { _path: 'users/uid-1/avatar.png' },
      expect.any(Blob),
      { contentType: 'image/png' },
    );
    expect(url).toMatch(/^https:\/\/fake-cdn\/avatar\.png\?v=\d+$/);
  });

  it('橫向超 512px 時等比縮小（1024x500 → 512x250）', async () => {
    asMock(window.createImageBitmap).mockResolvedValue(fakeBitmap(1024, 500));

    const file = new File(['raw'], 'wide.png', { type: 'image/png' });
    await uploadUserAvatar(file, 'uid-2');

    expect(drawImageSpy).toHaveBeenCalledWith(expect.anything(), 0, 0, 512, 250);
  });

  it('縱向超 512px 時等比縮小（500x1024 → 250x512）', async () => {
    asMock(window.createImageBitmap).mockResolvedValue(fakeBitmap(500, 1024));

    const file = new File(['raw'], 'tall.png', { type: 'image/png' });
    await uploadUserAvatar(file, 'uid-3');

    expect(drawImageSpy).toHaveBeenCalledWith(expect.anything(), 0, 0, 250, 512);
  });

  it('正方形大圖走縱向分支（800x800 → 512x512）', async () => {
    asMock(window.createImageBitmap).mockResolvedValue(fakeBitmap(800, 800));

    const file = new File(['raw'], 'square.png', { type: 'image/png' });
    await uploadUserAvatar(file, 'uid-4');

    expect(drawImageSpy).toHaveBeenCalledWith(expect.anything(), 0, 0, 512, 512);
  });

  it('URL 已有 query 時用 &v= 接 cache-bust', async () => {
    asMock(window.createImageBitmap).mockResolvedValue(fakeBitmap(100, 100));
    asMock(getDownloadURL).mockResolvedValueOnce('https://fake-cdn/avatar.png?alt=media&token=xyz');

    const file = new File(['raw'], 'avatar.png', { type: 'image/png' });
    const url = await uploadUserAvatar(file, 'uid-5');

    expect(url).toMatch(/^https:\/\/fake-cdn\/avatar\.png\?alt=media&token=xyz&v=\d+$/);
  });

  it('toBlob 失敗時丟出 toBlob 失敗錯誤', async () => {
    asMock(window.createImageBitmap).mockResolvedValue(fakeBitmap(100, 100));
    toBlobImpl = (cb) => cb(null);

    const file = new File(['raw'], 'broken.png', { type: 'image/png' });

    await expect(uploadUserAvatar(file, 'uid-6')).rejects.toThrow('toBlob 失敗');
    expect(uploadBytes).not.toHaveBeenCalled();
  });
});
