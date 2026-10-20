import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const stylesDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/styles",
);
const palettePath = path.join(stylesDirectory, "palette.ts");
const outputPath = path.join(stylesDirectory, "tokens.css");
const paletteSource = await readFile(palettePath, "utf8");

function readScheme(name) {
  const match = paletteSource.match(
    new RegExp(`^  ${name}: \\{([\\s\\S]*?)^  \\},?$`, "m"),
  );
  if (!match) {
    throw new Error(`Could not find the ${name} palette in ${palettePath}.`);
  }

  const colors = Object.fromEntries(
    [...match[1].matchAll(/^\s{4}([A-Za-z]\w*):\s*"(#[\da-fA-F]{6})"/gm)].map(
      ([, key, value]) => [key, value],
    ),
  );
  if (Object.keys(colors).length === 0) {
    throw new Error(`The ${name} palette contains no color values.`);
  }
  return colors;
}

function readShape(name) {
  const match = paletteSource.match(
    new RegExp(`^  ${name}:\\s*"([^"]+)"`, "m"),
  );
  if (!match) {
    throw new Error(`Could not find the ${name} shape token in ${palettePath}.`);
  }
  return match[1];
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function declarations(colors, indent = "  ") {
  return Object.entries(colors)
    .map(([name, value]) => `${indent}--color-${toKebabCase(name)}: ${value};`)
    .join("\n");
}

const light = readScheme("light");
const dark = readScheme("dark");
if (Object.keys(light).join(",") !== Object.keys(dark).join(",")) {
  throw new Error("Light and dark palettes must define the same color keys.");
}

const sharedTokens = [
  `  --radius-card: ${readShape("radiusCard")};`,
  `  --radius-control: ${readShape("radiusControl")};`,
  `  --radius-pill: ${readShape("radiusPill")};`,
  `  --touch-target: ${readShape("touchTarget")};`,
];
const darkDeclarations = declarations(dark, "    ");

const css = `/* Generated from palette.ts. Do not edit manually. */
:root {
${declarations(light)}
  --color-income: var(--color-success);
  --color-expense: var(--color-error);
${sharedTokens.join("\n")}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${darkDeclarations}
  }
}

:root[data-theme="dark"] {
${darkDeclarations}
}
`;

await writeFile(outputPath, css, "utf8");
console.log(`Generated ${path.relative(process.cwd(), outputPath)}.`);
