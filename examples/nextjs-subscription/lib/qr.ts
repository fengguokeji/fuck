import QRCode from 'qrcode';

const DEFAULT_QR_SIZE = 280;

export async function buildQrImage(qrContent: string, size = DEFAULT_QR_SIZE) {
  const trimmed = qrContent?.trim();
  if (!trimmed) {
    return '';
  }
  return QRCode.toDataURL(trimmed, {
    width: size,
    margin: 0,
    errorCorrectionLevel: 'M',
  });
}
