// Client-side image editing: crop to an aspect, rotate, scale down and re-encode
// before upload, so editors never ship a 12 MB phone photo to readers.

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not open that image.'));
    img.src = src;
  });
}

/**
 * @param {HTMLImageElement} img
 * @param {{ rotate: number, aspect: number|null, focusX: number, focusY: number, zoom: number, maxWidth: number }} o
 *   aspect = width/height or null for original; focusX/Y 0..1 pick which part of the image the crop keeps.
 */
export function render(img, o) {
  const rot = ((o.rotate % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const srcW = swap ? img.naturalHeight : img.naturalWidth;
  const srcH = swap ? img.naturalWidth : img.naturalHeight;

  // rotate into an intermediate canvas
  const r = document.createElement('canvas');
  r.width = srcW; r.height = srcH;
  const rc = r.getContext('2d');
  rc.translate(srcW / 2, srcH / 2);
  rc.rotate((rot * Math.PI) / 180);
  rc.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

  // crop window
  const zoom = Math.max(1, o.zoom || 1);
  let cw = srcW / zoom, ch = srcH / zoom;
  if (o.aspect) {
    if (cw / ch > o.aspect) cw = ch * o.aspect; else ch = cw / o.aspect;
  }
  const cx = (srcW - cw) * (o.focusX ?? 0.5);
  const cy = (srcH - ch) * (o.focusY ?? 0.5);

  const scale = Math.min(1, (o.maxWidth || 2000) / cw);
  const out = document.createElement('canvas');
  out.width = Math.round(cw * scale); out.height = Math.round(ch * scale);
  const oc = out.getContext('2d');
  oc.imageSmoothingQuality = 'high';
  oc.drawImage(r, cx, cy, cw, ch, 0, 0, out.width, out.height);
  return out;
}

export function toBlob(canvas, type = 'image/webp', quality = 0.84) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}
