import { useCallback, useEffect, useRef, useState } from "react";
import { getEffectiveGain } from "../utils/audio";

export function useStemPlayer(channels, playbackRate = 1) {
  const ctxRef = useRef(null);
  const buffersRef = useRef(new Map());
  const sourcesRef = useRef(new Map());
  const gainsRef = useRef(new Map());
  const offsetRef = useRef(0);
  const startCtxTimeRef = useRef(0);
  const playingRef = useRef(false);
  const loopRef = useRef(null);
  const channelsRef = useRef(channels);
  const rateRef = useRef(playbackRate);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  channelsRef.current = channels;
  rateRef.current = playbackRate;

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const stopSources = useCallback(() => {
    sourcesRef.current.forEach((src) => {
      try { src.stop(); } catch { /* already stopped */ }
    });
    sourcesRef.current.clear();
    gainsRef.current.clear();
  }, []);

  const loadBuffers = useCallback(async () => {
    setLoaded(false);
    setLoadError(null);
    buffersRef.current.clear();
    const ctx = getCtx();
    let maxDur = 0;
    let loadedAny = false;

    for (const ch of channels) {
      if (!ch.url) continue;
      try {
        const res = await fetch(ch.url);
        if (!res.ok) continue;
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        buffersRef.current.set(ch.name, buf);
        maxDur = Math.max(maxDur, buf.duration);
        loadedAny = true;
      } catch {
        /* skip missing stem */
      }
    }

    if (!loadedAny) {
      setLoadError("Could not load audio stems");
    }
    setDuration(maxDur);
    setLoaded(loadedAny);
  }, [channels, getCtx]);

  useEffect(() => {
    loadBuffers();
  }, [loadBuffers]);

  const startSources = useCallback((fromTime) => {
    const ctx = getCtx();
    stopSources();
    if (ctx.state === "suspended") ctx.resume();

    const chs = channelsRef.current;
    chs.forEach((ch) => {
      const buffer = buffersRef.current.get(ch.name);
      if (!buffer) return;
      const gain = getEffectiveGain(ch, chs);
      if (gain <= 0) return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rateRef.current;

      const gainNode = ctx.createGain();
      gainNode.gain.value = gain;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      const offset = Math.min(fromTime, buffer.duration);
      source.start(0, offset);
      sourcesRef.current.set(ch.name, source);
      gainsRef.current.set(ch.name, gainNode);
    });

    startCtxTimeRef.current = ctx.currentTime;
    playingRef.current = true;
    setIsPlaying(true);
  }, [getCtx, stopSources]);

  const play = useCallback((fromTime) => {
    if (fromTime !== undefined) offsetRef.current = fromTime;
    startSources(offsetRef.current);
  }, [startSources]);

  const pause = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !playingRef.current) return;
    offsetRef.current += (ctx.currentTime - startCtxTimeRef.current) * rateRef.current;
    stopSources();
    playingRef.current = false;
    setIsPlaying(false);
    setCurrentTime(offsetRef.current);
  }, [stopSources]);

  const seek = useCallback((time) => {
    offsetRef.current = Math.max(0, Math.min(time, duration));
    if (playingRef.current) {
      startSources(offsetRef.current);
    } else {
      setCurrentTime(offsetRef.current);
    }
  }, [duration, startSources]);

  const togglePlay = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  const setLoop = useCallback((range) => {
    loopRef.current = range;
  }, []);

  useEffect(() => {
    gainsRef.current.forEach((node, name) => {
      const ch = channels.find((c) => c.name === name);
      if (ch) node.gain.value = getEffectiveGain(ch, channels);
    });
  }, [channels]);

  useEffect(() => {
    if (playingRef.current) {
      const t = offsetRef.current;
      startSources(t);
    }
  }, [playbackRate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let raf;
    const tick = () => {
      const ctx = ctxRef.current;
      if (playingRef.current && ctx) {
        let t = offsetRef.current + (ctx.currentTime - startCtxTimeRef.current) * rateRef.current;
        const loop = loopRef.current;
        if (loop && t >= loop.end) {
          seek(loop.start);
          t = loop.start;
        } else if (t >= duration) {
          stopSources();
          playingRef.current = false;
          setIsPlaying(false);
          offsetRef.current = 0;
          setCurrentTime(0);
        } else {
          setCurrentTime(t);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, seek, stopSources]);

  useEffect(() => () => {
    stopSources();
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      ctxRef.current.close();
    }
  }, [stopSources]);

  return {
    currentTime,
    duration,
    isPlaying,
    loaded,
    loadError,
    play,
    pause,
    seek,
    togglePlay,
    setLoop,
  };
}
