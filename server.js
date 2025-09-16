const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// === Middleware Setup ===
// THE FINAL, MOST ROBUST FIX FOR CORS:
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));

// Handle preflight requests explicitly
app.options('*', cors());

// This middleware will serve your index.html from the root
app.use(express.static(__dirname)); 


const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });


// === Routes ===
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

    if (fileExtension === '.eps') {
        const intermediatePdfFile = inputFile + '.pdf';
        const epsToPdfCommand = `gs -sDEVICE=pdfwrite -dEPSCrop -o "${intermediatePdfFile}" "${inputFile}"`;
        console.log("Attempting to execute command:", epsToPdfCommand);
        exec(epsToPdfCommand, (err1) => {
            if (err1) {
                console.error('Ghostscript (EPS to PDF) failed:', err1);
                return cleanupAndSendError(res, inputFile, { message: 'Ghostscript conversion failed.' });
            }
            const pdfToSvgCommand = `pdf2svg "${intermediatePdfFile}" "${finalOutputFile}"`;
            console.log("Attempting to execute command:", pdfToSvgCommand);
            exec(pdfToSvgCommand, (err2) => {
                fs.unlink(intermediatePdfFile, () => {});
                if (err2) {
                    console.error('pdf2svg failed:', err2);
                    return cleanupAndSendError(res, inputFile, { message: 'pdf2svg conversion failed.' });
                }
                downloadFinalFile(res, inputFile, finalOutputFile);
            });
        });
    } else if (fileExtension === '.ai') {
        const command = `pdf2svg "${inputFile}" "${finalOutputFile}"`;
        console.log("Attempting to execute command:", command);
        exec(command, (error) => {
            if (error) {
                console.error('AI conversion failed:', error);
                return cleanupAndSendError(res, inputFile, { message: 'AI conversion failed.' });
            }
            downloadFinalFile(res, inputFile, finalOutputFile);
        });
    } else {
        cleanupAndSendError(res, inputFile, { message: `Unsupported file type: ${fileExtension}` });
    }
});

function downloadFinalFile(res, inputFile, finalOutputFile) {
    console.log("Conversion successful. Sending file for download.");
    res.download(finalOutputFile, (err) => {
        if (err) console.error('Download error:', err);
        fs.unlink(finalOutputFile, () => {});
        fs.unlink(inputFile, () => {});
    });
}
function cleanupAndSendError(res, inputFile, errorPayload) {
    fs.unlink(inputFile, () => {});
    res.status(500).json(errorPayload);
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});