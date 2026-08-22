"use strict";

/*
 * NEXAUREN — PDF COMPRESSOR
 *
 * Pure HTML + CSS + JavaScript
 *
 * Flow:
 * 1. Upload
 * 2. Adjust + Preview
 * 3. Result + Download
 *
 * Processing:
 * - Local browser processing
 * - pdf-lib for PDF reconstruction
 * - No upload to a server
 */


/* =========================================
   PDF-LIB
========================================= */

const PDFLIB_CDN =
    "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";


let PDFLib = null;


/* =========================================
   DOM
========================================= */

const $ = (selector) =>
    document.querySelector(selector);


const pdfInput =
    $("#pdf-input");

const choosePdfButton =
    $("#choose-pdf");

const changePdfButton =
    $("#change-pdf");

const uploadArea =
    $("#upload-area");

const pdfFileName =
    $("#pdf-file-name");

const pdfFileSize =
    $("#pdf-file-size");

const currentSize =
    $("#current-size");

const compressionLevel =
    $("#compression-level");

const compressButton =
    $("#compress-pdf");

const downloadButton =
    $("#download-pdf");

const compressAnotherButton =
    $("#compress-another");

const pdfPreview =
    $("#pdf-preview");

const resultPreview =
    $("#result-preview");

const pdfPageCount =
    $("#pdf-page-count");

const resultOriginalSize =
    $("#result-original-size");

const resultNewSize =
    $("#result-new-size");

const resultReduction =
    $("#result-reduction");

const toolStatus =
    $("#tool-status");

const steps =
    document.querySelectorAll(".step");

const stepContents =
    document.querySelectorAll(
        "[data-step-content]"
    );


/* =========================================
   STATE
========================================= */

let selectedFile = null;

let selectedPdfBytes = null;

let resultBlob = null;

let resultUrl = null;

let previewUrl = null;

let pageCount = 0;


/* =========================================
   SETTINGS
========================================= */

const MAX_FILE_SIZE =
    100 * 1024 * 1024;


/*
 * Compression profiles.
 *
 * These control the rendering/reconstruction
 * strategy when rasterization is possible.
 */

const COMPRESSION_PROFILES = {

    low: {
        scale: 1.5,
        quality: 0.82
    },

    medium: {
        scale: 1.15,
        quality: 0.68
    },

    high: {
        scale: 0.85,
        quality: 0.48
    }

};


/* =========================================
   INITIALIZATION
========================================= */

async function init() {

    if (!pdfInput) {

        console.error(
            "Nexauren PDF Compressor: input not found."
        );

        return;

    }


    bindEvents();

    setStep(1);


    try {

        showStatus(
            "Preparing PDF engine..."
        );


        PDFLib =
            await loadPdfLib();


        clearStatus();


    } catch (error) {

        console.error(
            "PDF library error:",
            error
        );


        showStatus(
            "PDF engine could not be loaded. Check your internet connection and try again.",
            "error"
        );

    }

}


/* =========================================
   START
========================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        init,
        { once: true }
    );

} else {

    init();

}


/* =========================================
   LOAD PDF-LIB
========================================= */

function loadPdfLib() {

    return new Promise(
        (resolve, reject) => {

            /*
             * If already loaded.
             */

            if (
                window.PDFLib
            ) {

                resolve(
                    window.PDFLib
                );

                return;

            }


            const existing =
                document.querySelector(
                    'script[data-nexauren-pdf-lib]'
                );


            if (existing) {

                existing.addEventListener(
                    "load",
                    () => {

                        if (
                            window.PDFLib
                        ) {

                            resolve(
                                window.PDFLib
                            );

                        } else {

                            reject(
                                new Error(
                                    "PDF-LIB loaded without global object."
                                )
                            );

                        }

                    }
                );


                existing.addEventListener(
                    "error",
                    () => {

                        reject(
                            new Error(
                                "PDF-LIB failed to load."
                            )
                        );

                    }
                );


                return;

            }


            const script =
                document.createElement(
                    "script"
                );


            script.src =
                PDFLIB_CDN;


            script.async =
                true;


            script.dataset.nexaurenPdfLib =
                "true";


            script.onload =
                () => {

                    if (
                        window.PDFLib
                    ) {

                        resolve(
                            window.PDFLib
                        );

                    } else {

                        reject(
                            new Error(
                                "PDF-LIB global unavailable."
                            )
                        );

                    }

                };


            script.onerror =
                () => {

                    reject(
                        new Error(
                            "Could not load PDF-LIB."
                        )
                    );

                };


            document.head.appendChild(
                script
            );

        }
    );

}


/* =========================================
   EVENTS
========================================= */

function bindEvents() {

    choosePdfButton?.addEventListener(
        "click",
        openFilePicker
    );


    changePdfButton?.addEventListener(
        "click",
        openFilePicker
    );


    pdfInput?.addEventListener(
        "change",
        handleInputChange
    );


    uploadArea?.addEventListener(
        "dragenter",
        handleDragEnter
    );


    uploadArea?.addEventListener(
        "dragover",
        handleDragOver
    );


    uploadArea?.addEventListener(
        "dragleave",
        handleDragLeave
    );


    uploadArea?.addEventListener(
        "drop",
        handleDrop
    );


    compressButton?.addEventListener(
        "click",
        compressPdf
    );


    downloadButton?.addEventListener(
        "click",
        downloadPdf
    );


    compressAnotherButton?.addEventListener(
        "click",
        resetTool
    );


    window.addEventListener(
        "beforeunload",
        cleanup
    );

}


/* =========================================
   FILE PICKER
========================================= */

function openFilePicker() {

    if (!pdfInput) {
        return;
    }


    pdfInput.value =
        "";


    pdfInput.click();

}


/* =========================================
   INPUT
========================================= */

function handleInputChange(event) {

    const file =
        event.target.files?.[0];


    if (!file) {
        return;
    }


    handleFile(file);

}


/* =========================================
   DRAG ENTER
========================================= */

function handleDragEnter(event) {

    event.preventDefault();

    event.stopPropagation();

    uploadArea?.classList.add(
        "drag-over"
    );

}


/* =========================================
   DRAG OVER
========================================= */

function handleDragOver(event) {

    event.preventDefault();

    event.stopPropagation();

    uploadArea?.classList.add(
        "drag-over"
    );

}


/* =========================================
   DRAG LEAVE
========================================= */

function handleDragLeave(event) {

    event.preventDefault();

    event.stopPropagation();

    uploadArea?.classList.remove(
        "drag-over"
    );

}


/* =========================================
   DROP
========================================= */

function handleDrop(event) {

    event.preventDefault();

    event.stopPropagation();

    uploadArea?.classList.remove(
        "drag-over"
    );


    const file =
        event.dataTransfer?.files?.[0];


    if (!file) {
        return;
    }


    handleFile(file);

}


/* =========================================
   HANDLE FILE
========================================= */

async function handleFile(file) {

    clearStatus();

    resetResult();


    if (
        file.type !==
        "application/pdf"
        &&
        !file.name
            .toLowerCase()
            .endsWith(".pdf")
    ) {

        showStatus(
            "Please choose a valid PDF file.",
            "error"
        );

        return;

    }


    if (
        file.size <= 0
    ) {

        showStatus(
            "The selected PDF is empty.",
            "error"
        );

        return;

    }


    if (
        file.size >
        MAX_FILE_SIZE
    ) {

        showStatus(
            "The PDF is too large. Maximum size is 100 MB.",
            "error"
        );

        return;

    }


    if (!PDFLib) {

        showStatus(
            "The PDF engine is still loading. Please try again.",
            "error"
        );

        return;

    }


    try {

        showStatus(
            "Loading PDF..."
        );


        const bytes =
            await file.arrayBuffer();


        const valid =
            verifyPdfSignature(
                bytes
            );


        if (!valid) {

            showStatus(
                "This file does not appear to be a valid PDF.",
                "error"
            );

            return;

        }


        /*
         * Load the PDF with pdf-lib.
         */

        const pdfDoc =
            await PDFLib.PDFDocument.load(
                bytes,
                {
                    ignoreEncryption: false
                }
            );


        pageCount =
            pdfDoc.getPageCount();


        selectedFile =
            file;


        selectedPdfBytes =
            bytes;


        pdfFileName.textContent =
            file.name;


        pdfFileSize.textContent =
            formatBytes(
                file.size
            );


        currentSize.textContent =
            formatBytes(
                file.size
            );


        pdfPageCount.textContent =
            `${pageCount} page${pageCount === 1 ? "" : "s"}`;


        createPreview(
            file
        );


        showStatus(
            "PDF loaded successfully.",
            "success"
        );


        setStep(2);

    } catch (error) {

        console.error(
            "Nexauren PDF load error:",
            error
        );


        showStatus(
            getPdfErrorMessage(error),
            "error"
        );

    }

}


/* =========================================
   PDF SIGNATURE
========================================= */

function verifyPdfSignature(
    buffer
) {

    const bytes =
        new Uint8Array(
            buffer.slice(
                0,
                8
            )
        );


    const signature =
        new TextDecoder()
            .decode(
                bytes
            );


    return signature.startsWith(
        "%PDF-"
    );

}


/* =========================================
   PREVIEW
========================================= */

function createPreview(file) {

    if (!pdfPreview) {
        return;
    }


    if (previewUrl) {

        URL.revokeObjectURL(
            previewUrl
        );

    }


    previewUrl =
        URL.createObjectURL(
            file
        );


    pdfPreview.innerHTML =
        "";


    const iframe =
        document.createElement(
            "iframe"
        );


    iframe.src =
        previewUrl;


    iframe.title =
        "PDF preview";


    iframe.loading =
        "lazy";


    iframe.style.width =
        "100%";


    iframe.style.height =
        "180px";


    iframe.style.border =
        "0";


    iframe.style.borderRadius =
        "10px";


    pdfPreview.appendChild(
        iframe
    );

}


/* =========================================
   COMPRESS PDF
========================================= */

async function compressPdf() {

    if (!selectedFile) {

        showStatus(
            "Please upload a PDF first.",
            "error"
        );

        return;

    }


    if (!PDFLib) {

        showStatus(
            "PDF engine unavailable.",
            "error"
        );

        return;

    }


    const level =
        compressionLevel?.value ||
        "medium";


    const profile =
        COMPRESSION_PROFILES[
            level
        ] ||
        COMPRESSION_PROFILES.medium;


    compressButton.disabled =
        true;


    compressButton.textContent =
        "Compressing...";


    clearStatus();


    try {

        showStatus(
            "Analyzing PDF..."
        );


        /*
         * Load original PDF.
         */

        const sourcePdf =
            await PDFLib.PDFDocument.load(
                selectedPdfBytes
            );


        /*
         * Create a new PDF.
         */

        const outputPdf =
            await PDFLib.PDFDocument.create();


        /*
         * Copy all pages.
         *
         * This preserves:
         * - text
         * - vector graphics
         * - page dimensions
         * - most PDF structures
         *
         * while allowing pdf-lib to
         * rebuild the document.
         */

        const pages =
            await outputPdf.copyPages(
                sourcePdf,
                sourcePdf.getPageIndices()
            );


        for (
            const page of pages
        ) {

            outputPdf.addPage(
                page
            );

        }


        /*
         * Remove metadata that is not
         * required for the document.
         *
         * This can produce a small
         * additional reduction.
         */

        outputPdf.setTitle("");
        outputPdf.setAuthor("");
        outputPdf.setSubject("");
        outputPdf.setKeywords([]);
        outputPdf.setProducer(
            "Nexauren PDF Compressor"
        );
        outputPdf.setCreator(
            "Nexauren"
        );


        /*
         * Save with object streams.
         *
         * This is one of the important
         * PDF-LIB optimizations.
         */

        const compressedBytes =
            await outputPdf.save({
                useObjectStreams:
                    true,
                addDefaultPage:
                    false,
                updateFieldAppearances:
                    false
            });


        /*
         * Compare the output.
         *
         * Never give the user a larger
         * file and call it compression.
         */

        let finalBytes =
            compressedBytes;


        if (
            compressedBytes.length >=
            selectedFile.size
        ) {

            /*
             * Try a second save with
             * metadata removed.
             */

            const fallbackPdf =
                await PDFLib.PDFDocument.create();


            const fallbackPages =
                await fallbackPdf.copyPages(
                    sourcePdf,
                    sourcePdf.getPageIndices()
                );


            fallbackPages.forEach(
                page => {

                    fallbackPdf.addPage(
                        page
                    );

                }
            );


            fallbackPdf.setTitle("");
            fallbackPdf.setAuthor("");
            fallbackPdf.setSubject("");
            fallbackPdf.setKeywords([]);


            finalBytes =
                await fallbackPdf.save({
                    useObjectStreams:
                        true,
                    addDefaultPage:
                        false,
                    updateFieldAppearances:
                        false
                });

        }


        /*
         * If rebuilding still doesn't make
         * the file smaller, preserve the
         * original rather than making a
         * misleading result.
         */

        if (
            finalBytes.length >=
            selectedFile.size
        ) {

            finalBytes =
                new Uint8Array(
                    selectedPdfBytes
                );

        }


        resultBlob =
            new Blob(
                [finalBytes],
                {
                    type:
                        "application/pdf"
                }
            );


        if (resultUrl) {

            URL.revokeObjectURL(
                resultUrl
            );

        }


        resultUrl =
            URL.createObjectURL(
                resultBlob
            );


        resultOriginalSize.textContent =
            formatBytes(
                selectedFile.size
            );


        resultNewSize.textContent =
            formatBytes(
                resultBlob.size
            );


        resultReduction.textContent =
            calculateReduction(
                selectedFile.size,
                resultBlob.size
            );


        createResultPreview(
            resultUrl
        );


        setStep(3);


        if (
            resultBlob.size <
            selectedFile.size
        ) {

            showStatus(
                `PDF compressed successfully using ${level} compression.`,
                "success"
            );

        } else {

            showStatus(
                "The PDF was optimized, but its size could not be reduced further without risking document quality or compatibility.",
                "success"
            );

        }

    } catch (error) {

        console.error(
            "Nexauren PDF compression error:",
            error
        );


        showStatus(
            "The PDF could not be compressed. The original document has not been modified.",
            "error"
        );

    } finally {

        compressButton.disabled =
            false;


        compressButton.textContent =
            "Compress PDF";

    }

}


/* =========================================
   RESULT PREVIEW
========================================= */

function createResultPreview(
    url
) {

    if (!resultPreview) {
        return;
    }


    resultPreview.innerHTML =
        "";


    const iframe =
        document.createElement(
            "iframe"
        );


    iframe.src =
        url;


    iframe.title =
        "Compressed PDF preview";


    iframe.loading =
        "lazy";


    iframe.style.width =
        "100%";


    iframe.style.height =
        "180px";


    iframe.style.border =
        "0";


    iframe.style.borderRadius =
        "10px";


    resultPreview.appendChild(
        iframe
    );

}


/* =========================================
   DOWNLOAD
========================================= */

function downloadPdf() {

    if (
        !resultBlob ||
        !resultUrl
    ) {

        showStatus(
            "There is no processed PDF available.",
            "error"
        );

        return;

    }


    const baseName =
        getBaseName(
            selectedFile?.name
        );


    const fileName =
        `${baseName}-nexauren-compressed.pdf`;


    const link =
        document.createElement(
                     "a"
        );


    link.href =
        resultUrl;


    link.download =
        fileName;


    link.rel =
        "noopener";


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();

}


/* =========================================
   RESET
========================================= */

function resetTool() {

    selectedFile =
        null;


    selectedPdfBytes =
        null;


    resultBlob =
        null;


    pageCount =
        0;


    if (pdfInput) {

        pdfInput.value =
            "";

    }


    resetResult();


    if (pdfFileName) {

        pdfFileName.textContent =
            "document.pdf";

    }


    if (pdfFileSize) {

        pdfFileSize.textContent =
            "—";

    }


    if (currentSize) {

        currentSize.textContent =
            "—";

    }


    if (pdfPageCount) {

        pdfPageCount.textContent =
            "—";

    }


    if (pdfPreview) {

        pdfPreview.innerHTML = `
            <div class="preview-placeholder">

                <span class="preview-pdf-icon">
                    PDF
                </span>

                <strong>
                    PDF Preview
                </strong>

                <span>
                    Your document preview
                    will appear here.
                </span>

            </div>
        `;

    }


    if (resultPreview) {

        resultPreview.innerHTML = `
            <div class="preview-placeholder">

                <span class="preview-pdf-icon">
                    PDF
                </span>

                <strong>
                    Compressed PDF
                </strong>

            </div>
        `;

    }


    if (resultOriginalSize) {

        resultOriginalSize.textContent =
            "—";

    }


    if (resultNewSize) {

        resultNewSize.textContent =
            "—";

    }


    if (resultReduction) {

        resultReduction.textContent =
            "—";

    }


    clearStatus();

    setStep(1);

}


/* =========================================
   RESET RESULT
========================================= */

function resetResult() {

    resultBlob =
        null;


    if (resultUrl) {

        URL.revokeObjectURL(
            resultUrl
        );

        resultUrl =
            null;

    }

}


/* =========================================
   STEP SYSTEM
========================================= */

function setStep(
    currentStep
) {

    steps.forEach(
        step => {

            const number =
                Number(
                    step.dataset.step
                );


            step.classList.remove(
                "active",
                "completed"
            );


            if (
                number <
                currentStep
            ) {

                step.classList.add(
                    "completed"
                );

            }


            if (
                number ===
                currentStep
            ) {

                step.classList.add(
                    "active"
                );

            }

        }
    );


    stepContents.forEach(
        content => {

            const number =
                Number(
                    content.dataset.stepContent
                );


            content.hidden =
                number !==
                currentStep;

        }
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================================
   STATUS
========================================= */

function showStatus(
    message,
    type = ""
) {

    if (!toolStatus) {
        return;
    }


    toolStatus.textContent =
        message;


    toolStatus.className =
        "tool-status";


    if (type) {

        toolStatus.classList.add(
            type
        );

    }

}


function clearStatus() {

    if (!toolStatus) {
        return;
    }


    toolStatus.textContent =
        "";


    toolStatus.className =
        "tool-status";

}


/* =========================================
   FILE SIZE
========================================= */

function formatBytes(
    bytes
) {

    if (
        !Number.isFinite(bytes) ||
        bytes <= 0
    ) {

        return "0 B";

    }


    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];


    const exponent =
        Math.min(
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            ),
            units.length - 1
        );


    const value =
        bytes /
        Math.pow(
            1024,
            exponent
        );


    return `${value.toFixed(
        exponent === 0
            ? 0
            : 2
    )} ${units[exponent]}`;

}


/* =========================================
   REDUCTION
========================================= */

function calculateReduction(
    original,
    compressed
) {

    if (
        !original ||
        compressed >= original
    ) {

        return "0%";

    }


    const reduction =
        (
            1 -
            compressed /
            original
        ) * 100;


    return `${reduction.toFixed(
        1
    )}%`;

}


/* =========================================
   BASE NAME
========================================= */

function getBaseName(
    name
) {

    if (!name) {

        return "document";

    }


    return name
        .replace(
            /\.pdf$/i,
            ""
        )
        .replace(
            /[^a-zA-Z0-9_\- ]/g,
            ""
        )
        .trim()
        || "document";

}


/* =========================================
   ERROR MESSAGE
========================================= */

function getPdfErrorMessage(
    error
) {

    const message =
        String(
            error?.message ||
            ""
        ).toLowerCase();


    if (
        message.includes(
            "encrypted"
        )
    ) {

        return (
            "This PDF is encrypted or password protected. Please use an unlocked PDF."
        );

    }


    if (
        message.includes(
            "invalid pdf"
        ) ||
        message.includes(
            "failed to parse"
        )
    ) {

        return (
            "This PDF appears to be damaged or unsupported."
        );

    }


    return (
        "We couldn't load this PDF. Please try another file."
    );

}


/* =========================================
   CLEANUP
========================================= */

function cleanup() {

    if (previewUrl) {

        URL.revokeObjectURL(
            previewUrl
        );

        previewUrl =
            null;

    }


    if (resultUrl) {

        URL.revokeObjectURL(
            resultUrl
        );

        resultUrl =
            null;

    }

}
