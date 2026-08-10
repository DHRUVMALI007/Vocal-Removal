"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StemChannelState } from "@/lib/types";

interface UseStemMixerOptions {
  channels: StemChannelState[];
  playbackRate?: number;
}

export function useStemMixer({ channels, playbackRate = 1 }: UseStemMixerOptions) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const gainsRef = useRef<Map<string, GainNode>>(new Map());
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const playingRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const animRef = useRef<number>(0);
  const channelsRef = useRef(channels);
  channelsRef.current = channels;

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const loadBuffers = useCallback(async () => {
    const ctx = getCtx();
    let maxDuration = 0;
    for (const ch of channels) {
      if (!ch.url) continue;
      try {
        const res = await fetch(ch.url);
        const arr = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(arr);
        buffersRef.current.set(ch.name, buf);
        maxDuration = Math.max(maxDuration, buf.duration);
      } catch {
        /* skip unavailable stems */
      }
    }
    setDuration(maxDuration);
    setLoaded(true);
  }, [channels, getCtx]);

  useEffect(() => {
    buffersRef.current.clear();
    setLoaded(false);
    loadBuffers();
  }, [loadBuffers]);

  const stopSources = useCallback(() => {
    sourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    });
    sourcesRef.current.clear();
  }, []);

  const getEffectiveGain = useCallback(
    (ch: StemChannelState, allChannels: StemChannelState[]) => {
      const anySolo = allChannels.some((c) => c.solo);
      if (anySolo && !ch.solo) return 0;
      if (ch.muted) return 0;
      return ch.volume;
    },
    [],
  );

  const play = useCallback(
    (fromTime?: number) => {
      const ctx = getCtx();
      stopSources();
      if (fromTime !== undefined) offsetRef.current = fromTime;

      const chs = channelsRef.current;
      const anySolo = chs.some((c) => c.solo);

      chs.forEach((ch) => {
        const buf = buffersRef.current.get(ch.name);
        if (!buf) return;
        const gain = getEffectiveGain(ch, chs);
        if (gain <= 0) return;

        const source = ctx.createBufferSource();
        source.buffer = buf;
        source.playbackRate.value = playbackRate;

        const gainNode = ctx.createGain();
        gainNode.gain.value = gain;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(0, offsetRef.current);
        sourcesRef.current.set(ch.name, source);
        gainsRef.current.set(ch.name, gainNode);
      });

      startTimeRef.current = ctx.currentTime;
      playingRef.current = true;
      setIsPlaying(true);
    },
    [getCtx, stopSources, getEffectiveGain, playbackRate],
  );

  const pause = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !playingRef.current) return;
    offsetRef.current += (ctx.currentTime - startTimeRef.current) * playbackRate;
    stopSources();
    playingRef.current = false;
    setIsPlaying(false);
    setCurrentTime(offsetRef.current);
  }, [stopSources, playbackRate]);

  const seek = useCallback(
    (time: number) => {
      offsetRef.current = Math.max(0, Math.min(time, duration));
      if (playingRef.current) {
        play(offsetRef.current);
      } else {
        setCurrentTime(offsetRef.current);
      }
    },
    [duration, play],
  );

  useEffect(() => {
    const tick = () => {
      const ctx = ctxRef.current;
      if (playingRef.current && ctx) {
        const t = offsetRef.current + (ctx.currentTime - startTimeRef.current) * playbackRate;
        setCurrentTime(Math.min(t, duration));
        if (t >= duration) {
          playingRef.current = false;
          setIsPlaying(false);
          offsetRef.current = 0;
          setCurrentTime(0);
          stopSources();
        }
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [duration, playbackRate, stopSources]);

  useEffect(() => {
    gainsRef.current.forEach((gainNode, name) => {
      const ch = channels.find((c) => c.name === name);
      if (ch) gainNode.gain.value = getEffectiveGain(ch, channels);
    });
  }, [channels, getEffectiveGain]);

  useEffect(() => {
    if (playingRef.current) {
      const wasPlaying = true;
      const t = offsetRef.current;
      stopSources();
      playingRef.current = false;
      if (wasPlaying) play(t);
    }
  }, [playbackRate]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    currentTime,
    duration,
    isPlaying,
    loaded,
    play,
    pause,
    seek,
    togglePlay: () => (isPlaying ? pause() : play()),
  };
}
