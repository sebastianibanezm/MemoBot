/**
 * Performance timing utilities for identifying bottlenecks.
 */

export interface TimingResult<T> {
  result: T;
  durationMs: number;
}

/**
 * Wrap an async function with timing measurement.
 * Logs the duration to console in development.
 */
export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>
): Promise<TimingResult<T>> {
  const start = performance.now();

  try {
    const result = await fn();
    const durationMs = performance.now() - start;

    if (process.env.NODE_ENV === "development") {
      console.log(`[timing] ${label}: ${durationMs.toFixed(2)}ms`);
    }

    return { result, durationMs };
  } catch (error) {
    const durationMs = performance.now() - start;
    console.error(`[timing] ${label} FAILED after ${durationMs.toFixed(2)}ms:`, error);
    throw error;
  }
}

/**
 * Simple timing decorator for measuring function duration.
 * Returns only the result (for drop-in replacement).
 */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const { result } = await withTiming(label, fn);
  return result;
}

/**
 * Aggregate timing collector for profiling a request.
 */
export class RequestProfiler {
  private timings: Map<string, number[]> = new Map();
  private startTime: number;

  constructor() {
    this.startTime = performance.now();
  }

  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const { result, durationMs } = await withTiming(label, fn);

    const existing = this.timings.get(label) ?? [];
    existing.push(durationMs);
    this.timings.set(label, existing);

    return result;
  }

  getSummary(): Record<string, { count: number; totalMs: number; avgMs: number }> {
    const summary: Record<string, { count: number; totalMs: number; avgMs: number }> = {};

    for (const [label, durations] of this.timings) {
      const totalMs = durations.reduce((a, b) => a + b, 0);
      summary[label] = {
        count: durations.length,
        totalMs: Math.round(totalMs * 100) / 100,
        avgMs: Math.round((totalMs / durations.length) * 100) / 100,
      };
    }

    return summary;
  }

  getTotalDuration(): number {
    return performance.now() - this.startTime;
  }

  log(): void {
    console.log("[profiler] Request summary:", {
      totalMs: this.getTotalDuration().toFixed(2),
      breakdown: this.getSummary(),
    });
  }
}
