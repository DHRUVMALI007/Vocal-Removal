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
  const rateRef = useRef(playbackRate);
  const channelsRef = useRef(channels);
  const animRef = useRef<number>(0);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  channelsRef.current = channels;
  const channelUrlKey = channels.map((channel) => `${channel.name}:${channel.url}`).join("|");

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const getEffectiveGain = useCallback((channel: StemChannelState, allChannels: StemChannelState[]) => {
    const anySolo = allChannels.some((item) => item.solo);
    if (anySolo && !channel.solo) return 0;
    if (channel.muted) return 0;
    return channel.volume;
  }, []);

  const stopSources = useCallback(() => {
    sourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
    });
    sourcesRef.current.clear();
    gainsRef.current.clear();
  }, []);

  const loadBuffers = useCallback(async () => {
    const context = getCtx();
    let maxDuration = 0;
    let loadedCount = 0;
    buffersRef.current.clear();
    setLoaded(false);
    setLoadError(null);

    for (const channel of channelsRef.current) {
      if (!channel.url) continue;
      try {
        const response = await fetch(channel.url);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(arrayBuffer);
        buffersRef.current.set(channel.name, buffer);
        maxDuration = Math.max(maxDuration, buffer.duration);
        loadedCount += 1;
      } catch {
        // Keep loading other stems if one output is unavailable.
      }
    }

    setDuration(maxDuration);
    setLoaded(loadedCount > 0);
    if (loadedCount === 0 && channelsRef.current.length > 0) {
      setLoadError("Audio stems could not be loaded. Check that the backend files are still available.");
    }
  }, [channelUrlKey, getCtx]);

  useEffect(() => {
    void loadBuffers();
  }, [loadBuffers]);

  const startSources = useCallback(
    (fromTime: number) => {
      const context = getCtx();
      stopSources();
      if (context.state === "suspended") void context.resume();

      const activeChannels = channelsRef.current;
      activeChannels.forEach((channel) => {
        const buffer = buffersRef.current.get(channel.name);
        if (!buffer || buffer.duration <= 0) return;

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rateRef.current;

        const gainNode = context.createGain();
        gainNode.gain.value = getEffectiveGain(channel, activeChannels);
        source.connect(gainNode);
        gainNode.connect(context.destination);

        // Keep every stem running, even when muted. This allows mute/solo changes
        // to become audible immediately without restarting playback.
        const safeOffset = Math.max(0, Math.min(fromTime, Math.max(0, buffer.duration - 0.001)));
        source.start(0, safeOffset);
        sourcesRef.current.set(channel.name, source);
        gainsRef.current.set(channel.name, gainNode);
      });

      startTimeRef.current = context.currentTime;
      offsetRef.current = fromTime;
      playingRef.current = sourcesRef.current.size > 0;
      setIsPlaying(playingRef.current);
    },
    [getCtx, getEffectiveGain, stopSources],
  );

  const play = useCallback(
    (fromTime?: number) => {
      if (!loaded) return;
      const nextOffset = fromTime ?? offsetRef.current;
      startSources(Math.max(0, Math.min(nextOffset, duration || nextOffset)));
    },
    [duration, loaded, startSources],
  );

  const pause = useCallback(() => {
    const context = ctxRef.current;
    if (!context || !playingRef.current) return;
    const elapsed = (context.currentTime - startTimeRef.current) * rateRef.current;
    offsetRef.current = Math.min(offsetRef.current + elapsed, duration);
    stopSources();
    playingRef.current = false;
    setIsPlaying(false);
    setCurrentTime(offsetRef.current);
  }, [duration, stopSources]);

  const seek = useCallback(
    (time: number) => {
      const nextTime = Math.max(0, Math.min(time, duration));
      offsetRef.current = nextTime;
      setCurrentTime(nextTime);
      if (playingRef.current) startSources(nextTime);
    },
    [duration, startSources],
  );

  const togglePlay = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  useEffect(() => {
    gainsRef.current.forEach((gainNode, name) => {
      const channel = channels.find((item) => item.name === name);
      if (channel) gainNode.gain.value = getEffectiveGain(channel, channels);
    });
  }, [channels, getEffectiveGain]);

  useEffect(() => {
    const previousRate = rateRef.current;
    if (previousRate === playbackRate) return;

    const context = ctxRef.current;
    let resumeAt = offsetRef.current;
    if (playingRef.current && context) {
      resumeAt = Math.min(
        offsetRef.current + (context.currentTime - startTimeRef.current) * previousRate,
        duration,
      );
      stopSources();
      playingRef.current = false;
    }

    rateRef.current = playbackRate;
    offsetRef.current = resumeAt;
    setCurrentTime(resumeAt);
    if (isPlaying) startSources(resumeAt);
  }, [duration, isPlaying, playbackRate, startSources, stopSources]);

  useEffect(() => {
    const tick = () => {
      const context = ctxRef.current;
      if (playingRef.current && context) {
        const time = offsetRef.current + (context.currentTime - startTimeRef.current) * rateRef.current;
        if (time >= duration && duration > 0) {
          stopSources();
          playingRef.current = false;
          offsetRef.current = 0;
          setIsPlaying(false);
          setCurrentTime(0);
        } else {
          setCurrentTime(Math.min(time, duration || time));
        }
      }
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [duration, stopSources]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      stopSources();
      const context = ctxRef.current;
      if (context && context.state !== "closed") void context.close();
    };
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
  };
}
