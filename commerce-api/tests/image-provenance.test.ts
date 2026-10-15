import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { convertProductImage } from "../src/image-upload.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });

it("retains AI provenance in main and thumbnail images while dropping private metadata", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avaruchi-provenance-")); directories.push(directory);
  const sourceType = "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";
  const input = await sharp({ create: { width: 800, height: 800, channels: 3, background: "#173f2b" } }).withXmp(`<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" xmlns:exif="http://ns.adobe.com/exif/1.0/" Iptc4xmpExt:DigitalSourceType="${sourceType}" exif:GPSLatitude="private-location"/></rdf:RDF></x:xmpmeta>`).png().toBuffer();
  const result = await convertProductImage(input, directory, "https://avaruchi.example/uploads");
  for (const url of [result.url, result.thumbnailUrl]) {
    const metadata = await sharp(await readFile(path.join(directory, path.basename(url)))).metadata();
    expect(metadata.xmp?.toString()).toContain(sourceType);
    expect(metadata.xmp?.toString()).not.toContain("private-location");
    expect(metadata.exif).toBeUndefined();
  }
});

it("does not mark an ordinary photo as AI-generated", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "avaruchi-photo-")); directories.push(directory);
  const input = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
  const result = await convertProductImage(input, directory, "https://avaruchi.example/uploads");
  expect((await sharp(path.join(directory, path.basename(result.url))).metadata()).xmp).toBeUndefined();
});
