import QRCode from "qrcode";

export const qrSvg = (text: string) =>
  QRCode.toString(text, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1b1714", light: "#ffffff" },
  });

export const qrPng = (text: string) =>
  QRCode.toDataURL(text, {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#1b1714", light: "#ffffff" },
  });
