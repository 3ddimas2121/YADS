const RPC = require("discord-rpc");
const { exec } = require("child_process");

const clientId = "1483755667809505280";

process.on("uncaughtException", () => {});
process.on("unhandledRejection", () => {});

exec("tasklist", { encoding: "utf8" }, (err, stdout) => {
  if (!err) {
    const count = (stdout.match(/YADS\.exe/gi) || []).length;
    if (count > 1) {
      process.exit();
    }
  }
});

let rpc = null;
let isReady = false;
let interval = null;

let startTime = Date.now();
let lastKey = null;
let pendingKey = null;
let changeTimeout = null;

function normalize(text) {
  if (!text) return null;

  return text
    .toLowerCase()
    .replace(/смотреть.*$/i, "")
    .replace(/online.*$/i, "")
    .replace(/yummyanime.*$/i, "")
    .replace(/серия\s*\d+/gi, "")
    .replace(/[^a-zа-я0-9 ]/gi, "")
    .trim();
}

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function extractTitle(title) {
  if (!title) return null;

  if (title.includes("YummyAnime") && title.includes(" - ")) {
    let part = title.split(" - ")[1];

    if (part.includes("YummyAnime")) {
      part = part.split("YummyAnime")[0];
    }

    part = part
      .replace(/смотреть.*$/i, "")
      .replace(/online.*$/i, "")
      .replace(/серия.*$/i, "")
      .trim();

    return capitalize(part);
  }

  return null;
}

function getActiveWindow(callback) {
  exec(
    'powershell -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Process | Where-Object {$_.MainWindowTitle -like \'*yummy*\'} | Select-Object -ExpandProperty MainWindowTitle"',
    { encoding: "utf8" },
    (err, stdout) => {
      if (err) return callback(null);

      const lines = stdout.split("\n").map(l => l.trim()).filter(Boolean);

      const matches = lines.filter(l =>
        l.toLowerCase().includes("yummyanime") ||
        l.toLowerCase().includes("yummyani")
      );

      const active = matches.length > 0 ? matches[matches.length - 1] : null;

      callback(active || null);
    }
  );
}

function startPresence() {
  if (interval) clearInterval(interval);

  interval = setInterval(() => {
    if (!rpc || !isReady) return;

    getActiveWindow((title) => {
      if (!title) {
        rpc.clearActivity();
        lastKey = null;
        pendingKey = null;
        if (changeTimeout) clearTimeout(changeTimeout);
        return;
      }

      const animeTitle = extractTitle(title);
      const key = animeTitle ? normalize(animeTitle) : "main";

      if (key !== lastKey) {
        if (pendingKey !== key) {
          pendingKey = key;

          if (changeTimeout) clearTimeout(changeTimeout);

          changeTimeout = setTimeout(() => {
            lastKey = key;
            startTime = Date.now();
          }, 6000);
        }
      } else {
        pendingKey = null;
        if (changeTimeout) clearTimeout(changeTimeout);
      }

      if (animeTitle) {
        rpc.setActivity({
          details: `Смотрит «${animeTitle}»`,
          state: "🍿 Онлайн",
          startTimestamp: startTime,
          largeImageKey: "anime"
        });
      } else {
        rpc.setActivity({
          details: "Смотрит YummyAnime",
          state: "📺 Выбирает",
          startTimestamp: startTime,
          largeImageKey: "anime"
        });
      }
    });
  }, 5000);
}

function connect() {
  rpc = new RPC.Client({ transport: "ipc" });

  rpc.on("ready", () => {
    isReady = true;
    console.log("Подключено к Discord. Что смотрим сегодня?");
    startPresence();
  });

  rpc.on("disconnected", () => {
    isReady = false;
    rpc = null;
    setTimeout(connect, 3000);
  });

  rpc.login({ clientId }).catch(() => {
    setTimeout(connect, 3000);
  });
}

connect();
