import QRCode from 'qrcode';

export const generateQRCodeDataUrl = async (text) => {
  // Faster, more reliable scans across lighting conditions:
  // - Keep EC level at 'M' to balance resilience and density
  // - Increase scale (module pixel size)
  // - Increase margin (quiet zone) so mobile scanners lock on quickly
  return QRCode.toDataURL(text, {
    // For on-screen scanning, 'L' (low) error correction reduces module density
    // and yields faster scans; margin/scale ensure crisp edges and a big quiet zone.
    errorCorrectionLevel: 'L',
    scale: 10,
    margin: 4,
    color: { dark: '#000000', light: '#FFFFFF' }
  });
};
