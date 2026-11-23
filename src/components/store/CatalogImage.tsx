import { useState, type ImgHTMLAttributes } from "react";
import "@/catalog-image.css";

type CatalogImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "onError"
> & {
  src?: string | null;
  showPlaceholderLabel?: boolean;
};

export function CatalogImage({
  src,
  alt = "",
  loading = "lazy",
  showPlaceholderLabel = false,
  ...props
}: CatalogImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>();
  const placeholder = !src || failedSource === src;
  const markMissing = () => {
    if (!placeholder) setFailedSource(src);
  };

  return (
    <>
      <img
        {...props}
        src={placeholder ? "/images/catalog-photo-placeholder.webp" : src}
        alt={placeholder ? "" : alt}
        loading={loading}
        ref={image => {
          if (image?.complete && image.naturalWidth === 0) markMissing();
        }}
        onError={markMissing}
      />
      {placeholder && showPlaceholderLabel && (
        <span className="catalog-photo-placeholder-label">Photo coming soon</span>
      )}
    </>
  );
}
