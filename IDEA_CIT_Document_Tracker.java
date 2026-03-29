import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Scanner;
import java.awt.image.BufferedImage;
import java.io.File;
import javax.imageio.ImageIO;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

class IDEA {

    // ── KEY must match index.html exactly ──────────────────────────
    public static final String SECRET_KEY = "Group6CITKey2024";

    private int[] subkeys;

    public IDEA() {
        this.subkeys = generateSubkeys(SECRET_KEY);
    }

    // Expand a plain string key into 52 x 16-bit subkeys
    // (mirrors the JavaScript expandKey in index.html)
    private int[] generateSubkeys(String keyStr) {
        byte[] src = keyStr.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] buf = new byte[16];
        // pad / truncate to 16 bytes
        System.arraycopy(src, 0, buf, 0, Math.min(src.length, 16));

        int[] sk = new int[52];
        int count = 0;

        while (count < 52) {
            // Pull 8 x 16-bit words from the current 128-bit buffer
            for (int i = 0; i < 8 && count < 52; i++) {
                sk[count++] = ((buf[i * 2] & 0xFF) << 8) | (buf[i * 2 + 1] & 0xFF);
            }
            // Rotate the 128-bit buffer left by 25 bits
            byte[] next = new byte[16];
            int byteShift  = 25 / 8;   // 3
            int bitShift   = 25 % 8;   // 1
            for (int i = 0; i < 16; i++) {
                int from = (i + byteShift) % 16;
                int fromNext = (i + byteShift + 1) % 16;
                next[i] = (byte)(((buf[from] & 0xFF) << bitShift)
                                | ((buf[fromNext] & 0xFF) >>> (8 - bitShift)));
            }
            buf = next;
        }
        return sk;
    }

    private int mul(int a, int b) {
        a &= 0xFFFF; b &= 0xFFFF;
        if (a == 0) a = 65536;
        if (b == 0) b = 65536;
        long r = ((long) a * b) % 65537L;
        return r == 65536 ? 0 : (int) r;
    }
    private int add(int a, int b) { return (a + b) & 0xFFFF; }
    private int xor(int a, int b) { return a ^ b; }

    private int mulInverse(int a) {
        if (a <= 1) return a;
        long t = 0, nt = 1, r = 65537, nr = a;
        while (nr != 0) {
            long q = r / nr;
            long tmp = t - q * nt; t = nt; nt = tmp;
            tmp = r - q * nr;     r = nr; nr = tmp;
        }
        return (int)(t < 0 ? t + 65537 : t);
    }
    private int addInverse(int a) { return (65536 - a) & 0xFFFF; }

    private int[] decryptSubkeys() {
        int[] ek = this.subkeys;
        int[] dk = new int[52];
        int p = 0, q = 48;
        dk[p++] = mulInverse(ek[q]);
        dk[p++] = addInverse(ek[q + 1]);
        dk[p++] = addInverse(ek[q + 2]);
        dk[p++] = mulInverse(ek[q + 3]);
        for (int round = 7; round >= 0; round--) {
            q = round * 6;
            dk[p++] = ek[q + 4];
            dk[p++] = ek[q + 5];
            dk[p++] = mulInverse(ek[q]);
            if (round > 0) {
                dk[p++] = addInverse(ek[q + 2]);
                dk[p++] = addInverse(ek[q + 1]);
            } else {
                dk[p++] = addInverse(ek[q + 1]);
                dk[p++] = addInverse(ek[q + 2]);
            }
            dk[p++] = mulInverse(ek[q + 3]);
        }
        return dk;
    }

    private int[] encryptBlock(int w1, int w2, int w3, int w4, int[] sk) {
        int a = w1, b = w2, c = w3, d = w4;
        for (int round = 0; round < 8; round++) {
            int z  = round * 6;
            int t1 = mul(a, sk[z]);
            int t2 = add(b, sk[z + 1]);
            int t3 = add(c, sk[z + 2]);
            int t4 = mul(d, sk[z + 3]);
            int t5 = xor(t1, t3);
            int t6 = xor(t2, t4);
            int t7 = mul(t5, sk[z + 4]);
            int t8 = add(t6, t7);
            int t9 = mul(t8, sk[z + 5]);
            int t10 = add(t7, t9);
            int o1 = xor(t1, t9);
            int o2 = xor(t2, t10);
            int o3 = xor(t3, t9);
            int o4 = xor(t4, t10);
            if (round < 7) { a = o1; b = o3; c = o2; d = o4; }
            else           { a = o1; b = o2; c = o3; d = o4; }
        }
        return new int[]{ mul(a, sk[48]), add(b, sk[49]), add(c, sk[50]), mul(d, sk[51]) };
    }

    public String encrypt(String plaintext) {
        try {
            byte[] data   = plaintext.getBytes("UTF-8");
            int    padLen = 8 - (data.length % 8);
            byte[] padded = new byte[data.length + padLen];
            System.arraycopy(data, 0, padded, 0, data.length);
            for (int i = data.length; i < padded.length; i++) padded[i] = (byte) padLen;

            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < padded.length; i += 8) {
                int p0 = (padded[i]   & 0xFF) << 8 | (padded[i+1] & 0xFF);
                int p1 = (padded[i+2] & 0xFF) << 8 | (padded[i+3] & 0xFF);
                int p2 = (padded[i+4] & 0xFF) << 8 | (padded[i+5] & 0xFF);
                int p3 = (padded[i+6] & 0xFF) << 8 | (padded[i+7] & 0xFF);
                int[] out = encryptBlock(p0, p1, p2, p3, subkeys);
                for (int w : out) sb.append(String.format("%04X", w));
            }
            return sb.toString();
        } catch (Exception e) { return "EncryptionError"; }
    }

    public String decrypt(String hex) {
        try {
            int[] dk = decryptSubkeys();
            List<Byte> bytes = new ArrayList<>();
            for (int i = 0; i < hex.length(); i += 16) {
                String chunk = hex.substring(i, i + 16);
                int c0 = Integer.parseInt(chunk.substring(0,  4), 16);
                int c1 = Integer.parseInt(chunk.substring(4,  8), 16);
                int c2 = Integer.parseInt(chunk.substring(8,  12), 16);
                int c3 = Integer.parseInt(chunk.substring(12, 16), 16);
                int[] out = encryptBlock(c0, c1, c2, c3, dk);
                for (int w : out) {
                    bytes.add((byte)((w >> 8) & 0xFF));
                    bytes.add((byte)(w        & 0xFF));
                }
            }
            int padLen = bytes.get(bytes.size() - 1) & 0xFF;
            byte[] result = new byte[bytes.size() - padLen];
            for (int i = 0; i < result.length; i++) result[i] = bytes.get(i);
            return new String(result, "UTF-8");
        } catch (Exception e) { return "DecryptionError"; }
    }
}

// ── QR Generator ─────────────────────────────────────────────────────────────
// Set BASE_URL to wherever you host index.html, e.g.:
//   https://yourname.github.io/cit-tracker/index.html
// The QR will encode:  <BASE_URL>?track=<IDEA-encrypted docId>
// When scanned, the phone opens that URL and index.html shows the tracking page.
// ─────────────────────────────────────────────────────────────────────────────
class QRGenerator {

    // ▼▼▼ CHANGE THIS to your GitHub Pages URL ▼▼▼
    private static final String BASE_URL =
        "https://YOUR_USERNAME.github.io/YOUR_REPO/index.html";
    // ▲▲▲ ─────────────────────────────────────── ▲▲▲

    private final IDEA idea = new IDEA();

    public String generate(String docId, String docName, String status) {
        // Encrypt the docId with the same key as index.html
        String encryptedId = idea.encrypt(docId);

        // Build the tracking URL — this is what the phone camera will open
        String trackingUrl = BASE_URL + "?track=" + encryptedId;

        String filename = "QR_" + docId + ".png";
        try {
            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
            hints.put(EncodeHintType.MARGIN, 2);
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");

            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(trackingUrl, BarcodeFormat.QR_CODE, 300, 300, hints);

            BufferedImage image = new BufferedImage(300, 300, BufferedImage.TYPE_INT_RGB);
            for (int x = 0; x < 300; x++)
                for (int y = 0; y < 300; y++)
                    image.setRGB(x, y, matrix.get(x, y) ? 0x000000 : 0xFFFFFF);

            ImageIO.write(image, "PNG", new File(filename));
            System.out.println("QR Saved  : " + filename);
            System.out.println("QR URL    : " + trackingUrl);
            return filename;
        } catch (Exception e) {
            System.out.println("QR Error  : " + e.getMessage());
            return "QR Error: " + e.getMessage();
        }
    }
}

class Document {
    String docId, docName, docType, submittedBy, purpose, dateAdded, status, encryptedData, qrFile;
    List<Map<String, String>> history = new ArrayList<>();

    public Document(String docId, String docName, String docType, String submittedBy,
                    String purpose, String dateAdded, String encryptedData, String qrFile) {
        this.docId        = docId;
        this.docName      = docName;
        this.docType      = docType;
        this.submittedBy  = submittedBy;
        this.purpose      = purpose;
        this.dateAdded    = dateAdded;
        this.status       = "Received";
        this.encryptedData = encryptedData;
        this.qrFile       = qrFile;
        Map<String, String> init = new HashMap<>();
        init.put("status", "Received");
        init.put("date", dateAdded);
        init.put("note", "Document received and registered");
        history.add(init);
    }
}

class Tracker {
    private IDEA idea          = new IDEA();
    private QRGenerator qrGen  = new QRGenerator();
    private List<Document> docs = new ArrayList<>();
    private int counter        = 1000;
    private DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private static String repeat(String s, int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) sb.append(s);
        return sb.toString();
    }

    public String addDocument(String name, String type, String by, String purpose) {
        counter++;
        String id   = "CIT-" + counter;
        String date = LocalDateTime.now().format(fmt);
        String data = name + "|" + type + "|" + by + "|" + purpose + "|" + date;

        System.out.println("\n[IDEA ENCRYPTION]");
        System.out.println("Original  : " + data);
        String encrypted = idea.encrypt(data);
        System.out.println("Encrypted : " + encrypted.substring(0, Math.min(32, encrypted.length())) + "...");

        // QR now encodes the encrypted docId as a tracking URL
        String qrFile = qrGen.generate(id, name, "Received");

        docs.add(new Document(id, name, type, by, purpose, date, encrypted, qrFile));
        System.out.println("Document Added!! ID: " + id);
        return id;
    }

    public void updateStatus(String id, String status, String note) {
        Document doc = find(id);
        if (doc == null) { System.out.println("Not found!!"); return; }
        String old = doc.status;
        doc.status = status;
        // Regenerate QR with updated status (URL stays the same — phone always gets live data)
        doc.qrFile = qrGen.generate(id, doc.docName, status);
        Map<String, String> h = new HashMap<>();
        h.put("status", status);
        h.put("date", LocalDateTime.now().format(fmt));
        h.put("note", note.isEmpty() ? old + " -> " + status : note);
        doc.history.add(h);
        System.out.println("Status: " + old + " -> " + status + " | QR: " + doc.qrFile);
    }

    public void viewDocument(String id) {
        Document doc = find(id);
        if (doc == null) { System.out.println("Not found!!"); return; }
        System.out.println("\n" + repeat("=", 50));
        System.out.println("ID           : " + doc.docId);
        System.out.println("Name         : " + doc.docName);
        System.out.println("Type         : " + doc.docType);
        System.out.println("Submitted By : " + doc.submittedBy);
        System.out.println("Purpose      : " + doc.purpose);
        System.out.println("Date         : " + doc.dateAdded);
        System.out.println("Status       : " + doc.status);
        System.out.println("\n[IDEA DECRYPTION]");
        System.out.println("Decrypted : " + idea.decrypt(doc.encryptedData));
        System.out.println("\nHISTORY:");
        for (int i = 0; i < doc.history.size(); i++) {
            Map<String, String> h = doc.history.get(i);
            System.out.println("  " + (i + 1) + ". [" + h.get("date") + "] " + h.get("status") + " - " + h.get("note"));
        }
        System.out.println("\nQR FILE : " + doc.qrFile);
        System.out.println("Scan the QR to open the live tracking page on your phone!");
    }

    public void viewAll() {
        if (docs.isEmpty()) { System.out.println("No documents!!"); return; }
        System.out.println("\n" + repeat("=", 70));
        System.out.println(String.format("%-12s %-25s %-15s %-15s", "ID", "Name", "Type", "Status"));
        System.out.println(repeat("-", 70));
        for (Document d : docs)
            System.out.println(String.format("%-12s %-25s %-15s %-15s",
                d.docId,
                d.docName.length() > 24 ? d.docName.substring(0, 24) : d.docName,
                d.docType.length() > 14 ? d.docType.substring(0, 14) : d.docType,
                d.status));
    }

    public void search(String term) {
        List<Document> results = new ArrayList<>();
        for (Document d : docs)
            if (d.docName.toLowerCase().contains(term.toLowerCase()) ||
                d.submittedBy.toLowerCase().contains(term.toLowerCase()) ||
                d.docId.toLowerCase().contains(term.toLowerCase())) results.add(d);
        if (results.isEmpty()) { System.out.println("No results for: " + term); return; }
        System.out.println("Found " + results.size() + " result(s):");
        for (Document d : results)
            System.out.println("  " + d.docId + " | " + d.docName + " | " + d.status);
    }

    public void showQR(String id) {
        Document doc = find(id);
        if (doc == null) { System.out.println("Not found!!"); return; }
        System.out.println("\nQR FILE  : " + doc.qrFile);
        System.out.println("Document : " + doc.docName);
        System.out.println("Status   : " + doc.status);
        try {
            File f = new File(doc.qrFile);
            if (f.exists()) System.out.println("Location : " + f.getAbsolutePath());
        } catch (Exception e) {}
        System.out.println("Scan the .png — your phone will open the live tracking page!");
    }

    public void demo() {
        System.out.println("\n" + repeat("=", 50));
        System.out.println("IDEA ENCRYPTION DEMO");
        System.out.println(repeat("=", 50));
        String msg = "FRANCISS";
        System.out.println("Message  : " + msg);
        System.out.println("Key      : " + IDEA.SECRET_KEY);
        String enc = idea.encrypt(msg);
        System.out.println("Encrypted: " + enc);
        System.out.println("Decrypted: " + idea.decrypt(enc));
        System.out.println("IDEA Works!!");

        // Also show a sample tracking URL
        System.out.println("\n[SAMPLE TRACKING URL]");
        System.out.println("Encrypted DocId: " + idea.encrypt("CIT-1001"));
    }

    private Document find(String id) {
        for (Document d : docs) if (d.docId.equals(id)) return d;
        return null;
    }
}

public class IDEA_CIT_Document_Tracker {
    private static String readLineTrim(Scanner sc) {
        return sc.hasNextLine() ? sc.nextLine().trim() : null;
    }
    private static String repeat(String s, int n) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) sb.append(s);
        return sb.toString();
    }

    public static void main(String[] args) {
        Scanner sc      = new Scanner(System.in);
        Tracker tracker = new Tracker();

        System.out.println(repeat("=", 55));
        System.out.println("  CIT DOCUMENT TRACKER");
        System.out.println("  IDEA Encryption - Group 6");
        System.out.println("  Key: " + IDEA.SECRET_KEY);
        System.out.println(repeat("=", 55));

        System.out.println("\n[Loading sample data...]");
        String id1 = tracker.addDocument("Enrollment Form",             "Academic",    "Juan dela Cruz", "2nd Semester Enrollment");
        String id2 = tracker.addDocument("Laboratory Request",          "Laboratory",  "Maria Santos",   "Lab Equipment Request");
        String id3 = tracker.addDocument("Certificate of Registration", "Academic",    "Pedro Reyes",    "COR for Scholarship");
        tracker.updateStatus(id1, "Processing",   "Being reviewed by registrar");
        tracker.updateStatus(id2, "For Approval", "Forwarded to department head");
        tracker.updateStatus(id3, "Released",     "COR released to student");

        while (true) {
            System.out.println("\n" + repeat("=", 55));
            System.out.println("  MAIN MENU");
            System.out.println(repeat("=", 55));
            System.out.println("1. Add Document");
            System.out.println("2. View All Documents");
            System.out.println("3. View Document Details");
            System.out.println("4. Update Status");
            System.out.println("5. Search Document");
            System.out.println("6. Show QR Code");
            System.out.println("7. IDEA Demo");
            System.out.println("8. Exit");
            System.out.print("Choice (1-8): ");

            String choice = readLineTrim(sc);
            if (choice == null) break;
            switch (choice) {
                case "1": {
                    System.out.print("Document Name: "); String name    = readLineTrim(sc); if (name    == null) return;
                    System.out.print("Document Type: "); String type    = readLineTrim(sc); if (type    == null) return;
                    System.out.print("Submitted By : "); String by      = readLineTrim(sc); if (by      == null) return;
                    System.out.print("Purpose      : "); String purpose = readLineTrim(sc); if (purpose == null) return;
                    if (!name.isEmpty() && !type.isEmpty() && !by.isEmpty() && !purpose.isEmpty())
                        tracker.addDocument(name, type, by, purpose);
                    else System.out.println("Fill in all fields!!");
                    break;
                }
                case "2": tracker.viewAll(); break;
                case "3": { System.out.print("Document ID: "); String id = readLineTrim(sc); if (id == null) return; tracker.viewDocument(id); break; }
                case "4": {
                    System.out.print("Document ID: "); String uid = readLineTrim(sc); if (uid == null) return;
                    System.out.println("Status: Received / Processing / For Approval / Approved / Released / Rejected");
                    System.out.print("New Status: "); String status = readLineTrim(sc); if (status == null) return;
                    System.out.print("Note (optional): "); String note = readLineTrim(sc); if (note == null) return;
                    tracker.updateStatus(uid, status, note);
                    break;
                }
                case "5": { System.out.print("Search: "); String term = readLineTrim(sc); if (term == null) return; tracker.search(term); break; }
                case "6": { System.out.print("Document ID: "); String id = readLineTrim(sc); if (id == null) return; tracker.showQR(id); break; }
                case "7": tracker.demo(); break;
                case "8":
                    System.out.println("Goodbye!! - Group 6 IDEA Algorithm");
                    sc.close(); return;
                default: System.out.println("Invalid choice!!");
            }
        }
    }
}
