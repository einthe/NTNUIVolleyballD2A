"use client";
/* eslint-disable @next/next/no-img-element -- Images require the viewer's session and must bypass shared caches. */
import { useState } from "react";
import { imageWidths } from "@/lib/image-variants";

export function Avatar({
  name,
  large = false,
  userId,
  path,
}: {
  name: string;
  large?: boolean;
  userId?: string;
  path?: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = userId && path ? `/avatars/${userId}?v=${encodeURIComponent(path)}` : null;
  return (
    <span className={`avatar ${large ? "avatar-large" : ""}`} aria-hidden="true">
      {src && failed !== src ? (
        <img
          src={src}
          srcSet={imageWidths.avatar.map((width) => `${src}&w=${width} ${width}w`).join(", ")}
          sizes={large ? "53px" : "37px"}
          width={large ? 53 : 37}
          height={large ? 53 : 37}
          decoding="async"
          alt=""
          onError={() => setFailed(src)}
        />
      ) : (
        name
          .split(" ")
          .filter(Boolean)
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
      )}
    </span>
  );
}
