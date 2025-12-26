import { Resvg, initWasm } from '@resvg/resvg-wasm';

let wasmInitialized = false;

/**
 * Initialize the resvg WASM module.
 * Must be called once before using convertSvgToPng.
 */
export async function initResvg(): Promise<void> {
  if (wasmInitialized) return;

  // Fetch the WASM binary from the CDN
  const wasmResponse = await fetch(
    'https://unpkg.com/@aspect/svg-to-image@0.0.1/wasm/resvg.wasm'
  );
  const wasmBuffer = await wasmResponse.arrayBuffer();
  await initWasm(wasmBuffer);
  wasmInitialized = true;
}

export type SvgToPngOptions = {
  width?: number;
  height?: number;
  background?: string;
};

/**
 * Convert an SVG string to PNG buffer.
 *
 * @param svg - The SVG content as a string
 * @param options - Optional width, height, and background color
 * @returns PNG image as Uint8Array
 */
export async function convertSvgToPng(
  svg: string,
  options: SvgToPngOptions = {}
): Promise<Uint8Array> {
  await initResvg();

  const resvg = new Resvg(svg, {
    fitTo: options.width
      ? { mode: 'width', value: options.width }
      : options.height
        ? { mode: 'height', value: options.height }
        : { mode: 'original' },
    background: options.background,
  });

  const pngData = resvg.render();
  return pngData.asPng();
}
