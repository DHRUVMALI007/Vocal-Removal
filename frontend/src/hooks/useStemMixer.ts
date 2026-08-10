"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StemChannelState } from "@/lib/types";

interface UseStemMixerOptions {
  channels: StemChannelState[];
  playbackRate?: number;
  masterVolume?: number;
}

interface ChannelNodes {
  source: AudioBufferSourceNode;
  low: BiquadFilterNode;
  mid: BiquadFilterNode;
  high: BiquadFilterNode;
  pan: StereoPannerNode;
  gain: GainNode;
}

export function useStemMixer({ channels, playbackRate = 1, masterVolume = 0.9 }: UseStemMixerOptions) {
  const ctxRef = useRef<AudioContext | null>(null);
  const channelNodesRef = useRef<Map<string, ChannelNodes>>(new Map());
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserDataRef = useRef<Uint8Array | null>(null);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const playingRef = useRef(false);
  const rateRef = useRef(playbackRate);
  const channelsRef = useRef(channels);
  const masterVolumeRef = useRef(masterVolume);
  const animRef = useRef<number>(0);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [masterLevel, setMasterLevel] = useState(0);

  channelsRef.current = channels;
  masterVolumeRef.current = masterVolume;
  const channelUrlKey = channels.map((channel) => `${channel.name}:${channel.url}`).join("|");

  const ensureMasterChain = useCallback((context: AudioContext) => {
    if (masterGainRef.current && analyserRef.current) return;
    const masterGain = context.createGain();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;
    masterGain.gain.value = masterVolumeRef.current;
    masterGain.connect(analyser);
    analyser.connect(context.destination);
    masterGainRef.current = masterGain;
    analyserRef.current = analyser;
    analyserDataRef.current = new Uint8Array(analyser.frequencyBinCount);
  }, []);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
      masterGainRef.current = null;
      analyserRef.current = null;
      analyserDataRef.current = null;
    }
    ensureMasterChain(ctxRef.current);
    return ctxRef.current;
  }, [ensureMasterChain]);

  const getEffectiveGain = useCallback((channel: StemChannelState, allChannels: StemChannelState[]) => {
    const anySolo = allChannels.some((item) => item.solo);
    if (anySolo && !channel.solo) return 0;
    if (channel.muted) return 0;
    return channel.volume;
  }, []);

  const stopSources = useCallback(() => {
    channelNodesRef.current.forEach(({ source }) => {
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
    });
    channelNodesRef.current.clear();
  }, []);

  const loadBuffers = useCallback(async () => {
    const context = getCtx();
    const targets = channelsRef.current.filter((channel) => Boolean(channel.url));
    buffersRef.current.clear();
    setLoaded(false);
    setLoadError(null);

    const decoded = await Promise.all(
      targets.map(async (channel) => {
        try {
          const response = await fetch(channel.url);
          if (!response.ok) return null;
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await context.decodeAudioData(arrayBuffer);
          return { name: channel.name, buffer };
        } catch {
          return null;
        }
      }),
    );

    const available = decoded.filter(
      (item): item is { name: string; buffer: AudioBuffer } => item !== null,
    );
    available.forEach(({ name, buffer }) => buffersRef.current.set(name, buffer));

    const maxDuration = available.reduce((max, item) => Math.max(max, item.buffer.duration), 0);
    setDuration(maxDuration);
    setLoaded(available.length > 0);
    if (available.length === 0 && targets.length > 0) {
      setLoadError("Audio stems could not be loaded. Check that the backend files are still available.");
    }
  }, [channelUrlKey, getCtx]);

  useEffect(() => {
    void loadBuffers();
  }, [loadBuffers]);

  const startSources = useCallback(
    (fromTime: number) => {
      const context = getCtx();
      const masterGain = masterGainRef.current;
      if (!masterGain) return;
      stopSources();
      if (context.state === "suspended") void context.resume();

      const activeChannels = channelsRef.current;
      activeChannels.forEach((channel) => {
        const buffer = buffersRef.current.get(channel.name);
        if (!buffer || buffer.duration <= 0) return;

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rateRef.current;

        const low = context.createBiquadFilter();
        low.type = "lowshelf";
        low.frequency.value = 180;
        low.gain.value = channel.eqLow;

        const mid = context.createBiquadFilter();
        mid.type = "peaking";
        mid.frequency.value = 1100;
        mid.Q.value = 0.85;
        mid.gain.value = channel.eqMid;

        const high = context.createBiquadFilter();
        high.type = "highshelf";
        high.frequency.value = 6200;
        high.gain.value = channel.eqHigh;

        const pan = context.createStereoPanner();
        pan.pan.value = channel.pan;

        const gain = context.createGain();
        gain.gain.value = getEffectiveGain(channel, activeChannels);

        source.connect(low);
        low.connect(mid);
        mid.connect(high);
        high.connect(pan);
        pan.connect(gain);
        gain.connect(masterGain);

        // Every stem keeps running while muted so DJ controls become audible
        // immediately without restarting or losing sync.
        const safeOffset = Math.max(0, Math.min(fromTime, Math.max(0, buffer.duration - 0.001)));
        source.start(0, safeOffset);
        channelNodesRef.current.set(channel.name, { source, low, mid, high, pan, gain });
      });

      startTimeRef.current = context.currentTime;
      offsetRef.current = fromTime;
      playingRef.current = channelNodesRef.current.size > 0;
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
    setMasterLevel(0);
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
    const context = ctxRef.current;
    channelNodesRef.current.forEach((nodes, name) => {
      const channel = channels.find((item) => item.name === name);
      if (!channel) return;
      const now = context?.currentTime ?? 0;
      nodes.gain.gain.setTargetAtTime(getEffectiveGain(channel, channels), now, 0.015);
      nodes.low.gain.setTargetAtTime(channel.eqLow, now, 0.02);
      nodes.mid.gain.setTargetAtTime(channel.eqMid, now, 0.02);
      nodes.high.gain.setTargetAtTime(channel.eqHigh, now, 0.02);
      nodes.pan.pan.setTargetAtTime(channel.pan, now, 0.02);
    });
  }, [channels, getEffectiveGain]);

  useEffect(() => {
    const context = ctxRef.current;
    const masterGain = masterGainRef.current;
    if (!context || !masterGain) return;
    masterGain.gain.setTargetAtTime(masterVolume, context.currentTime, 0.02);
  }, [masterVolume]);

  useEffect(() => {
    const previousRate = rateRef.current;
    if (previousRate === playbackRate) return;

    const context = ctxRef.current;
    let resumeAt = offsetRef.current;
    const shouldResume = playingRef.current;
    if (shouldResume && context) {
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
    if (shouldResume) startSources(resumeAt);
  }, [duration, playbackRate, startSources, stopSources]);

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
          setMasterLevel(0);
        } else {
          setCurrentTime(Math.min(time, duration || time));
        }

        const analyser = analyserRef.current;
        const data = analyserDataRef.current;
        if (analyser && data) {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i += 1) {
            const normalized = (data[i] - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / data.length);
          setMasterLevel(Math.min(1, rms * 3.8));
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
      masterGainRef.current = null;
      analyserRef.current = null;
      analyserDataRef.current = null;
    };
  }, [stopSources]);

  return {
    currentTime,
    duration,
    isPlaying,
    loaded,
    loadError,
    masterLevel,
    play,
    pause,
    seek,
    togglePlay,
  };
}
