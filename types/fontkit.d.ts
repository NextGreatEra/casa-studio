declare module "@pdf-lib/fontkit" {
  const fontkit: {
    create: (
      buffer: Uint8Array | ArrayBuffer,
      postscriptName?: string,
    ) => unknown;
  };
  export default fontkit;
}
