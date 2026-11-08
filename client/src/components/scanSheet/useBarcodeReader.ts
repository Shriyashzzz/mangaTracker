// The camera, reading book barcodes into ISBNs. The browser's own
// BarcodeDetector where it has one (Chrome on Android and Mac); elsewhere
// (iPhone Safari, most laptops) the ZXing library, loaded only now, so the
// rest of the site never carries it. The back camera on phones, the webcam on
// laptops. Each ISBN is reported once while it stays in view.
import { useEffect, useRef, useState, type RefObject } from "react";
import { isbnFromBarcode } from "../../lib/barcode";

export type CameraState = "starting" | "live" | "blocked";

// the browser's own reader: not in TypeScript's DOM types yet
type Detector = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};
type DetectorClass = {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

// the back camera, sharp: asked for nothing, browsers give 640x480, where a
// barcode's thin bars blur together. HD where the camera has it, and on
// phones that can, focus that keeps adjusting (ignored where it can't)
const CAMERA: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
  },
  audio: false,
};
// the camera's picture into the <video>, or out of it. Outside the hook: the
// element is the browser's, not React state
const show = (el: HTMLVideoElement, stream: MediaStream | null) => {
  el.srcObject = stream;
};

// how often the browser's reader looks at a frame
const LOOK_EVERY_MS = 200;
// the same book held in view isn't read again until it's been away this long
const SAME_BOOK_AFTER_MS = 2500;

export function useBarcodeReader(
  video: RefObject<HTMLVideoElement | null>,
  onIsbn: (isbn: string) => void,
  // false while the scanner is closed or typing has replaced the camera
  active: boolean,
  // bumped to try the camera again after it was refused
  attempt = 0,
) {
  const [state, setState] = useState<CameraState>("starting");
  const [torch, setTorch] = useState<{ can: boolean; on: boolean }>({
    can: false,
    on: false,
  });
  // the latest handler, without restarting the camera when it changes
  const report = useRef(onIsbn);
  useEffect(() => {
    report.current = onIsbn;
  }, [onIsbn]);

  useEffect(() => {
    if (!active) return;
    const el = video.current;
    if (!el) return;
    let stopped = false;
    let stop = () => {};
    const lastSeen = new Map<string, number>();
    const seen = (read: string) => {
      const isbn = isbnFromBarcode(read);
      if (!isbn) return;
      const now = Date.now();
      const before = lastSeen.get(isbn);
      lastSeen.set(isbn, now);
      if (before && now - before < SAME_BOOK_AFTER_MS) return;
      report.current(isbn);
    };
    const torchFrom = (stream: MediaStream | null) => {
      const track = stream?.getVideoTracks()[0];
      const can = Boolean(
        track &&
        "torch" in
          ((track.getCapabilities?.() ?? {}) as Record<string, unknown>),
      );
      setTorch({ can, on: false });
    };

    (async () => {
      setState("starting");
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        const Native = (
          window as unknown as { BarcodeDetector?: DetectorClass }
        ).BarcodeDetector;
        const formats = (await Native?.getSupportedFormats?.()) ?? [];
        if (Native && formats.includes("ean_13")) {
          const stream = await navigator.mediaDevices.getUserMedia(CAMERA);
          // closing from here on stops it, even mid-start
          let timer = 0;
          stop = () => {
            clearInterval(timer);
            stream.getTracks().forEach((t) => t.stop());
          };
          if (stopped) return stop();
          show(el, stream);
          await el.play();
          if (stopped) return stop();
          const detector = new Native({ formats: ["ean_13"] });
          timer = window.setInterval(async () => {
            if (el.readyState < 2) return;
            try {
              for (const code of await detector.detect(el)) seen(code.rawValue);
            } catch {
              /* a frame it couldn't read */
            }
          }, LOOK_EVERY_MS);
          torchFrom(stream);
        } else {
          const [
            { BrowserMultiFormatReader },
            { BarcodeFormat, DecodeHintType },
          ] = await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
          if (stopped) return;
          const hints = new Map([
            [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]],
          ]);
          const reader = new BrowserMultiFormatReader(hints, {
            delayBetweenScanAttempts: 150,
          });
          const controls = await reader.decodeFromConstraints(
            CAMERA,
            el,
            (result) => {
              if (result) seen(result.getText());
            },
          );
          if (stopped) return controls.stop();
          stop = () => controls.stop();
          torchFrom(el.srcObject as MediaStream | null);
        }
        setState("live");
      } catch {
        // refused, no camera, or not over https
        if (!stopped) setState("blocked");
      }
    })();

    return () => {
      stopped = true;
      stop();
      show(el, null);
    };
  }, [active, video, attempt]);

  const toggleTorch = async () => {
    const track = (
      video.current?.srcObject as MediaStream | null
    )?.getVideoTracks()[0];
    if (!track) return;
    const on = !torch.on;
    try {
      await track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      });
      setTorch({ can: true, on });
    } catch {
      setTorch({ can: false, on: false });
    }
  };

  return { state, torch, toggleTorch };
}
