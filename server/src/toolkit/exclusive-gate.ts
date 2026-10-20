let running = false;

type Task<T> = () => Promise<T>;

interface QueueItem<T> {
  run: Task<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

const queue: QueueItem<any>[] = [];
const maxQueue = Number(process.env.MOTION_GATE_LIMIT || 20);

class GateOverflowError extends Error {
  code = 429;
  name = 'GateOverflowError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Single-concurrency queue for video creation.
 * Requests are queued FIFO; only one create runs at a time.
 * Query/status endpoints are not gated by this utility.
 */
export function runExclusively<T>(fn: Task<T>): Promise<T> {
  // Fast path: run immediately when idle and queue empty
  if (!running && queue.length === 0) {
    running = true;
    return fn()
      .finally(() => {
        running = false;
        pump();
      });
  }
  // Backpressure: reject when queue exceeds cap
  if (queue.length >= maxQueue) {
    return Promise.reject(new GateOverflowError('Queue full'));
  }
  return new Promise<T>((resolve, reject) => {
    queue.push({ run: fn, resolve, reject });
    pump();
  });
}

function pump() {
  if (running) return;
  const next = queue.shift();
  if (!next) return;
  running = true;
  next.run()
    .then((res) => next.resolve(res))
    .catch((err) => next.reject(err))
    .finally(() => {
      running = false;
      pump();
    });
}

export function getQueueSize(): number {
  return queue.length + (running ? 1 : 0);
}