// Empaqueta las extensiones de Chrome de tools/ en public/downloads/*.zip y escribe
// public/downloads/extensions.json con sus versiones. Corre antes de cada build (npm "prebuild"),
// así lo que se descarga desde el TMS es siempre la última versión del repo.
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { deflateRawSync } from "node:zlib";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const OUT = join(ROOT, "public", "downloads");
const EXTENSIONS = [
  { dir: "tools/dat-tab-names", zip: "dat-driver-tabs.zip", key: "dat" },
  { dir: "tools/rts-factoring-assistant", zip: "rts-factoring-assistant.zip", key: "rts" },
];

// CRC-32 (tabla estándar)
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/** ZIP con deflate; las rutas van dentro de una carpeta con el nombre de la extensión */
function zip(baseDir, folder) {
  const locals = [], centrals = [];
  let offset = 0;
  // Fecha fija: el zip sale igual si los archivos no cambian
  const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const file of listFiles(baseDir).sort()) {
    const name = Buffer.from(`${folder}/${relative(baseDir, file).replace(/\\/g, "/")}`, "utf8");
    const data = readFileSync(file);
    const comp = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    locals.push(local, name, comp);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + comp.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length / 2, 8); end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

mkdirSync(OUT, { recursive: true });
const info = {};
for (const ext of EXTENSIONS) {
  const base = join(ROOT, ext.dir);
  const manifest = JSON.parse(readFileSync(join(base, "manifest.json"), "utf8"));
  const folder = ext.zip.replace(/\.zip$/, "");
  writeFileSync(join(OUT, ext.zip), zip(base, folder));
  info[ext.key] = { name: manifest.name, version: manifest.version, url: `/downloads/${ext.zip}` };
  console.log(`[extensions] ${ext.zip} v${manifest.version}`);
}
writeFileSync(join(OUT, "extensions.json"), JSON.stringify(info, null, 2) + "\n");
