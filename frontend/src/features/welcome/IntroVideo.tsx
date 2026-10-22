"use client";

import Button from "@mui/material/Button";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Wallet } from "lucide-react";
import { welcomeCopy } from "./copy";

const videoAspectRatio = welcomeCopy.video.aspectRatio;

export function IntroStaticFrame() {
  return (
    <div
      className="card-surface flex w-full flex-col items-center justify-center overflow-hidden bg-panel p-4 sm:p-6"
      style={{ aspectRatio: videoAspectRatio }}
    >
      <div className="h-3/4 w-full motion-reduce:hidden">
        <Image
          alt=""
          aria-hidden="true"
          className="size-full object-contain"
          height={500}
          priority={false}
          src="/manage-money-animate.svg"
          width={500}
        />
      </div>
      <div className="hidden h-3/4 w-full items-center justify-center motion-reduce:flex">
        <span className="flex size-20 items-center justify-center rounded-3xl bg-selected text-brand">
          <Wallet aria-hidden="true" size={40} strokeWidth={1.7} />
        </span>
      </div>
      <h2 className="text-center text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {welcomeCopy.video.fallbackTitle}
      </h2>
      <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-muted sm:text-base">
        {welcomeCopy.video.fallbackDescription}
      </p>
      <p className="sr-only" id="welcome-video-description">
        {welcomeCopy.video.description}
      </p>
    </div>
  );
}

export function IntroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoplayAttempted = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);

  useEffect(() => {
    if (autoplayAttempted.current) return;
    autoplayAttempted.current = true;

    const video = videoRef.current;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean };
      }
    ).connection;

    if (!video || reducedMotion || connection?.saveData === true) return;

    video.muted = true;
    void video.play().catch(() => {
      setIsPlaying(false);
    });
  }, []);

  function playVideo(): void {
    const video = videoRef.current;
    if (!video) return;

    if (hasEnded) {
      video.currentTime = 0;
      setHasEnded(false);
    }

    setPlaybackError(false);
    void video.play().catch(() => setPlaybackError(true));
  }

  function handleEnded(): void {
    setIsPlaying(false);
    setHasEnded(true);
    window.localStorage.setItem("largent-welcome-seen", "true");
  }

  if (hasError) return <IntroStaticFrame />;

  return (
    <div className="card-surface w-full overflow-hidden p-3 sm:p-4">
      <div
        className="overflow-hidden rounded-2xl bg-panel-raised"
        style={{ aspectRatio: videoAspectRatio }}
      >
        <video
          aria-describedby="welcome-video-description"
          className="size-full object-cover"
          muted
          onEnded={handleEnded}
          onError={() => setHasError(true)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => {
            setIsPlaying(true);
            setHasEnded(false);
          }}
          playsInline
          preload="metadata"
          ref={videoRef}
        >
          <source src={welcomeCopy.video.source} type="video/mp4" />
        </video>
      </div>
      <p className="sr-only" id="welcome-video-description">
        {welcomeCopy.video.description}
      </p>
      <div className="flex flex-wrap items-center gap-3 px-1 pt-3">
        <Button
          aria-label={
            isPlaying
              ? welcomeCopy.video.pauseLabel
              : welcomeCopy.video.playLabel
          }
          onClick={() => {
            if (isPlaying) {
              videoRef.current?.pause();
            } else {
              playVideo();
            }
          }}
          sx={{
            minHeight: 44,
            borderRadius: "12px",
            fontWeight: 600,
            textTransform: "none",
          }}
          variant="contained"
        >
          {isPlaying ? (
            <Pause aria-hidden="true" className="mr-2" size={18} />
          ) : (
            <Play aria-hidden="true" className="mr-2" size={18} />
          )}
          {isPlaying
            ? welcomeCopy.video.pause
            : welcomeCopy.video.play}
        </Button>
        {hasEnded ? (
          <Button
            aria-label={welcomeCopy.video.replayLabel}
            onClick={playVideo}
            sx={{
              minHeight: 44,
              borderRadius: "12px",
              textTransform: "none",
            }}
            variant="outlined"
          >
            <RotateCcw aria-hidden="true" className="mr-2" size={18} />
            {welcomeCopy.video.replay}
          </Button>
        ) : null}
        {playbackError ? (
          <p aria-live="polite" className="w-full text-sm text-alert">
            {welcomeCopy.video.playbackError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
