# Inventory Management App Setup Guide

## Overview

This guide walks through the steps to:

1. Compile the backend into an executable.
2. Set up MySQL for the application.
3. Install Node.js dependencies
4. Build and package the Electron-based frontend.
5. Generate an installer for easy deployment.

---

## 1. Compile the Backend

The backend, built using FastAPI, is compiled into an executable for deployment.

### Steps:

1. Navigate to the backend directory:
   ```sh
   cd backend
   ```
2. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
3. Use **PyInstaller** to create an executable:

   ```sh
   pyinstaller --onefile --hidden-import=pandas --hidden-import=reportlab --hidden-import=openpyxl --hidden-import=PyPDF2 --hidden-import=mysql-connector-python --hidden-import=fpdf --hidden-import=pydantic --hidden-import=fastapi --hidden-import=uvicorn main.py

   ```

4. After compilation, move the generated executable (`main.exe`) into the `backend/dist/` folder.

---

## 2. Set Up MySQL

MySQL is packaged within the Electron application to maintain portability across systems. The database data folder is initialized in the user-specific data path (app.getPath('userData')) to persist data between updates.

### Directory Structure:

```
frontend/
|-- electron/
│   |-- mysql/
│   │   │-- bin/
│   │   │-- share/
│   │   │-- lib/
```

### Steps:

1. Download and extract MySQL.
2. Move the extracted files to `frontend/electron/mysql/`.
3. Ensure that the `bin/`, `share/`, and `lib/` folders are present.
4. The bin, share and lib folders must be inside mysql directory.
5. The my.ini file is generated dynamically and stored together with the data folder under the user's roaming application data path (AppData/Roaming).
6. Create a `mysql-dev` folder in the root directory for to use in dev mode.

---

## 3. Initialize MySQL Server

Before using MySQL, it needs to be initialized. MySQL is initialized automatically. A random generated password is created and stored in user-specific data folder.

## 4. Install npm dependencies

Run the following command in the **frontend** directory:

```sh
npm install
```

This installs all required packages for the React + Electron frontend.

## 5. Build and Package the Application

### Step 1: Build the Frontend

Run the following command in the **frontend** directory:

```sh
npm run build
```

This compiles the React frontend and stores the output in the `dist/` folder.

---

### Step 2: Package the Electron App

Run:

```sh
npm run electron:build
```

This does two things:

1. **Compiles the frontend** (`vite build`).
2. **Uses `electron-builder`** to create an installer.

After this step, the **installer** will be available in the `frontend/dist_electron/` folder.

---

## 5. Running the Application in Development Mode

`electron/main.js` is configured to run all the commands in sequence.

---

## 6. Notes

- Ensure **MySQL** is running before launching the backend and frontend.
- The Electron app automatically includes the **MySQL server** and **backend** when packaged, making installation seamless.
- Run commands as an **administrator** if permission issues occur.

---

Now you're all set! 🚀
