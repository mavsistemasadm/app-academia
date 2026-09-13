/*
  Gera os arquivos da marca a partir de public/Logo.jpg (fundo preto).

    node scripts/gerar_marca.mjs

  O JPG original tem fundo preto e o app é branco, então o fundo vira
  transparência. Cada pixel é uma mistura de preto com uma das duas cores da
  marca (cinza ou ciano); a intensidade do pixel diz quanto de cor tem, e isso
  vira o alfa. Assim a borda serrilhada sai limpa, sem halo escuro.

  Saídas:
    public/marca/logo.png          logo inteira, transparente
    public/marca/simbolo.png       só o pulso (o "AV"), quadrado, transparente
    public/icones/*.png            ícones do PWA com o símbolo
    app/favicon.ico                favicon com o símbolo
*/
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const CINZA = [92, 100, 102];
const CIANO = [0, 180, 203];

const { data, info } = await sharp("public/Logo.jpg")
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

// ── Fundo preto → transparência ─────────────────────────────────────────
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const [r, g, b] = [data[i * C], data[i * C + 1], data[i * C + 2]];
  const ciano = b - r > 40;
  const cor = ciano ? CIANO : CINZA;
  const alfa = Math.min(1, Math.max(r, g, b) / Math.max(...cor));
  const o = i * 4;
  rgba[o] = cor[0];
  rgba[o + 1] = cor[1];
  rgba[o + 2] = cor[2];
  rgba[o + 3] = alfa < 0.04 ? 0 : Math.round(alfa * 255);
}

// ── Símbolo: as duas peças do pulso, achadas por preenchimento ──────────
// Recorte retangular pegaria o "A" de Atitude, que invade a caixa do pulso.
const noSimbolo = new Uint8Array(W * H);
const SEMENTES = [
  [400, 250], // peça cinza
  [500, 400], // peça ciano
];
for (const [sx, sy] of SEMENTES) {
  const pilha = [sy * W + sx];
  while (pilha.length) {
    const p = pilha.pop();
    if (noSimbolo[p] || rgba[p * 4 + 3] === 0) continue;
    noSimbolo[p] = 1;
    const x = p % W;
    const y = (p / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) pilha.push(ny * W + nx);
      }
  }
}
const simboloRGBA = Buffer.from(rgba);
for (let i = 0; i < W * H; i++) if (!noSimbolo[i]) simboloRGBA[i * 4 + 3] = 0;

const bruto = (buf) => sharp(buf, { raw: { width: W, height: H, channels: 4 } });

await mkdir("public/marca", { recursive: true });

// Logo: 1000px de largura cobre 2x até 500 CSS px, o maior uso (login).
const logo = await bruto(rgba).trim({ threshold: 0 }).png().toBuffer();
await sharp(logo)
  .resize({ width: 1000 })
  .png({ compressionLevel: 9 })
  .toFile("public/marca/logo.png");

// Versão branca, para fundo colorido (o topo azul da home do aluno).
const { data: logoRaw, info: logoInfo } = await sharp("public/marca/logo.png")
  .raw()
  .toBuffer({ resolveWithObject: true });
for (let o = 0; o < logoRaw.length; o += 4) logoRaw.fill(255, o, o + 3);
await sharp(logoRaw, { raw: { width: logoInfo.width, height: logoInfo.height, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile("public/marca/logo-branca.png");

// Símbolo aparado e centralizado num quadrado.
const simboloAparado = await bruto(simboloRGBA).trim({ threshold: 0 }).png().toBuffer();

async function simboloEm(tamanho, { fundo, margem }) {
  const util = Math.round(tamanho * (1 - 2 * margem));
  const peca = await sharp(simboloAparado)
    .resize(util, util, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width: tamanho, height: tamanho, channels: 4, background: fundo },
  })
    .composite([{ input: peca, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };
const BRANCO = { r: 255, g: 255, b: 255, alpha: 1 };

await writeFile("public/marca/simbolo.png", await simboloEm(512, { fundo: TRANSPARENTE, margem: 0 }));

// Ícones "any": fundo branco (iOS e Android pintam transparência de preto).
await writeFile("public/icones/icone-192.png", await simboloEm(192, { fundo: BRANCO, margem: 0.12 }));
await writeFile("public/icones/icone-512.png", await simboloEm(512, { fundo: BRANCO, margem: 0.12 }));
await writeFile("public/icones/apple-touch-icon.png", await simboloEm(180, { fundo: BRANCO, margem: 0.12 }));
// Maskable: o launcher corta até um círculo de 80% — o símbolo fica nos 60% do meio.
await writeFile("public/icones/icone-maskable-512.png", await simboloEm(512, { fundo: BRANCO, margem: 0.2 }));

// Favicon: ICO com PNGs dentro (formato aceito por todos os navegadores atuais).
const tamanhosIco = [16, 32, 48];
const pngs = await Promise.all(
  tamanhosIco.map((t) => simboloEm(t, { fundo: TRANSPARENTE, margem: 0.02 }))
);
const cabecalho = Buffer.alloc(6 + 16 * pngs.length);
cabecalho.writeUInt16LE(0, 0);
cabecalho.writeUInt16LE(1, 2);
cabecalho.writeUInt16LE(pngs.length, 4);
let deslocamento = cabecalho.length;
pngs.forEach((png, i) => {
  const e = 6 + 16 * i;
  cabecalho.writeUInt8(tamanhosIco[i], e);
  cabecalho.writeUInt8(tamanhosIco[i], e + 1);
  cabecalho.writeUInt16LE(1, e + 4);
  cabecalho.writeUInt16LE(32, e + 6);
  cabecalho.writeUInt32LE(png.length, e + 8);
  cabecalho.writeUInt32LE(deslocamento, e + 12);
  deslocamento += png.length;
});
await writeFile("app/favicon.ico", Buffer.concat([cabecalho, ...pngs]));

const meta = await sharp("public/marca/logo.png").metadata();
console.log(`logo.png ${meta.width}x${meta.height} · símbolo e ícones gerados`);
