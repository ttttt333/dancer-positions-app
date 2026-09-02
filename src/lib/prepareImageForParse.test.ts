import { describe, expect, it } from "vitest";
import {
  heifBrandFromBytes,
  isHeicFile,
  isHeifBrand,
  isParseableImageFile,
  PARSE_IMAGE_FILE_ACCEPT,
} from "./prepareImageForParse";

function ftypBytes(brand: string): Uint8Array {
  const b = new Uint8Array(16);
  b[4] = 0x66;
  b[5] = 0x74;
  b[6] = 0x79;
  b[7] = 0x70;
  for (let i = 0; i < 4; i++) b[8 + i] = brand.charCodeAt(i);
  return b;
}

describe("PARSE_IMAGE_FILE_ACCEPT", () => {
  it("lets iOS Photos show HEIC via image/* and explicit heic types", () => {
    expect(PARSE_IMAGE_FILE_ACCEPT.startsWith("image/*")).toBe(true);
    expect(PARSE_IMAGE_FILE_ACCEPT).toContain("image/heic");
    expect(PARSE_IMAGE_FILE_ACCEPT).toContain(".heic");
    expect(PARSE_IMAGE_FILE_ACCEPT).toContain(".heics");
    expect(PARSE_IMAGE_FILE_ACCEPT).toContain(".hif");
  });
});

describe("isHeicFile", () => {
  it("detects iPhone HEIC by MIME even without a name", () => {
    expect(isHeicFile(new File([], "image", { type: "image/heic" }))).toBe(true);
    expect(isHeicFile(new File([], "image", { type: "image/heif" }))).toBe(true);
    expect(
      isHeicFile(new File([], "Live", { type: "image/heic-sequence" }))
    ).toBe(true);
  });

  it("detects uppercase .HEIC and related extensions with empty MIME", () => {
    expect(isHeicFile(new File([], "IMG_1234.HEIC"))).toBe(true);
    expect(isHeicFile(new File([], "shot.heif"))).toBe(true);
    expect(isHeicFile(new File([], "burst.heics"))).toBe(true);
    expect(isHeicFile(new File([], "photo.hif"))).toBe(true);
  });

  it("does not treat jpeg as heic", () => {
    expect(isHeicFile(new File([], "a.jpg", { type: "image/jpeg" }))).toBe(false);
  });
});

describe("isParseableImageFile", () => {
  it("accepts common still formats", () => {
    expect(isParseableImageFile(new File([], "a.jpg", { type: "image/jpeg" }))).toBe(
      true
    );
    expect(isParseableImageFile(new File([], "a.png", { type: "image/png" }))).toBe(
      true
    );
    expect(isParseableImageFile(new File([], "a.webp"))).toBe(true);
    expect(isParseableImageFile(new File([], "a.avif"))).toBe(true);
    expect(isParseableImageFile(new File([], "a.bmp"))).toBe(true);
  });

  it("accepts iPhone HEIC shared as octet-stream", () => {
    expect(
      isParseableImageFile(
        new File([], "IMG_0001.HEIC", { type: "application/octet-stream" })
      )
    ).toBe(true);
  });

  it("rejects non-images", () => {
    expect(
      isParseableImageFile(new File([], "notes.txt", { type: "text/plain" }))
    ).toBe(false);
  });
});

describe("heifBrandFromBytes", () => {
  it("reads ftyp brands used by iPhone photos", () => {
    expect(heifBrandFromBytes(ftypBytes("heic"))).toBe("heic");
    expect(isHeifBrand("heic")).toBe(true);
    expect(isHeifBrand("mif1")).toBe(true);
    expect(isHeifBrand("msf1")).toBe(true);
    expect(isHeifBrand("jpeg")).toBe(false);
  });
});
