"use client";
export function ImageUpload({ maxMB }: { maxMB: number }) {
  return (
    <label>
      Bilde
      <input
        type="file"
        name="image"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.setCustomValidity(
            file && file.size > maxMB * 1024 * 1024 ? `Bildet kan være høyst ${maxMB} MB.` : "",
          );
          event.currentTarget.reportValidity();
        }}
      />
      <small className="muted">JPEG, PNG eller WebP · Maks {maxMB} MB · Kun synlig for laget</small>
    </label>
  );
}
