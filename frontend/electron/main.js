import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import { spawn, exec } from "child_process";

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

function startMySQL() {
  const isProd = app.isPackaged;
  const mysqlPath = isProd
    ? path.join(process.resourcesPath, "mysql", "bin", "mysqld.exe")
    : path.join(__dirname, "/mysql/bin/mysqld.exe");

  console.log(`Starting mysql with: "${mysqlPath}"`);

  mysqlProcess = spawn(mysqlPath, ["--defaults-file=../my.ini", "--console"], {
    cwd: path.dirname(mysqlPath),
    // shell: true,
  });

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

function startFastAPI() {
  // const isProd = process.env.NODE_ENV === "production";
  const isProd = app.isPackaged;
  const backendPath = isProd
    ? path.join(process.resourcesPath, "main.exe")
    : path.join(__dirname, "../../backend/dist/main.exe");

  console.log(`Starting FastAPI with: "${backendPath}"`);

  pythonProcess = spawn(backendPath, [], {
    cwd: path.dirname(backendPath),
    // shell: true,
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

app.whenReady().then(() => {
  startMySQL();
  setTimeout(() => {
    startFastAPI();
    setTimeout(() => createWindow(), 5000);
  }, 5000);
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
      }
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
