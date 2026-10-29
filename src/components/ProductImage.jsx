import React, { useCallback, useState } from 'react';
import { Cable, Gamepad2, Headphones, Keyboard, Mic, Mouse, Package, Speaker, Webcam } from 'lucide-react';
import './ProductImage.css';

const CATEGORY_ICONS = {
  Mice: Mouse,
  Keyboards: Keyboard,
  Headsets: Headphones,
  Webcams: Webcam,
  Gaming: Gamepad2,
  Streaming: Mic,
  Audio: Speaker,
  Accessories: Cable
};

// A product photo, or its category's icon when there is no photo or it fails
// to load — never a stand-in photo of some other product.
export default function ProductImage({ src, alt, category, ...imgProps }) {
  const [failedSrc, setFailedSrc] = useState(null);
  // A server-rendered image can fail before React attaches onError.
  const checkAlreadyFailed = useCallback(img => {
    if (img?.complete && img.naturalWidth === 0) setFailedSrc(src);
  }, [src]);

  if (!src || failedSrc === src) {
    const Icon = CATEGORY_ICONS[category] ?? Package;
    return <span className="product-image-fallback" {...alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true }}>
        <Icon strokeWidth={1.4} aria-hidden="true" />
      </span>;
  }
  return <img ref={checkAlreadyFailed} src={src} alt={alt} onError={() => setFailedSrc(src)} {...imgProps} />;
}
