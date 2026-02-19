export interface Point {
  x: number;
  y: number;
}

export interface Corners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

/**
 * Apply perspective transform: maps a quadrilateral (4 corners) to a rectangle.
 * Uses bilinear interpolation for quality.
 */
export function perspectiveTransform(
  imageDataUrl: string,
  corners: Corners
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;

      // Convert percentage corners to pixel coordinates
      const src = {
        topLeft: { x: corners.topLeft.x * w, y: corners.topLeft.y * h },
        topRight: { x: corners.topRight.x * w, y: corners.topRight.y * h },
        bottomRight: { x: corners.bottomRight.x * w, y: corners.bottomRight.y * h },
        bottomLeft: { x: corners.bottomLeft.x * w, y: corners.bottomLeft.y * h },
      };

      // Calculate output dimensions based on the longest edges
      const topWidth = Math.hypot(src.topRight.x - src.topLeft.x, src.topRight.y - src.topLeft.y);
      const bottomWidth = Math.hypot(src.bottomRight.x - src.bottomLeft.x, src.bottomRight.y - src.bottomLeft.y);
      const leftHeight = Math.hypot(src.bottomLeft.x - src.topLeft.x, src.bottomLeft.y - src.topLeft.y);
      const rightHeight = Math.hypot(src.bottomRight.x - src.topRight.x, src.bottomRight.y - src.topRight.y);

      const outW = Math.round(Math.max(topWidth, bottomWidth));
      const outH = Math.round(Math.max(leftHeight, rightHeight));

      // Read source pixels
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = w;
      srcCanvas.height = h;
      const srcCtx = srcCanvas.getContext('2d')!;
      srcCtx.drawImage(img, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, w, h);

      // Create output canvas
      const outCanvas = document.createElement('canvas');
      outCanvas.width = outW;
      outCanvas.height = outH;
      const outCtx = outCanvas.getContext('2d')!;
      const outImageData = outCtx.createImageData(outW, outH);

      // Bilinear interpolation mapping
      for (let dy = 0; dy < outH; dy++) {
        for (let dx = 0; dx < outW; dx++) {
          const u = dx / outW;
          const v = dy / outH;

          // Bilinear interpolation of the quadrilateral
          const sx =
            (1 - u) * (1 - v) * src.topLeft.x +
            u * (1 - v) * src.topRight.x +
            u * v * src.bottomRight.x +
            (1 - u) * v * src.bottomLeft.x;

          const sy =
            (1 - u) * (1 - v) * src.topLeft.y +
            u * (1 - v) * src.topRight.y +
            u * v * src.bottomRight.y +
            (1 - u) * v * src.bottomLeft.y;

          // Nearest neighbor sampling
          const ix = Math.min(Math.max(Math.round(sx), 0), w - 1);
          const iy = Math.min(Math.max(Math.round(sy), 0), h - 1);

          const srcIdx = (iy * w + ix) * 4;
          const dstIdx = (dy * outW + dx) * 4;

          outImageData.data[dstIdx] = srcData.data[srcIdx];
          outImageData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
          outImageData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
          outImageData.data[dstIdx + 3] = srcData.data[srcIdx + 3];
        }
      }

      outCtx.putImageData(outImageData, 0, 0);
      resolve(outCanvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = imageDataUrl;
  });
}
