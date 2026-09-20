"use client";
export function ImageUpload({
  maxMB,
  label = "Bilde",
  required = false,
}: {
  maxMB: number;
  label?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        type="file"
        name="image"
        required={required}
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
