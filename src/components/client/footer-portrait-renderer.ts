const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function headTransform(x: number, y: number, size: number) {
  const angle = (clamp(x) * Math.PI) / 90;
  const cosine = Math.cos(angle),
    sine = Math.sin(angle);
  const px = 0.5,
    py = 0.57;
  return [
    size * cosine,
    size * sine,
    -size * sine,
    size * cosine,
    size * (px - cosine * px + sine * py),
    size * (py - sine * px - cosine * py + clamp(y) * 0.0015),
  ] as const;
}

/** The approved single-drawing preview: rigid head, anchored nape and laptop. */
export function createPortraitRenderer(canvas: HTMLCanvasElement, portrait: HTMLImageElement) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Canvas is unavailable");
  let size = canvas.width;
  return {
    resize(width: number, ratio = 1) {
      size = Math.max(1, Math.round(width * Math.min(ratio, 2)));
      if (canvas.width !== size) canvas.width = canvas.height = size;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
    },
    draw(x: number, y: number) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      context.clearRect(0, 0, size, size);
      context.setTransform(size, 0, 0, size, 0, 0);
      context.save();
      // A transparent foreground cannot erase a moving contour behind it.
      // Stop the moving layer at the anchored nape in destination coordinates.
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(1, 0);
      context.lineTo(1, 0.57);
      context.lineTo(0, 0.57);
      context.closePath();
      context.clip();
      context.setTransform(...headTransform(x, y, size));
      context.beginPath();
      context.moveTo(0.24, 0.11);
      context.lineTo(0.76, 0.11);
      context.lineTo(0.76, 0.575);
      context.lineTo(0.24, 0.575);
      context.closePath();
      context.clip();
      context.drawImage(portrait, 0, 0, 1, 1);
      context.restore();

      // The source laptop starts below .576: exclude it from the rotating
      // cutout and keep the lower nape in the stationary foreground.
      const start = 0.57;
      context.drawImage(
        portrait,
        0,
        portrait.naturalHeight * start,
        portrait.naturalWidth,
        portrait.naturalHeight * (1 - start),
        0,
        start,
        1,
        1 - start,
      );
    },
  };
}
