const DEFAULT_QR_SIZE = 280;

export function buildQrImageUrl(qrContent: string, size = DEFAULT_QR_SIZE) {
  const trimmed = qrContent?.trim();
  if (!trimmed) {
    return '';
  }
  const dimension = `${size}x${size}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=${dimension}&data=${encodeURIComponent(trimmed)}`;
}
