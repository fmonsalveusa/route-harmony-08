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

          // Bilinear interpolation
          const floorX = Math.floor(sx);
          const floorY = Math.floor(sy);
          const fracX = sx - floorX;
          const fracY = sy - floorY;

          const x0 = Math.min(Math.max(floorX, 0), w - 1);
          const x1 = Math.min(x0 + 1, w - 1);
          const y0 = Math.min(Math.max(floorY, 0), h - 1);
          const y1 = Math.min(y0 + 1, h - 1);

          const w00 = (1 - fracX) * (1 - fracY);
          const w10 = fracX * (1 - fracY);
          const w01 = (1 - fracX) * fracY;
          const w11 = fracX * fracY;

          const i00 = (y0 * w + x0) * 4;
          const i10 = (y0 * w + x1) * 4;
          const i01 = (y1 * w + x0) * 4;
          const i11 = (y1 * w + x1) * 4;

          const dstIdx = (dy * outW + dx) * 4;
          for (let c = 0; c < 4; c++) {
            outImageData.data[dstIdx + c] = Math.round(
              srcData.data[i00 + c] * w00 +
              srcData.data[i10 + c] * w10 +
              srcData.data[i01 + c] * w01 +
              srcData.data[i11 + c] * w11
            );
          }
        }
      }

      outCtx.putImageData(outImageData, 0, 0);
      resolve(outCanvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = imageDataUrl;
  });
}
