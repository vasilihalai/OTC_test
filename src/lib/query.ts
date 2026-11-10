import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * What the screens read through. A screen that was open before shows what it showed last and
 * refreshes underneath, instead of starting from a skeleton every time; two screens asking for the
 * same thing share one request; an answer that comes back after a newer one is dropped.
 *
 * Everything lives in memory for the session: a reload starts clean, and signing out clears it.
 */

export interface QueryState<T> {
  data: T | undefined;
  /** The last read failed. A screen that still has `data` keeps showing it. */
  error: unknown;
}

interface Entry {
  state: QueryState<unknown>;
  /** When `state.data` was read; 0 while there is none. */
  updatedAt: number;
  /** Something changed on the server side: read again on the next visit, whatever the age. */
  stale: boolean;
  /** The read in flight, if any, and how to start another. */
  promise: Promise<unknown> | undefined;
  fetcher: (() => Promise<unknown>) | undefined;
  /** Reads are numbered as they start; an answer older than what is already shown is dropped. */
  started: number;
  shown: number;
  listeners: Set<() => void>;
}

const EMPTY: QueryState<never> = { data: undefined, error: undefined };

const entries = new Map<string, Entry>();

function entryOf(key: string): Entry {
  let entry = entries.get(key);
  if (!entry) {
    entry = { state: EMPTY, updatedAt: 0, stale: false, promise: undefined, fetcher: undefined, started: 0, shown: 0, listeners: new Set() };
    entries.set(key, entry);
  }
  return entry;
}

function publish(entry: Entry, state: QueryState<unknown>): void {
  if (state.data === entry.state.data && state.error === entry.state.error) {
    return;
  }
  entry.state = state;
  entry.listeners.forEach((listener) => listener());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Keeps every part of the previous value that the new one repeats. A refresh that brings nothing new
 * then hands back the very same object, and nothing on screen re-renders; one changed row re-renders
 * one row.
 */
function share<T>(previous: unknown, next: T): T {
  if (previous === next) {
    return next;
  }
  if (Array.isArray(previous) && Array.isArray(next)) {
    let same = previous.length === next.length;
    const merged = next.map((item, index) => {
      const shared = share(previous[index], item as unknown);
      same &&= shared === previous[index];
      return shared;
    });
    return (same ? previous : merged) as T;
  }
  if (isPlainObject(previous) && isPlainObject(next)) {
    const keys = Object.keys(next);
    let same = Object.keys(previous).length === keys.length;
    const merged: Record<string, unknown> = {};
    for (const key of keys) {
      merged[key] = share(previous[key], next[key]);
      same &&= merged[key] === previous[key] && key in previous;
    }
    return (same ? previous : merged) as T;
  }
  return next;
}

/**
 * Reads `key` and puts the answer in the cache. A read already in flight is shared unless `force` asks
 * for a new one (a refresh after something changed must not settle for an answer requested before it).
 * Rejects with the fetcher's error; the cache keeps what it had.
 */
export function fetchQuery<T>(key: string, fetcher: () => Promise<T>, force = false): Promise<T> {
  const entry = entryOf(key);
  entry.fetcher = fetcher;
  if (entry.promise && !force) {
    return entry.promise as Promise<T>;
  }
  entry.started += 1;
  const mine = entry.started;
  // A retry: the error gives way to the skeleton while the new read runs.
  publish(entry, { data: entry.state.data, error: undefined });

  let run: Promise<T>;
  try {
    run = fetcher();
  } catch (err) {
    run = Promise.reject(err instanceof Error ? err : new Error(String(err)));
  }
  const promise = run.then((data) => {
    if (mine > entry.shown) {
      entry.shown = mine;
      entry.updatedAt = Date.now();
      entry.stale = false;
      publish(entry, { data: share(entry.state.data, data), error: undefined });
    }
    return data;
  }, (error: unknown) => {
    // One place for every failed read, with the name of what was being read.
    console.error(`[query] ${key} failed`, error);
    if (mine === entry.started) {
      publish(entry, { data: entry.state.data, error: error ?? new Error('Query failed') });
    }
    throw error;
  });
  entry.promise = promise;
  const settle = () => {
    if (entry.promise === promise) {
      entry.promise = undefined;
    }
  };
  promise.then(settle, settle);
  return promise;
}

const ignore = () => undefined;

/** Starts a read nobody waits for, so the screen that will need it finds it done or under way. */
export function prefetchQuery<T>(key: string, fetcher: () => Promise<T>): void {
  const entry = entryOf(key);
  if (entry.state.data === undefined || entry.stale) {
    fetchQuery(key, fetcher).catch(ignore);
  }
}

export function getQueryData<T>(key: string): T | undefined {
  return entries.get(key)?.state.data as T | undefined;
}

type Updater<T> = T | ((current: T | undefined) => T | undefined);

function resolve<T>(entry: Entry, value: Updater<T>): T | undefined {
  return typeof value === 'function' ? (value as (current: T | undefined) => T | undefined)(entry.state.data as T | undefined) : value;
}

/**
 * Puts a value known to be newer than anything requested so far — the result of an action, say. Reads
 * still in flight were asked before it and are dropped when they answer.
 */
export function setQueryData<T>(key: string, value: Updater<T>): void {
  const entry = entryOf(key);
  const next = resolve(entry, value);
  if (next === undefined) {
    return;
  }
  entry.started += 1;
  entry.shown = entry.started;
  entry.updatedAt = Date.now();
  publish(entry, { data: share(entry.state.data, next), error: undefined });
}

/**
 * Corrects what is cached from something learnt elsewhere (a deal's card says its status changed, so
 * its row in the list is updated). Unlike `setQueryData` it doesn't outrank a read in flight: that
 * answer is the whole truth and replaces the correction.
 */
export function patchQueryData<T>(key: string, update: (current: T) => T): void {
  const entry = entries.get(key);
  if (!entry || entry.state.data === undefined) {
    return;
  }
  publish(entry, { data: share(entry.state.data, update(entry.state.data as T)), error: entry.state.error });
}

/**
 * The server-side state behind `key` changed. Screens showing it re-read now; the others re-read when
 * they open, and show what they have meanwhile.
 */
export function invalidateQuery(key: string): void {
  const entry = entries.get(key);
  if (!entry) {
    return;
  }
  entry.stale = true;
  if (entry.listeners.size > 0 && entry.fetcher) {
    fetchQuery(key, entry.fetcher, true).catch(ignore);
  }
}

/** Signing out: nothing of one account may show up under another. Reads in flight are dropped too. */
export function clearQueries(): void {
  for (const entry of entries.values()) {
    entry.started += 1;
    entry.shown = entry.started;
    entry.updatedAt = 0;
    entry.stale = false;
    entry.promise = undefined;
    publish(entry, EMPTY);
  }
}

export interface QueryOptions {
  /** Cached data older than this is not shown when the screen opens: a skeleton, then a fresh read. */
  maxAge?: number;
  /** Cached data younger than this is not re-read when the screen opens. */
  staleTime?: number;
}

export interface QueryResult<T> {
  data: T | undefined;
  /** The read failed and there is nothing to show. */
  failed: boolean;
  /** Nothing to show yet, and no failure either: the skeleton state. */
  loading: boolean;
  /** Reads again now. Never rejects: a failure shows through `failed`, or is retried by the next refresh. */
  refetch: () => Promise<void>;
}

const DEFAULT_MAX_AGE = 5 * 60_000;

/** A `key` of `undefined` switches the hook off: nothing is read and nothing returned. */
export function useQuery<T>(key: string | undefined, fetcher: () => Promise<T>, options: QueryOptions = {}): QueryResult<T> {
  const { maxAge = DEFAULT_MAX_AGE, staleTime = 0 } = options;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // Decided before the first paint with this key, so nothing too old flashes on screen.
  const opened = useRef<string>();
  if (key !== undefined && opened.current !== key) {
    opened.current = key;
    const entry = entries.get(key);
    if (entry && entry.state.data !== undefined && Date.now() - entry.updatedAt > maxAge) {
      entry.state = EMPTY;
      entry.updatedAt = 0;
    }
  }

  const subscribe = useCallback((listener: () => void) => {
    if (key === undefined) {
      return ignore;
    }
    const { listeners } = entryOf(key);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [key]);
  const state = useSyncExternalStore(subscribe, () => (key === undefined ? EMPTY : entryOf(key).state)) as QueryState<T>;

  useEffect(() => {
    if (key === undefined) {
      return;
    }
    const entry = entryOf(key);
    const fresh = entry.state.data !== undefined && !entry.stale && Date.now() - entry.updatedAt < staleTime;
    if (!fresh) {
      fetchQuery(key, () => fetcherRef.current()).catch(ignore);
    }
  }, [key, staleTime]);

  const refetch = useCallback(async () => {
    if (key !== undefined) {
      await fetchQuery(key, () => fetcherRef.current(), true).catch(ignore);
    }
  }, [key]);

  const failed = state.data === undefined && state.error !== undefined;
  return {
    data: state.data,
    failed,
    loading: state.data === undefined && !failed && key !== undefined,
    refetch,
  };
}
