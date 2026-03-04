import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { spawn, exec, execSync } from "child_process";
import { spawnSync } from "child_process";

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

function pollMySQLUntilReady(mysqlBaseDir, port = 3308, timeout = 300000) {
  const mysqlExe = path.join(mysqlBaseDir, "bin", "mysql.exe");
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const poll = () => {
      try {
        execSync(
          `"${mysqlExe}" -u root --protocol=tcp --port=${port} -e "SELECT 1;"`,
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

  fs.writeFileSync(mysqlIniPath, iniContent);
  return { mysqlIniPath, mysqlDataDir };
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
}

function startMySQL() {
  const isProd = app.isPackaged;
  const mysqlBaseDir = isProd
    ? path.join(process.resourcesPath, "mysql")
    : path.join(__dirname, "mysql");

  const mysqlPath = path.join(mysqlBaseDir, "bin", "mysqld.exe");

  console.log(`Starting mysql with: "${mysqlPath}"`);

  const { mysqlIniPath, mysqlDataDir } = prepareMySQLConfig(mysqlBaseDir);
  initializeMySQLIfNeeded(mysqlPath, mysqlBaseDir, mysqlIniPath, mysqlDataDir);

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

  if (fs.existsSync(flagFile)) return;

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
  startMySQL();

  const mysqlBaseDir = app.isPackaged
    ? path.join(process.resourcesPath, "mysql")
    : path.join(__dirname, "mysql");

  try {
    console.log("Waiting for MySQL to be ready for bootstrapping.");
    await pollMySQLUntilReady(mysqlBaseDir);

    const creds = getOrCreateMySQLCredentials();

    console.log("Setting root password.");
    setRootPasswordWithRetry(mysqlBaseDir, creds);

    console.log("Starting FastAPI.");
    startFastAPI();

    createWindow();
  } catch (err) {
    console.error("Startup failed:", err);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (mysqlProcess) {
    console.log("Stopping MySQL...");
    exec(`taskkill /pid ${mysqlProcess.pid} /f /t`, (error, stdout, stderr) => {
      if (error) console.error(`Error stopping MySQL: ${error}`);
      if (stderr) console.error(`MySQL Shutdown Error: ${stderr}`);
      if (stdout) console.log(`MySQL Shutdown: ${stdout}`);
    });
  }

  if (pythonProcess) {
    console.log("Stopping FastAPI...");
    exec(
      `taskkill /pid ${pythonProcess.pid} /f /t`,
      (error, stdout, stderr) => {
        if (error) console.error(`Error stopping FastAPI: ${error}`);
        if (stderr) console.error(`FastAPI Shutdown Error: ${stderr}`);
        if (stdout) console.log(`FastAPI Shutdown: ${stdout}`);
      },
    );
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
