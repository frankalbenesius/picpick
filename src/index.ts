import * as p from "@clack/prompts";
import fs from "fs";
import fsp from "fs/promises";
import exifr from "exifr";
import { compareDesc, differenceInSeconds } from "date-fns";

type ParsedEntry = {
  entry: fs.Dirent;
  exif: object | null;
};
const getExif = async (entry: fs.Dirent): Promise<ParsedEntry> => {
  try {
    const parsed = await exifr.parse(`${entry.path}/${entry.name}`);
    return { entry, exif: parsed };
  } catch (error: any) {
    return { entry, exif: null };
  }
};

type ExifEntry = {
  entry: fs.Dirent;
  exif: MyExif;
};
type MyExif = {
  DateTimeOriginal: string;
  ExifImageWidth: string;
  ExifImageHeight: string;
  Orientation: string;
};
const isExifEntry = (entry: ParsedEntry): entry is ExifEntry =>
  entry.exif !== null;

const SECONDS_LIMIT = 5;

async function main() {
  p.intro("picpick");

  const folder: string = `/Users/frank/Desktop/DCIM`;
  // const folder = String(
  //   await p.text({
  //     message: "What folder?",
  //   })
  // );

  const entries = await fsp.readdir(folder, {
    withFileTypes: true,
    recursive: true,
  });
  const parsedEntries = await Promise.all(entries.map(getExif));
  const exifEntries = parsedEntries.filter(isExifEntry);
  const sortedEntries = exifEntries.sort((a, b) =>
    compareDesc(a.exif.DateTimeOriginal, b.exif.DateTimeOriginal)
  );

  const entryGroups = sortedEntries.reduce<ExifEntry[][]>((acc, entry, idx) => {
    if (idx === 0) {
      acc.push([entry]);
      return acc;
    }
    const previousDateTime =
      sortedEntries[Math.max(idx - 1)].exif.DateTimeOriginal;
    const thisDateTime = entry.exif.DateTimeOriginal;

    const secondsAfterLast = differenceInSeconds(
      previousDateTime,
      thisDateTime
    );

    const isSameGroup = secondsAfterLast < SECONDS_LIMIT;
    if (isSameGroup) {
      const lastGroup = acc[acc.length - 1];
      lastGroup.push(entry);
    } else {
      acc.push([entry]);
    }

    return acc;
  }, []);

  entryGroups.forEach((group, idx) => {
    p.log.info(`Group ${idx + 1}: ${group.length} photos`);
  });

  const avgGroupSize = Math.round(
    entryGroups.map((e) => e.length).reduce((a, b) => a + b, 0) /
      entryGroups.length
  );

  p.log.info(`Average group size: ${avgGroupSize}`);

  p.outro("all done!");
}

main();
