const RPC = require("discord-rpc");
const { exec } = require("child_process");

const clientId = "1483755667809505280";

//  защита от двойного запуска
exec("tasklist", { encoding: "utf8" }, (err, stdout) => {
  if (!err) {
    const count = (stdout.match(/YADS\.exe/gi) || []).length;
    if (count > 1) {
      process.exit();
    }
  }
});

const rpc = new RPC.Client({ transport: "ipc" });

let startTime = Date.now();
let lastState = null;

function capitalize(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function extractTitle(title) {
  if (!title) return null;

  if (title.includes(" - ")) {
    let part = title.split(" - ")[1];

    if (part.includes("YummyAnime")) {
      part = part.split("YummyAnime")[0];
    }

    if (part.toLowerCase().includes("смотреть")) {
      part = part.toLowerCase().split("смотреть")[0];
    }

    return capitalize(part.trim());
  }

  return null;
}

function getActiveWindow(callback) {
  exec(
    'powershell -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object -ExpandProperty MainWindowTitle"',
    { encoding: "utf8" },
    (err, stdout) => {
      if (err) return callback(null);

      const lines = stdout.split("\n").map(l => l.trim()).filter(Boolean);

      const active = lines.find(l =>
        l.toLowerCase().includes("yummy")
      );

      callback(active || null);
    }
  );
}

rpc.on("ready", () => {
  setInterval(() => {
    getActiveWindow((title) => {
      if (!title) {
        rpc.clearActivity();
        lastState = null;
        return;
      }

      const animeTitle = extractTitle(title);
      const currentState = animeTitle || "main";

      if (currentState !== lastState) {
        startTime = Date.now();
        lastState = currentState;
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
});

rpc.login({ clientId }).catch(console.error);