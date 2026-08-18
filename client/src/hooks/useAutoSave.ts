import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
  value: string;
  storageKey: string;
  delay?: number;
  onLoad?: (savedValue: string) => void;
  onSave?: (value: string) => Promise<void> | void;
}

interface UseAutoSaveResult {
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed';
  lastSaved: Date | null;
  forceSave: () => void;
  clearDraft: () => void;
}

export function useAutoSave({
  value,
  storageKey,
  delay = 30000,
  onLoad,
  onSave,
}: UseAutoSaveOptions): UseAutoSaveResult {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastValueRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null && onLoad) {
        onLoad(saved);
      }
    } catch (error) {
      // ignore
    }
  }, [storageKey, onLoad]);

  const doSave = useCallback(async () => {
    const currentValue = lastValueRef.current;
    try {
      localStorage.setItem(storageKey, currentValue);
      if (onSave) {
        await onSave(currentValue);
      }
      setLastSaved(new Date());
      setSaveStatus('saved');

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      setSaveStatus('failed');
    }
  }, [storageKey, onSave]);

  useEffect(() => {
    lastValueRef.current = value;
  }, [value]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const hasChanges = lastValueRef.current !== localStorage.getItem(storageKey);
      if (hasChanges && lastValueRef.current) {
        setSaveStatus('saving');
        doSave();
      }
    }, delay);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [delay, doSave, storageKey]);

  const forceSave = useCallback(() => {
    setSaveStatus('saving');
    doSave();
  }, [doSave]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      lastValueRef.current = '';
    } catch (error) {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (lastValueRef.current !== localStorage.getItem(storageKey) && lastValueRef.current) {
        try {
          localStorage.setItem(storageKey, lastValueRef.current);
        } catch (error) {
          // ignore
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [storageKey]);

  return { saveStatus, lastSaved, forceSave, clearDraft };
}
