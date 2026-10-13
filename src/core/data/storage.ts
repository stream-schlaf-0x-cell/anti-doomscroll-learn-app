import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Robust key-value storage wrapper with in-memory fallback.
 * Guarantees zero crashing even if AsyncStorage native module is mock-bound.
 */
class LocalStorage {
  private memoryCache: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    try {
      const val = await AsyncStorage.getItem(key);
      if (val !== null) {
        this.memoryCache.set(key, val);
        return val;
      }
    } catch {
      // fallback to memory cache
    }
    return this.memoryCache.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.memoryCache.set(key, value);
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // memory cache already updated
    }
  }

  async removeItem(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // memory cache already updated
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      await AsyncStorage.clear();
    } catch {
      // memory cache cleared
    }
  }
}

export const appStorage = new LocalStorage();
