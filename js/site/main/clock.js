import { onReady } from "../core/dom.js";

const selector = ".clock";
const use24h = false;
const showSeconds = false;
const showTZShort = true;

function getUserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function makeFormatter(tz) {
  const opts = {
    hour: "numeric",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
    hour12: !use24h,
    ...(showTZShort ? { timeZoneName: "short" } : {}),
    timeZone: tz,
  };
  return new Intl.DateTimeFormat(undefined, opts);
}

function tick() {
  const el = document.querySelector(selector);
  if (!el) return;
  const tz = getUserTimeZone();
  const fmt = makeFormatter(tz);
  el.textContent = fmt.format(new Date());
}

onReady(() => {
  tick();
  setInterval(tick, showSeconds ? 1000 : 10000);
});
