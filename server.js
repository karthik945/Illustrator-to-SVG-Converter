const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Use robust CORS settings and serve the static frontend files
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.static(__dirname));

// Configure file storage
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// The main conversion route
app.post('/convert', upload.single('aiFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Error: No file uploaded.' });
    }
    const inputFile = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const outputDir = path.join(__dirname, 'converted');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
    const outputFileName = `${path.basename(req.file.filename, fileExtension)}.svg`;
    const finalOutputFile = path.join(outputDir, outputFileName);

    if (fileExtension === '.ai') {
        // --- LOGIC FOR .AI FILES: Use Inkscape ---
        console.log(`Using Inkscape for AI file: ${req.file.originalname}`);
        const command = `inkscape --export-filename="${finalOutputFile}" "${inputFile}"`;
        exec(command, (error) => {
            if (error) {
                console.error('Inkscape conversion failed:', error);
                return cleanupAndSendError(res, inputFile, { message: 'Inkscape conversion failed.' });
            }
            downloadFinalFile(res, inputFile, finalOutputFile);
        });

    } else if (fileExtension === '.eps') {
        // --- LOGIC FOR .EPS FILES: Use Ghostscript -> pdf2svg ---
        console.log(`Using Ghostscript -> pdf2svg for EPS file: ${req.file.originalname}`);
        const intermediatePdfFile = inputFile + '.pdf';
        const epsToPdfCommand = `gs -sDEVICE=pdfwrite -dEPSCrop -o "${intermediatePdfFile}" "${inputFile}"`;
        exec(epsToPdfCommand, (err1) => {
            if (err1) {
                console.error('Ghostscript (EPS to PDF) failed:', err1);
                return cleanupAndSendError(res, inputFile, { message: 'Ghostscript failed.' });
            }
            const pdfToSvgCommand = `pdf2svg "${intermediatePdfFile}" "${finalOutputFile}"`;
            exec(pdfToSvgCommand, (err2) => {
                fs.unlink(intermediatePdfFile, () => {});
                if (err2) {
                    console.error('pdf2svg failed:', err2);
                    return cleanupAndSendError(res, inputFile, { message: 'pdf2svg failed.' });
                }
                downloadFinalFile(res, inputFile, finalOutputFile);
            });
        });

    } else {
        cleanupAndSendError(res, inputFile, { message: `Unsupported file type: ${fileExtension}` });
    }
});

// Helper function to send the file to the user
function downloadFinalFile(res, inputFile, finalOutputFile) {
    console.log("Conversion successful. Sending file for download.");
    res.download(finalOutputFile, (err) => {
        if (err) console.error('Download error:', err);
        // Cleanup temporary files after download attempt
        fs.unlink(finalOutputFile, () => {});
        fs.unlink(inputFile, () => {});
    });
}

// Helper function to handle errors
function cleanupAndSendError(res, inputFile, errorPayload) {
    fs.unlink(inputFile, () => {}); // Always clean up the uploaded file
    res.status(500).json(errorPayload);
}

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});