import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage driver interface for local key-value persistence.
 * Allows injecting AsyncStorage in production and MemoryStorageDriver in tests.
 */
export interface IStorageDriver {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys?(): Promise<readonly string[]>;
}

/**
 * Controlled errors for typed persistence failure reporting.
 */
export class StorageUnavailableError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

export class StorageWriteError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StorageWriteError';
  }
}

export class CorruptedDataError extends Error {
  constructor(message: string, public readonly raw: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CorruptedDataError';
  }
}

/**
 * Default production driver backed by React Native AsyncStorage.
 */
export class AsyncStorageDriver implements IStorageDriver {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (err) {
      throw new StorageUnavailableError(`Speicherzugriff fehlgeschlagen für Schlüssel "${key}".`, err);
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (err) {
      throw new StorageWriteError(`Speichern fehlgeschlagen für Schlüssel "${key}".`, err);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (err) {
      throw new StorageWriteError(`Löschen fehlgeschlagen für Schlüssel "${key}".`, err);
    }
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (err) {
      throw new StorageWriteError('Speicher zurücksetzen fehlgeschlagen.', err);
    }
  }

  async getAllKeys(): Promise<readonly string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (err) {
      throw new StorageUnavailableError('Schlüsselliste konnte nicht abgerufen werden.', err);
    }
  }
}

/**
 * In-memory storage driver for deterministic unit and regression testing.
 * Supports simulating latency and transient or permanent write failures.
 */
export class MemoryStorageDriver implements IStorageDriver {
  private store: Map<string, string> = new Map();
  public delayMs: number = 0;
  public shouldFailReads: boolean = false;
  public shouldFailWrites: boolean = false;

  private async maybeDelay(): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }
  }

  async getItem(key: string): Promise<string | null> {
    await this.maybeDelay();
    if (this.shouldFailReads) {
      throw new StorageUnavailableError(`Simulierter Lesefehler für "${key}".`);
    }
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.maybeDelay();
    if (this.shouldFailWrites) {
      throw new StorageWriteError(`Simulierter Schreibfehler für "${key}".`);
    }
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await this.maybeDelay();
    if (this.shouldFailWrites) {
      throw new StorageWriteError(`Simulierter Löschfehler für "${key}".`);
    }
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    await this.maybeDelay();
    this.store.clear();
  }

  async getAllKeys(): Promise<readonly string[]> {
    await this.maybeDelay();
    return Array.from(this.store.keys());
  }

  dump(): Record<string, string> {
    return Object.fromEntries(this.store.entries());
  }
}

/**
 * Key-level serialization queue.
 * Ensures strict sequential execution per key to eliminate read-modify-write races.
 * Does NOT retain idle queue entries.
 * Releases locks reliably even on rejected operations so subsequent tasks proceed.
 */
export class KeyLockManager {
  private locks: Map<string, Promise<void>> = new Map();

  async acquire<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previousPromise = this.locks.get(key) ?? Promise.resolve();

    let release: () => void;
    const currentPromise = new Promise<void>(resolve => {
      release = resolve;
    });

    const tail = previousPromise.then(() => currentPromise);
    this.locks.set(key, tail);

    tail.finally(() => {
      if (this.locks.get(key) === tail) {
        this.locks.delete(key);
      }
    });

    try {
      // Settle previous promise without propagating its error to this task
      await previousPromise.catch(() => {});
      return await task();
    } finally {
      release!();
    }
  }

  isKeyLocked(key: string): boolean {
    return this.locks.has(key);
  }

  getActiveKeyCount(): number {
    return this.locks.size;
  }
}

/**
 * Transaction scope passed into runTransaction callbacks.
 * Operates directly on the underlying driver without acquiring another lock,
 * completely preventing self-deadlock.
 */
export interface TransactionScope {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  remove(): Promise<void>;
}

function createDefaultDriver(): IStorageDriver {
  // If running in Node.js (test runner or CLI daemon) without browser window, use MemoryStorageDriver
  if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node != null) {
    return new MemoryStorageDriver();
  }
  return new AsyncStorageDriver();
}

/**
 * Core AtemStorage manager.
 * Guarantees atomic serialization per key without inner re-locking.
 */
export class AtemStorage {
  private lockManager: KeyLockManager = new KeyLockManager();

  constructor(public readonly driver: IStorageDriver = createDefaultDriver()) {}

  /**
   * Reads raw string value directly from driver.
   */
  async getItem(key: string): Promise<string | null> {
    return this.driver.getItem(key);
  }

  /**
   * Standalone write: acquires lock once and writes to driver.
   */
  async setItem(key: string, value: string): Promise<void> {
    return this.lockManager.acquire(key, async () => {
      await this.driver.setItem(key, value);
    });
  }

  /**
   * Standalone remove: acquires lock once and removes from driver.
   */
  async removeItem(key: string): Promise<void> {
    return this.lockManager.acquire(key, async () => {
      await this.driver.removeItem(key);
    });
  }

  /**
   * Clears entire storage driver.
   */
  async clear(): Promise<void> {
    return this.driver.clear();
  }

  /**
   * Lists all keys from driver if supported.
   */
  async getAllKeys(): Promise<readonly string[]> {
    if (this.driver.getAllKeys) {
      return this.driver.getAllKeys();
    }
    return [];
  }

  /**
   * Deletes all Atem-owned keys starting with '@atem:'.
   * Leaves any other app/system keys untouched.
   */
  async clearAtemKeys(): Promise<string[]> {
    const keys = await this.getAllKeys();
    const atemKeys = keys.filter(k => k.startsWith('@atem:'));
    for (const key of atemKeys) {
      await this.removeItem(key);
    }
    return atemKeys;
  }

  /**
   * Executes an atomic read-modify-write transaction on a specific key.
   * Acquires the lock EXACTLY ONCE for the key.
   * Inside the task, `tx.get()`, `tx.set()`, and `tx.remove()` access the driver directly,
   * making deadlocks structurally impossible.
   */
  async runTransaction<T>(key: string, task: (tx: TransactionScope) => Promise<T>): Promise<T> {
    return this.lockManager.acquire(key, async () => {
      const scope: TransactionScope = {
        get: () => this.driver.getItem(key),
        set: (value: string) => this.driver.setItem(key, value),
        remove: () => this.driver.removeItem(key)
      };
      return await task(scope);
    });
  }

  getLockManager(): KeyLockManager {
    return this.lockManager;
  }
}

export const appStorage = new AtemStorage();
