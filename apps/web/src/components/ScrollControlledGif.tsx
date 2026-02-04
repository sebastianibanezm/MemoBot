"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { parseGIF, decompressFrames } from "gifuct-js";

interface Frame {
  imageData: ImageData;
  delay: number;
}

interface ScrollControlledGifProps {
  src: string;
  className?: string;
  /** 
   * How many pixels of scroll equals one full animation cycle.
   * Default is the viewport height (100vh worth of scroll = 1 animation cycle)
   */
  scrollDistance?: number;
  /**
   * If true, the animation will loop when scrolling beyond one cycle
   */
  loop?: boolean;
  /**
   * Overlay to render on top of the animation
   */
  overlay?: React.ReactNode;
  /**
   * Scale factor for the animation (0-1). Default is 1 (100%)
   */
  scale?: number;
  /**
   * Number of pixels to crop from the bottom of the animation
   */
  cropBottom?: number;
}

export default function ScrollControlledGif({
  src,
  className = "",
  scrollDistance,
  loop = true,
  overlay,
  scale = 1,
  cropBottom = 0,
}: ScrollControlledGifProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<Frame[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [coverScale, setCoverScale] = useState(1);
  const lastFrameIndexRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Calculate scale to cover viewport (like object-cover)
  useEffect(() => {
    function calculateCoverScale() {
      if (dimensions.width === 0 || dimensions.height === 0) return;
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const scaleX = viewportWidth / dimensions.width;
      const scaleY = viewportHeight / dimensions.height;
      
      // Use the larger scale to ensure full coverage
      setCoverScale(Math.max(scaleX, scaleY));
    }

    calculateCoverScale();
    window.addEventListener("resize", calculateCoverScale);
    return () => window.removeEventListener("resize", calculateCoverScale);
  }, [dimensions]);

  // Parse GIF and extract frames
  useEffect(() => {
    let cancelled = false;

    async function loadGif() {
      try {
        const response = await fetch(src);
        const buffer = await response.arrayBuffer();
        const gif = parseGIF(buffer);
        const frames = decompressFrames(gif, true);

        if (cancelled || frames.length === 0) return;

        // Get dimensions from the first frame
        const width = frames[0].dims.width;
        const height = frames[0].dims.height;
        setDimensions({ width, height });

        // Create a temporary canvas for compositing frames
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return;

        // Create a canvas to hold the full composite for each frame
        const compositeCanvas = document.createElement("canvas");
        compositeCanvas.width = width;
        compositeCanvas.height = height;
        const compositeCtx = compositeCanvas.getContext("2d");
        if (!compositeCtx) return;

        const processedFrames: Frame[] = [];

        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i];
          const { dims, patch, disposalType } = frame;

          // Create ImageData from the patch
          const patchData = new ImageData(
            new Uint8ClampedArray(patch),
            dims.width,
            dims.height
          );

          // Draw the patch onto the temp canvas at the correct position
          tempCtx.clearRect(0, 0, width, height);
          tempCtx.putImageData(patchData, 0, 0);

          // Draw the patch onto the composite at the correct position
          compositeCtx.drawImage(
            tempCanvas,
            0,
            0,
            dims.width,
            dims.height,
            dims.left,
            dims.top,
            dims.width,
            dims.height
          );

          // Get the full composite image for this frame
          const fullFrameData = compositeCtx.getImageData(0, 0, width, height);
          processedFrames.push({
            imageData: fullFrameData,
            delay: frame.delay,
          });

          // Handle disposal
          if (disposalType === 2) {
            // Restore to background (clear the area)
            compositeCtx.clearRect(dims.left, dims.top, dims.width, dims.height);
          } else if (disposalType === 3) {
            // Restore to previous - for simplicity, we'll just keep current state
            // A more complex implementation would save/restore the previous state
          }
          // disposalType 0 or 1: keep the current state
        }

        if (!cancelled) {
          framesRef.current = processedFrames;
          setIsLoaded(true);
        }
      } catch (error) {
        console.error("Failed to load GIF:", error);
      }
    }

    loadGif();

    return () => {
      cancelled = true;
    };
  }, [src]);

  // Draw a specific frame to the canvas
  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    const frames = framesRef.current;
    if (!canvas || frames.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clamp frame index
    const clampedIndex = Math.max(0, Math.min(frames.length - 1, Math.floor(frameIndex)));
    
    // Only redraw if frame changed
    if (clampedIndex === lastFrameIndexRef.current && lastFrameIndexRef.current !== 0) {
      return;
    }
    
    lastFrameIndexRef.current = clampedIndex;
    
    const frame = frames[clampedIndex];
    if (frame) {
      ctx.putImageData(frame.imageData, 0, 0);
    }
  }, []);

  // Handle scroll to control animation
  useEffect(() => {
    if (!isLoaded) return;

    const totalFrames = framesRef.current.length;
    const scrollDist = scrollDistance || window.innerHeight;

    function handleScroll() {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        
        // Calculate progress through the animation (0 to 1 for one cycle)
        let progress = scrollY / scrollDist;
        
        if (loop) {
          // For looping, use modulo to cycle through
          progress = progress % 1;
          if (progress < 0) progress += 1;
        } else {
          // Without looping, clamp to 0-1
          progress = Math.max(0, Math.min(1, progress));
        }
        
        // Map progress to frame index
        const frameIndex = progress * (totalFrames - 1);
        drawFrame(frameIndex);
      });
    }

    // Initial draw based on current scroll position
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isLoaded, scrollDistance, loop, drawFrame]);

  // Handle resize
  useEffect(() => {
    function handleResize() {
      // Trigger a redraw on resize
      if (isLoaded && framesRef.current.length > 0) {
        drawFrame(lastFrameIndexRef.current);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isLoaded, drawFrame]);

  return (
    <div 
      ref={containerRef} 
      className={`${className}`}
      style={{
        clipPath: cropBottom > 0 ? `inset(0 0 ${cropBottom}px 0)` : undefined,
      }}
    >
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="absolute"
        style={{
          opacity: isLoaded ? 1 : 0,
          transition: "opacity 0.3s ease-in-out",
          transform: `scale(${coverScale * scale})`,
          transformOrigin: "center center",
          top: "50%",
          left: "50%",
          translate: "-50% -50%",
        }}
      />
      {overlay}
    </div>
  );
}
