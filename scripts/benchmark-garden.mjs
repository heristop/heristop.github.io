import { chromium, devices } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const option = (name, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const url = option("url", "http://127.0.0.1:4327/path-of-stones/");
const cpu = Number(option("cpu", "1"));
if (!Number.isFinite(cpu) || cpu < 1) throw new Error("--cpu must be at least 1");
const angle = option("angle", "");
if (angle && !["metal", "gl", "vulkan", "swiftshader"].includes(angle)) {
  throw new Error("--angle must be metal, gl, vulkan or swiftshader");
}
const browser = await chromium.launch({ args: angle ? [`--use-angle=${angle}`] : [] });
const report = [];
try {
  for (const mobile of [false, true]) {
    const context = await browser.newContext(
      mobile ? { ...devices["Pixel 5"] } : { viewport: { width: 1440, height: 1000 } },
    );
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send("Performance.enable");
    await client.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    await page.addInitScript(() => {
      Math.random = () => 0.5;
      localStorage.setItem("path-stones:sound", "off");
      localStorage.setItem("path-stones:music", "off");
      const samples = [];
      let previous;
      const tick = (now) => {
        if (previous !== undefined && !document.hidden) samples.push(now - previous);
        previous = now;
        state.frame = requestAnimationFrame(tick);
      };
      const state = { samples, frame: requestAnimationFrame(tick) };
      window.__gardenBenchmark = state;
    });
    await page.goto(url);
    if (new URL(url).searchParams.get("renderer") === "webgl") {
      await page.locator('.zazen-world__map[data-renderer="webgl"]').waitFor({ timeout: 30000 });
    }
    await page.locator('.path-stones__turn[data-phase="player"]').waitFor({ timeout: 30000 });
    const readFrames = async () => page.evaluate(() => window.__gardenBenchmark.samples.splice(0));
    const summarize = (frames) => {
      const sorted = [...frames].sort((a, b) => a - b);
      return {
        frames: frames.length,
        meanFps: +(1000 / (frames.reduce((a, b) => a + b, 0) / frames.length)).toFixed(1),
        p95FrameMs: +(sorted[Math.floor(sorted.length * 0.95)] ?? 0).toFixed(2),
        framesOver25ms: frames.filter((ms) => ms > 25).length,
      };
    };
    const opening = summarize(await readFrames());
    await page.locator(".zazen-world__map").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
    await readFrames();
    const before = await client.send("Performance.getMetrics");
    let moved = 0;
    for (let step = 0; step < 24; step++) {
      const previous = await page.locator("#position-announcer").textContent();
      await page.keyboard.press(step % 2 ? "ArrowUp" : "ArrowDown");
      await page.waitForTimeout(240);
      if ((await page.locator("#position-announcer").textContent()) !== previous) moved++;
    }
    if (moved !== 24) throw new Error(`Benchmark route failed: ${moved}/24 steps completed`);
    const walking = summarize(await readFrames());
    const after = await client.send("Performance.getMetrics");
    const workMs = Object.fromEntries(
      ["ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "TaskDuration"].map((name) => [
        name,
        +(
          (after.metrics.find((m) => m.name === name).value -
            before.metrics.find((m) => m.name === name).value) *
          1000
        ).toFixed(2),
      ]),
    );
    report.push({
      gpu: await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2");
        if (!gl) return "unavailable";
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        const name = gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return name;
      }),
      renderer: await page.locator(".zazen-world__map").getAttribute("data-renderer"),
      viewport: mobile ? "mobile emulation" : "desktop",
      cpuSlowdown: cpu,
      moved,
      opening,
      walking,
      workMs,
    });
    await context.close();
  }
} finally {
  await browser.close();
}
const result = {
  note: "Local Chromium lab measurements; requestAnimationFrame cadence is not a GPU presentation guarantee or a physical-phone measurement.",
  url,
  scenarios: report,
};
console.log(JSON.stringify(result, null, 2));
const output = option("output", "");
if (output) await writeFile(output, JSON.stringify(result, null, 2) + "\n");
