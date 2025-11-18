import logger from '../utils/logger';

/**
 * Simple in-memory lock service to prevent concurrent processing of the same event.
 * This prevents race conditions when multiple polling requests try to process the same event.
 */
export class EventProcessingLock {
  private static processingEvents = new Set<string>();
  private static lockResolvers = new Map<string, () => void>();

  /**
   * Attempts to acquire a lock for processing an event.
   * Returns true if lock was acquired, false if event is already being processed.
   */
  static acquireLock(eventId: string): boolean {
    if (this.processingEvents.has(eventId)) {
      logger.debug('Event is already being processed, skipping', { eventId });
      return false;
    }

    // Create a resolver that will be called when the lock is released
    let resolveLock: (() => void) | undefined;
    new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    if (!resolveLock) {
      // This should never happen, but TypeScript needs this check
      return false;
    }

    this.processingEvents.add(eventId);
    this.lockResolvers.set(eventId, resolveLock);

    logger.debug('Lock acquired for event processing', { eventId });
    return true;
  }

  /**
   * Releases the lock for an event.
   */
  static releaseLock(eventId: string): void {
    if (this.processingEvents.has(eventId)) {
      this.processingEvents.delete(eventId);
      const resolver = this.lockResolvers.get(eventId);
      if (resolver) {
        this.lockResolvers.delete(eventId);
        // Resolve the promise to notify any waiting operations
        resolver();
      }
      logger.debug('Lock released for event processing', { eventId });
    }
  }

  /**
   * Waits for a lock to be released (useful for waiting if lock acquisition failed).
   */
  static async waitForLock(eventId: string, timeout: number = 30000): Promise<boolean> {
    if (!this.processingEvents.has(eventId)) {
      return true; // No lock exists, can proceed
    }

    // Create a promise that resolves when the lock is released
    const waitPromise = new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.processingEvents.has(eventId)) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });

    try {
      await Promise.race([
        waitPromise,
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Lock wait timeout')), timeout)
        )
      ]);
      return true;
    } catch (error) {
      logger.warn('Timeout waiting for event lock', { eventId, timeout });
      return false;
    }
  }

  /**
   * Checks if an event is currently being processed.
   */
  static isProcessing(eventId: string): boolean {
    return this.processingEvents.has(eventId);
  }
}

