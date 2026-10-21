const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { before, after, test } = require("node:test");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
let browser;
let server;
let origin;

before(async () => {
  server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const relative =
      pathname === "/baseline.html"
        ? "tests/fixtures/updated.min.html"
        : pathname === "/"
          ? "index.html"
          : pathname.slice(1);
    const filename = path.resolve(root, relative);
    if (!filename.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const content = await fs.readFile(filename);
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".json": "application/json",
        ".css": "text/css",
      };
      response.writeHead(200, {
        "content-type":
          (types[path.extname(filename)] || "text/plain") + "; charset=utf-8",
      });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox"],
  });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});

// Both pages use identical deterministic time, random numbers, and audio stubs.
// This suite verifies restoration equivalence, not the availability of remote TTS.
function installHarness(seed) {
  localStorage.clear();
  for (const [key, value] of Object.entries(seed)) {
    localStorage.setItem(
      key,
      typeof value === "object" ? JSON.stringify(value) : String(value),
    );
  }
  let randomState = 1234567;
  Math.random = () =>
    ((randomState = (randomState * 16807) % 2147483647) - 1) / 2147483646;
  const NativeDate = Date;
  let now = new NativeDate("2026-10-21T10:00:00Z").getTime();
  window.Date = class extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [now]));
    }
    static now() {
      return now;
    }
  };
  let nextId = 0;
  const timers = new Map();
  window.setTimeout = (callback, delay = 0) => {
    const id = ++nextId;
    timers.set(id, { callback, due: now + delay, interval: 0 });
    return id;
  };
  window.setInterval = (callback, delay) => {
    const id = ++nextId;
    timers.set(id, { callback, due: now + delay, interval: delay });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  window.__advanceTime = (milliseconds) => {
    const target = now + milliseconds;
    let count = 0;
    while (true) {
      const entry = [...timers]
        .filter(([, timer]) => timer.due <= target)
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!entry) break;
      if (++count > 10000) throw new Error("Timer loop");
      const [id, timer] = entry;
      now = timer.due;
      if (timer.interval) timer.due += timer.interval;
      else timers.delete(id);
      timer.callback();
    }
    now = target;
  };
  window.__animationRequests = 0;
  window.requestAnimationFrame = () => ++window.__animationRequests;
  window.Audio = class {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
    }
    load() {}
    pause() {}
    async play() {
      // A browser audio end event happens after the play() promise settles.
      queueMicrotask(() => queueMicrotask(() => this.onended?.()));
    }
  };
  window.SpeechSynthesisUtterance = class {};
  Object.defineProperty(window, "speechSynthesis", {
    value: {
      getVoices: () => [{ name: "Xiaoxiao" }],
      speak() {},
      pause() {},
      resume() {},
      cancel() {},
    },
  });
}

async function openPage(url, seed) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    timezoneId: "Asia/Shanghai",
  });
  await context.route("**/*", (route) => {
    if (
      route
        .request()
        .url()
        .startsWith(origin + "/")
    )
      return route.continue();
    return route.abort();
  });
  await context.addInitScript(installHarness, seed);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin + url);
  await waitForDictionary(page, "basic");
  return { context, page, errors };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const text = (selector) =>
      document.querySelector(selector)?.textContent.replace(/\s+/g, " ").trim();
    return {
      theme: document.body.className,
      dictionary: text(".current-dict-name"),
      words: [...document.querySelectorAll(".word")].map((element) => ({
        word: element.dataset.word,
        text: element.textContent,
        className: element.className,
        html: element.innerHTML,
      })),
      meaning: document.querySelector(".paraphrase").innerHTML,
      meaningClass: document.querySelector(".paraphrase").className,
      message: text(".error-text"),
      stats: [...document.querySelectorAll(".info-col p:first-child")].map(
        (element) => element.textContent,
      ),
      progress: document.querySelector(".progress-bar").style.width,
      controls: [...document.querySelectorAll("input,select")].map(
        (element) => ({
          className: element.className,
          value: element.value,
          checked: element.checked,
          min: element.min,
          max: element.max,
          display: element.style.display,
        }),
      ),
      bindings: [
        ...document.querySelectorAll("[data-bind]:not(input):not(select)"),
      ].map((element) => text("." + element.classList[0])),
      icons: [...document.querySelectorAll(".controls button")].map(
        (element) => element.textContent,
      ),
      modals: [
        ".help-overlay",
        ".calendar-overlay",
        ".difficulty-dropdown",
        ".dictionary-dropdown",
        ".sound-dropdown",
      ].map((selector) => {
        const element = document.querySelector(selector);
        return {
          className: element.className,
          display: getComputedStyle(element).display,
        };
      }),
      calendar: document.querySelector("#calendarsContainer").innerHTML,
      storage: Object.fromEntries(
        Object.keys(localStorage)
          .sort()
          .map((key) => [key, localStorage.getItem(key)]),
      ),
      canvas: [
        document.querySelector("canvas").width,
        document.querySelector("canvas").height,
      ],
      animationRequests: window.__animationRequests,
    };
  });
}

async function compareScenario(seed, scenario) {
  const initial = { voice_loop: 0, voice_enableParaphrase: false, ...seed };
  const baseline = await openPage("/baseline.html", initial);
  const restored = await openPage("/index.html", initial);
  try {
    const baselineStates = [];
    const restoredStates = [];
    await scenario(baseline.page, async () =>
      baselineStates.push(await snapshot(baseline.page)),
    );
    await scenario(restored.page, async () =>
      restoredStates.push(await snapshot(restored.page)),
    );
    assert.deepEqual(restoredStates, baselineStates);
    assert.deepEqual(restored.errors, baseline.errors);
    assert.deepEqual(restored.errors, []);
    return restoredStates;
  } finally {
    await baseline.context.close();
    await restored.context.close();
  }
}

async function typeCurrentWord(page) {
  const word = await page.locator(".word.active").getAttribute("data-word");
  await page.keyboard.type(word);
}

// App timers are virtual; polling from Node avoids using the page's frozen timers.
async function waitForDictionary(page, type) {
  const expected = type === "cet4" ? "130" : "50";
  const deadline = performance.now() + 5000;
  while (performance.now() < deadline) {
    if (
      (await page.locator(".learning-progress").getAttribute("max")) ===
      expected
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail(`Dictionary ${type} did not finish loading`);
}

async function changeDictionary(page, type) {
  await page.locator(".dict-selector").click();
  await page.locator(`.dictionary-option[data-type="${type}"]`).click();
  await waitForDictionary(page, type);
}

async function changeSetting(page, selector, value, event = "change") {
  await page.locator(selector).evaluate(
    (element, { value, event }) => {
      if (element.type === "checkbox") element.checked = value;
      else element.value = value;
      element.dispatchEvent(new Event(event, { bubbles: true }));
    },
    { value, event },
  );
}

test("restores HTML/CSS rendering and the six-month calendar", async () => {
  const initial = { voice_loop: 0, voice_enableParaphrase: false };
  const baseline = await openPage("/baseline.html", initial);
  const restored = await openPage("/index.html", initial);
  try {
    assert.deepEqual(
      await snapshot(restored.page),
      await snapshot(baseline.page),
    );
    assert.deepEqual(
      await restored.page.screenshot({ animations: "disabled" }),
      await baseline.page.screenshot({ animations: "disabled" }),
    );
  } finally {
    await baseline.context.close();
    await restored.context.close();
  }
  await compareScenario({}, async (page, save) => {
    await page.locator(".dark-mode-toggle").click();
    await save();
    await page.locator(".help-button").click();
    await save();
    await page.locator(".help-close").click();
    await page.locator(".statistics-button").click();
    assert.equal(await page.locator(".calendar").count(), 6);
    await save();
  });
});

test("typing, errors, hidden mode, navigation, and known-word persistence match", async () => {
  const states = await compareScenario({}, async (page, save) => {
    await page.locator(".start-prompt").click();
    assert.equal(await page.locator(".word").count(), 20);
    await page.evaluate(() => window.__advanceTime(3000));
    await typeCurrentWord(page);
    await save();
    const current = await page
      .locator(".word.active")
      .getAttribute("data-word");
    const wrong = current[0].toLowerCase() === "z" ? "x" : "z";
    await page.keyboard.type(wrong.repeat(5));
    await save();
    await page.locator(".hide-word-toggle").click();
    await page.keyboard.press("Enter");
    await save();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Backquote");
    await save();
  });
  assert.equal(states[1].stats[4], "1");
  assert.ok(JSON.parse(states.at(-1).storage.knownWords).length > 0);
});

test("repeat, interleaved hidden words, shuffle, and per-dictionary progress match", async () => {
  await compareScenario({}, async (page, save) => {
    await page.locator(".start-prompt").click();
    await changeSetting(page, ".word-loop-slider", "3");
    assert.equal(await page.locator(".word").count(), 60);
    await save();
    await changeSetting(page, ".last-word-hidden", true);
    assert.equal(await page.locator(".word").count(), 59);
    assert.equal(await page.locator(".word.hidden-text").count(), 19);
    await save();
    await changeSetting(page, ".shuffled-words-toggle", true);
    await changeSetting(page, ".paraphrase-hidden", true);
    await changeSetting(page, ".learning-progress", "2");
    await save();
    await changeDictionary(page, "cet4");
    await changeSetting(page, ".learning-progress", "3");
    await save();
    await changeDictionary(page, "basic");
    await save();
  });
});

test("capitalized dictionary loading and fireworks match", async () => {
  const states = await compareScenario(
    { capitalize_words: true, enable_animations: true },
    async (page, save) => {
      await page.locator(".start-prompt").click();
      assert.equal(await page.locator(".word.active").textContent(), "THE");
      await typeCurrentWord(page);
      await save();
      await changeDictionary(page, "cet4");
      await save();
    },
  );
  assert.ok(states[0].animationRequests > 0);
});

test("a completed round records a practice day and advances after two seconds", async () => {
  const states = await compareScenario({}, async (page, save) => {
    await page.locator(".start-prompt").click();
    await page.evaluate(() => window.__advanceTime(10000));
    const words = await page
      .locator(".word")
      .evaluateAll((elements) =>
        elements.map((element) => element.dataset.word),
      );
    for (const word of words) await page.keyboard.type(word);
    await save();
    await page.evaluate(() => window.__advanceTime(2000));
    await save();
    await page.locator(".statistics-button").click();
    assert.equal(await page.locator(".calendar td.has-practice").count(), 1);
    await save();
  });
  assert.equal(
    JSON.parse(states[0].storage.practiceRecords)["2026-10-21"].stats.count,
    1,
  );
  assert.equal(JSON.parse(states[1].storage.dict_progress).basic, 2);
});

test("hidden review mastery and clearing per-dictionary unknown words match", async () => {
  const states = await compareScenario(
    {
      unit_loopCount: 4,
      unKnownWords: { basic: ["the", "be"], cet4: ["cancel"] },
    },
    async (page, save) => {
      await page.locator(".review-mode-toggle").click();
      await page.locator(".hide-word-toggle").click();
      for (let index = 0; index < 4; index++) await typeCurrentWord(page);
      await save();
      await page.evaluate(() => window.__advanceTime(1000));
      for (let index = 0; index < 4; index++) await typeCurrentWord(page);
      await page.evaluate(() => window.__advanceTime(1000));
      await save();
      await page.keyboard.press("End");
      await save();
    },
  );
  assert.deepEqual(JSON.parse(states[0].storage.unKnownWords), {
    basic: ["be"],
    cet4: ["cancel"],
  });
  assert.deepEqual(JSON.parse(states.at(-1).storage.unKnownWords), {
    basic: [],
    cet4: ["cancel"],
  });
});
