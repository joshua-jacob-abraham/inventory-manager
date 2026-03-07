import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { spawn, exec, execSync } from "child_process";
import { spawnSync } from "child_process";
import fetch from "node-fetch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow;
let mysqlProcess;
let pythonProcess;

const testProcess = spawn("cmd.exe", ["/c", "echo", "Hello from Electron"], {
  shell: true,
});

testProcess.stdout.on("data", (data) => {
  console.log(`STDOUT: ${data}`);
});

testProcess.on("error", (err) => {
  console.error("CMD Error:", err);
});

function getOrCreateMySQLCredentials() {
  const isProd = app.isPackaged;
  const userDataPath = isProd
    ? app.getPath("userData")
    : path.join(__dirname, "..", "..", "mysql-dev");

  const mysqlDir = path.join(userDataPath, "mysql");
  const credFile = path.join(mysqlDir, "credentials.json");

  fs.mkdirSync(mysqlDir, { recursive: true });

  if (fs.existsSync(credFile)) {
    return JSON.parse(fs.readFileSync(credFile, "utf8"));
  }

  const creds = {
    host: "127.0.0.1",
    port: 3308,
    user: "root",
    password: crypto.randomBytes(24).toString("base64"),
  };

  fs.writeFileSync(credFile, JSON.stringify(creds, null, 2));
  return creds;
}

function isBootstrapped() {
  const isProd = app.isPackaged;
  const userDataPath = isProd
    ? app.getPath("userData")
    : path.join(__dirname, "..", "..", "mysql-dev");

  const flagFile = path.join(userDataPath, "mysql", ".bootstrapped");
  return fs.existsSync(flagFile);
}

function pollMySQLUntilReady(mysqlBaseDir, port = 3308, timeout = 300000) {
  const mysqlExe = path.join(mysqlBaseDir, "bin", "mysql.exe");
  const start = Date.now();

  let pwd = "";
  if (isBootstrapped()) {
    const creds = getOrCreateMySQLCredentials();
    pwd = creds.password;
  }

  return new Promise((resolve, reject) => {
    const poll = () => {
      try {
        execSync(
          `"${mysqlExe}" -u root ${pwd ? `-p"${pwd}"` : ""} --protocol=tcp --port=${port} -e "SELECT 1;"`,
          { stdio: "ignore" },
        );
        resolve();
      } catch {
        if (Date.now() - start > timeout) {
          reject(new Error("MySQL did not become ready within timeout"));
        } else {
          setTimeout(poll, 500);
        }
      }
    };
    poll();
  });
}

function prepareMySQLConfig(mysqlBaseDir) {
  const isProd = app.isPackaged;
  const userDataPath = isProd
    ? app.getPath("userData")
    : path.join(__dirname, "..", "..", "mysql-dev");

  console.log("--------" + userDataPath + "--------");

  const mysqlRoot = path.join(userDataPath, "mysql");
  const mysqlDataDir = path.join(mysqlRoot, "data");
  const mysqlIniPath = path.join(mysqlRoot, "my.ini");

  fs.mkdirSync(mysqlDataDir, { recursive: true });

  const basedir = mysqlBaseDir.replace(/\\/g, "/");
  const datadir = mysqlDataDir.replace(/\\/g, "/");

  const iniContent = `
[mysqld]
port=3308
basedir="${basedir}"
datadir="${datadir}"
`;

  if (!isBootstrapped()) {
    fs.writeFileSync(mysqlIniPath, iniContent);
    console.log("Writing MySQL config:", mysqlIniPath);
  }
  return { mysqlIniPath, mysqlDataDir };
}

function ensureDataDirWritable(mysqlDataDir) {
  const username = process.env.USERNAME || process.env.USER;
  try {
    execSync(`icacls "${mysqlDataDir}" /grant "${username}:(OI)(CI)F" /T`);
    console.log("MySQL data folder permissions set.");
  } catch (err) {
    console.error("Failed to set permissions on MySQL data folder:", err);
  }
}

function initializeMySQLIfNeeded(
  mysqlPath,
  mysqlBaseDir,
  mysqlIniPath,
  mysqlDataDir,
) {
  const ibdata = path.join(mysqlDataDir, "ibdata1");

  if (fs.existsSync(ibdata)) {
    console.log("ibdata1 exists. skipping initialization.");
    return;
  }

  console.log("Initializing MySQL data directory...");

  const result = spawnSync(
    mysqlPath,
    [`--defaults-file=${mysqlIniPath}`, "--initialize-insecure"],
    {
      cwd: mysqlBaseDir,
      stdio: "inherit",
    },
  );

  if (result.status !== 0) {
    throw new Error("MySQL initialization failed");
  }

  ensureDataDirWritable(mysqlDataDir);
}

function startMySQL() {
  return new Promise((resolve, reject) => {
    const isProd = app.isPackaged;
    const mysqlBaseDir = isProd
      ? path.join(process.resourcesPath, "mysql")
      : path.join(__dirname, "mysql");

    const mysqlPath = path.join(mysqlBaseDir, "bin", "mysqld.exe");

    console.log(`Starting mysql with: "${mysqlPath}"`);

    const { mysqlIniPath, mysqlDataDir } = prepareMySQLConfig(mysqlBaseDir);
    initializeMySQLIfNeeded(
      mysqlPath,
      mysqlBaseDir,
      mysqlIniPath,
      mysqlDataDir,
    );

    const username = process.env.USERNAME || process.env.USER;
    try {
      execSync(`icacls "${mysqlDataDir}" /grant "${username}:(OI)(CI)F" /T`);
    } catch (err) {
      console.warn("Failed to set permissions on MySQL data dir:", err);
    }

    mysqlProcess = spawn(
      mysqlPath,
      [`--defaults-file=${mysqlIniPath}`, "--console"],
      {
        cwd: mysqlBaseDir,
      },
    );

    mysqlProcess.stdout.on("data", (data) => {
      console.log(`MySQL: ${data}`);
    });

    mysqlProcess.stderr.on("data", (data) => {
      console.error(`MySQL Error: ${data}`);
    });

    mysqlProcess.on("exit", (code) => {
      console.log(`MySQL process exited with code ${code}`);
      if (code !== 0) {
        reject(new Error(`MySQL exited with code ${code}`));
      }
    });

    pollMySQLUntilReady(mysqlBaseDir)
      .then(() => {
        console.log("MySQL ready.");
        resolve();
      })
      .catch(reject);
  });
}
function setRootPasswordWithRetry(mysqlBaseDir, creds, timeout = 30000) {
  const mysqlExe = path.join(mysqlBaseDir, "bin", "mysql.exe");

  const isProd = app.isPackaged;
  const userDataPath = isProd
    ? app.getPath("userData")
    : path.join(__dirname, "..", "..", "mysql-dev");

  const flagFile = path.join(userDataPath, "mysql", ".bootstrapped");

  const sql = `
ALTER USER 'root'@'localhost'
IDENTIFIED WITH caching_sha2_password
BY '${creds.password}';
`;

  const start = Date.now();
  while (true) {
    try {
      spawnSync(
        mysqlExe,
        ["-u", "root", "--protocol=tcp", `--port=${creds.port}`, "-e", sql],
        { stdio: "inherit" },
      );
      console.log("Logged in without password.");

      execSync(
        `"${mysqlExe}" -u root -p"${creds.password}" --protocol=tcp --port=${creds.port} -e "SELECT 1;"`,
        {
          stdio: "inherit",
        },
      );

      fs.writeFileSync(flagFile, "ok");
      console.log("MySQL root password set successfully");
      break;
    } catch {
      if (Date.now() - start > timeout) {
        throw new Error(
          "Failed to set MySQL root password after multiple attempts",
        );
      }
      console.log("Trying again.");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
}

async function waitForFastAPI(timeout = 30000) {
  const start = Date.now();

  while (true) {
    try {
      const res = await fetch("http://localhost:8000/health/db");
      if (res.status === 200) return;
    } catch {}
    if (Date.now() - start > timeout) {
      throw new Error("FastAPI did not become ready in time");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

function startFastAPI() {
  const isProd = app.isPackaged;
  const backendPath = isProd
    ? path.join(process.resourcesPath, "main.exe")
    : path.join(__dirname, "../../backend/dist/main.exe");

  console.log(`Starting FastAPI with: "${backendPath}"`);

  const creds = getOrCreateMySQLCredentials();

  pythonProcess = spawn(backendPath, [], {
    env: {
      ...process.env,
      DB_HOST: creds.host,
      DB_PORT: creds.port,
      DB_USER: creds.user,
      DB_PASSWORD: creds.password,
    },
  });

  pythonProcess.stdout.on("data", (data) => {
    console.log(`FastAPI: ${data}`);
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error(`FastAPI Error: ${data}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`FastAPI process exited with code ${code}`);
  });

  return waitForFastAPI();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: "hidden",
    icon: __dirname + "/app_icon.ico",
    webPreferences: {
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  const isProd = app.isPackaged;

  const startUrl = isProd
    ? pathToFileURL(path.join(__dirname, "..", "dist", "index.html")).href
    : "http://localhost:5173";

  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on("context-menu", (event) => {
    event.preventDefault();
  });

  ipcMain.on("window:minimize", () => {
    console.log("Minimize command received");
    mainWindow.minimize();
  });

  ipcMain.on("window:maximize", () => {
    console.log("Maximize/restore command received");
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on("window:close", () => {
    console.log("Close command received");
    mainWindow.close();
  });
}

app.whenReady().then(async () => {
  const mysqlBaseDir = app.isPackaged
    ? path.join(process.resourcesPath, "mysql")
    : path.join(__dirname, "mysql");

  try {
    await startMySQL();
    console.log("Started MySQL.");

    if (!isBootstrapped()) {
      console.log("Bootstrapping.");
      const creds = getOrCreateMySQLCredentials();

      console.log("Setting root password.");
      setRootPasswordWithRetry(mysqlBaseDir, creds);
    } else {
      console.log("Already bootstrapped.");
    }

    console.log("Starting FastAPI.");
    await startFastAPI();
    console.log("FastAPI ready.");

    createWindow();
  } catch (err) {
    console.error("Startup failed:", err);
    app.quit();
  }
});

function killProcess(pid, name) {
  if (!pid) return Promise.resolve();
  return new Promise((resolve) => {
    try { process.kill(pid, "SIGINT"); } catch {}

    const timeout = setTimeout(() => {
      try { process.kill(pid, "SIGKILL"); } catch {}
    }, 3000);

    exec(`taskkill /pid ${pid} /f /t`, (err) => {
      clearTimeout(timeout);
      if (err) console.warn(`${name} taskkill failed:`, err.message);
      else console.log(`${name} killed via taskkill`);
      resolve();
    });
  });
}


function killPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port} `, (err, stdout) => {
      if (err || !stdout) return resolve();

      const pids = [...new Set(
        stdout.split("\n")
          .map(line => line.trim().split(/\s+/).pop())
          .filter(pid => pid && /^\d+$/.test(pid))
      )];

      if (!pids.length) return resolve();

      const kills = pids.map(pid =>
        new Promise(res => {
          exec(`taskkill /pid ${pid} /f /t`, () => res());
        })
      );

      Promise.all(kills).then(resolve);
    });
  });
}

app.on("window-all-closed", async () => {
  console.log("App closing, cleaning up child processes...");

  try {
    if (mysqlProcess) {
      console.log("Stopping MySQL...");
      await killProcess(mysqlProcess.pid, "MySQL");
      await killPort(3308); 
    }

    if (pythonProcess) {
      console.log("Stopping FastAPI...");
      await killProcess(pythonProcess.pid, "FastAPI");
      await killPort(8000);
    }

    console.log("All child processes cleaned up.");
  } catch (err) {
    console.error("Error during shutdown:", err);
  } finally {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
