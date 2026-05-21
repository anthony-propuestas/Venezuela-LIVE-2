// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const STORAGE_KEY = 'venlive_session_v1';

describe('session — sin persistencia', () => {
  let setSession, getSession, clearSession;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    const mod = await import('./session.js');
    ({ setSession, getSession, clearSession } = mod);
  });

  afterEach(() => localStorage.clear());

  it('setSession + getSession devuelve la sesión en memoria', () => {
    setSession({ credential: 'tok-abc' });
    expect(getSession()?.credential).toBe('tok-abc');
  });

  it('getSession devuelve null cuando la sesión expiró', () => {
    setSession({ credential: 'tok-exp', expiresAt: Date.now() - 1000 });
    expect(getSession()).toBeNull();
  });

  it('clearSession limpia la sesión en memoria', () => {
    setSession({ credential: 'tok-abc' });
    clearSession();
    expect(getSession()).toBeNull();
  });

  it('setSession no escribe en localStorage sin persistencia', () => {
    setSession({ credential: 'tok-abc' });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('session — con persistencia (VITE_PERSIST_SESSIONS=true)', () => {
  let setSession, getSession, clearPersistentSession;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('VITE_PERSIST_SESSIONS', 'true');
    localStorage.clear();
    const mod = await import('./session.js');
    ({ setSession, getSession, clearPersistentSession } = mod);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it('setSession guarda en localStorage', () => {
    setSession({ credential: 'tok-123' });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw).credential).toBe('tok-123');
  });

  it('setSession(null) elimina la entrada de localStorage', () => {
    setSession({ credential: 'tok-123' });
    setSession(null);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('getSession recarga desde localStorage cuando la memoria está vacía', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ credential: 'tok-stored', expiresAt: Date.now() + 60000 }));
    expect(getSession()?.credential).toBe('tok-stored');
  });

  it('getSession elimina entrada expirada de localStorage y devuelve null', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ credential: 'tok-exp', expiresAt: Date.now() - 1000 }));
    expect(getSession()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clearPersistentSession elimina de localStorage sin tocar la memoria', () => {
    setSession({ credential: 'tok-123' });
    clearPersistentSession();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(getSession()?.credential).toBe('tok-123');
  });
});
