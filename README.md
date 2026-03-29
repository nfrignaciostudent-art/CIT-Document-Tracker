# CIT Document Tracker
### Group 6 — IDEA Encryption Project

A document tracking system for CIT that uses the **IDEA (International Data Encryption Algorithm)** to encrypt document data. It has two parts: a **Java CLI app** for registering documents and generating QR codes, and a **web app** (`index.html`) for tracking documents by scanning or entering a Tracking ID.

---

## Features

- Register documents with auto-generated Tracking IDs (e.g. `CIT-1001`)
- Encrypt document data using the IDEA symmetric-key block cipher
- Generate QR codes that link to a live public tracking page
- Track document status through a workflow: `Received → Processing → For Approval → Approved → Released`
- Admin panel with user management, activity logs, and movement logs
- IDEA Encryption Demo page to test the algorithm directly
- Scan log system — staff can log who handled a document and where

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web Frontend | HTML, CSS, JavaScript (Vanilla) |
| Encryption | IDEA Algorithm (custom implementation) |
| QR Code (Web) | [qrcode.js](https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js) |
| QR Code (Java) | ZXing (Google) |
| Storage | Browser LocalStorage |
| Fonts | DM Sans + DM Mono (Google Fonts) |

---

## Project Structure

```
IDEA CIT/
├── .gitignore
├── lib/
│   ├── core-3.5.2.jar        ← local only, never pushed
│   └── javase-3.5.2.jar      ← local only, never pushed
├── app.js
├── IDEA_CIT_Document_Tracker.java
├── index.html
├── README.md
└── style.css
```

---

## Setup & Installation

### Web App (No installation needed)
Just open `index.html` in your browser. No server required.

**Default admin credentials:**
```
Username: admin
Password: admin1234
```

---

### Java CLI App

#### Step 1 — Make sure Java is installed
```bash
java -version
```
You need **Java 8 or higher**.

#### Step 2 — Download the required JAR libraries

Create a `lib/` folder in the project directory, then download both JARs into it:

| Library | Version | Download Link |
|---|---|---|
| ZXing Core | 3.5.2 | [core-3.5.2.jar](https://repo1.maven.org/maven2/com/google/zxing/core/3.5.2/core-3.5.2.jar) |
| ZXing JavaSE | 3.5.2 | [javase-3.5.2.jar](https://repo1.maven.org/maven2/com/google/zxing/javase/3.5.2/javase-3.5.2.jar) |

#### Step 3 — Compile

**Windows:**
```bash
javac -cp "lib/*" IDEA_CIT_Document_Tracker.java
```

**Mac / Linux:**
```bash
javac -cp "lib/*" IDEA_CIT_Document_Tracker.java
```

#### Step 4 — Run

**Windows:**
```bash
java -cp ".;lib/*" IDEA_CIT_Document_Tracker
```

**Mac / Linux:**
```bash
java -cp ".:lib/*" IDEA_CIT_Document_Tracker
```

---

## How It Works — IDEA Encryption

IDEA is a **symmetric-key block cipher** that encrypts 64-bit blocks using a 128-bit key. The same key is used in both the Java app and the web frontend.

```
Secret Key   : Group6CITKey2024  (128-bit / 16 characters)
Block Size   : 64-bit
Rounds       : 8 full rounds + output transformation
Subkeys      : 52 x 16-bit subkeys
Operations   : MUL mod 65537 · ADD mod 65536 · XOR bitwise
```

The document name is encrypted before being stored, and the QR code payload contains the encrypted tracking ID so it cannot be tampered with.

---

## QR Code Workflow

```
Register Document
      |
      v
Java generates QR  -->  QR_CIT-1001.png
      |
      v
Student scans QR   -->  Opens index.html?track=CIT-1001
      |
      v
Public tracking page shows live status + full history
```

---

## Document Status Workflow

```
Received --> Processing --> For Approval --> Approved --> Released
                                                |
                                            Rejected
```

---

## Group Members

> Nash Gutierrez
 Laurendeyn Aquino
 Nhico Ignacio

---

## License

This project was made for academic purposes only.
