"use client";
/* eslint-disable @next/next/no-img-element -- Private images bypass shared image optimization. */
import { useCallback, useState, type ComponentProps, type ReactNode } from "react";
import { ImageOff, LoaderCircle } from "lucide-react";

type Props = Pick<
  ComponentProps<"img">,
  | "src"
  | "srcSet"
  | "sizes"
  | "width"
  | "height"
  | "alt"
  | "className"
  | "loading"
  | "referrerPolicy"
> & { frameClassName?: string; compact?: boolean; fallback?: ReactNode; retryable?: boolean };

export function ImagePlaceholder({
  loading = true,
  compact = false,
  children,
}: {
  loading?: boolean;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <span
      className={`image-placeholder ${loading ? "image-placeholder-loading" : ""}`}
      role={loading && !compact ? "status" : undefined}
    >
      {loading ? (
        <LoaderCircle className="spin" size={compact ? 16 : 24} aria-hidden="true" />
      ) : (
        !compact && <ImageOff size={24} aria-hidden="true" />
      )}
      {!compact && (
        <span>{children ?? (loading ? "Laster bilde …" : "Bildet kunne ikke lastes.")}</span>
      )}
      {compact && !loading && children}
    </span>
  );
}

export function LoadingImage(props: Props) {
  return <ImageFrame key={`${props.src}:${props.srcSet ?? ""}`} {...props} />;
}
function ImageFrame({
  frameClassName = "",
  compact = false,
  fallback,
  retryable = false,
  ...props
}: Props) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const checkCachedImage = useCallback((node: HTMLImageElement | null) => {
    if (node?.complete && node.currentSrc) setState(node.naturalWidth > 0 ? "loaded" : "error");
  }, []);
  return (
    <span
      className={`loading-image ${frameClassName}`}
      data-state={state}
      aria-busy={state === "loading"}
    >
      <img
        {...props}
        alt={props.alt ?? ""}
        key={attempt}
        ref={checkCachedImage}
        decoding="async"
        draggable={false}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
      {state !== "loaded" && (
        <ImagePlaceholder loading={state === "loading"} compact={compact}>
          {state === "error" ? fallback : undefined}
        </ImagePlaceholder>
      )}
      {state === "error" && retryable && (
        <button
          type="button"
          className="button secondary image-retry"
          onClick={() => {
            setState("loading");
            setAttempt((value) => value + 1);
          }}
        >
          Prøv igjen
        </button>
      )}
    </span>
  );
}
