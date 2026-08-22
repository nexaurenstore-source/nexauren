"use strict";

/*
 * NEXAUREN
 * Image Compressor
 *
 * Flow:
 * 1. Upload
 * 2. Adjust + Preview
 * 3. Download + Preview
 *
 * Image processing happens locally
 * inside the user's browser.
 */


/* =========================
   ELEMENTS
========================= */

const imageInput =
    document.getElementById("image-input");

const chooseImageButton =
    document.getElementById("choose-image");

const uploadArea =
    document.getElementById("upload-area");

const previewImage =
    document.getElementById("preview-image");

const resultImage =
    document.getElementById("result-image");

const outputFormat =
    document.getElementById("output-format");

const qualityInput =
    document.getElementById("quality");

const qualityValue =
    document.getElementById("quality-value");

const originalSize =
    document.getElementById("original-size");

const originalFormat =
    document.getElementById("original-format");

const imageDimensions =
    document.getElementById("image-dimensions");

const compressButton =
    document.getElementById("compress-image");

const changeImageButton =
    document.getElementById("change-image");

const downloadButton =
    document.getElementById("download-image");

const compressAnotherButton =
    document.getElementById("compress-another");

const resultOriginalSize =
    document.getElementById(
        "result-original-size"
    );

const resultCompressedSize =
    document.getElementById(
        "result-compressed-size"
    );

const resultSaved =
    document.getElementById(
        "result-saved"
    );

const toolStatus =
    document.getElementById("tool-status");

const steps =
    document.querySelectorAll(".step");

const stepContents =
    document.querySelectorAll(
        "[data-step-content]"
    );


/* =========================
   STATE
========================= */

let selectedFile = null;

let originalImage = null;

let originalPreviewUrl = null;

let resultBlob = null;

let resultUrl = null;


/* =========================
   SUPPORTED TYPES
========================= */

const supportedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
];


/* =========================
   INITIALIZATION
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        updateQualityLabel();

        setStep(1);

    }
);


/* =========================
   FILE SELECTION
========================= */

chooseImageButton.addEventListener(
    "click",
    () => {

        imageInput.click();

    }
);


changeImageButton.addEventListener(
    "click",
    () => {

        imageInput.click();

    }
);


imageInput.addEventListener(
    "change",
    () => {

        const file =
            imageInput.files &&
            imageInput.files[0];

        if (!file) {
            return;
        }

        handleFile(file);

    }
);


/* =========================
   DRAG & DROP
========================= */

[
    "dragenter",
    "dragover"
].forEach(eventName => {

    uploadArea.addEventListener(
        eventName,
        event => {

            event.preventDefault();

            event.stopPropagation();

            uploadArea.classList.add(
                "drag-over"
            );

        }
    );

});


[
    "dragleave",
    "dragend"
].forEach(eventName => {

    uploadArea.addEventListener(
        eventName,
        event => {

            event.preventDefault();

            event.stopPropagation();

            uploadArea.classList.remove(
                "drag-over"
            );

        }
    );

});


uploadArea.addEventListener(
    "drop",
    event => {

        event.preventDefault();

        event.stopPropagation();

        uploadArea.classList.remove(
            "drag-over"
        );

        const files =
            event.dataTransfer.files;

        if (!files || !files.length) {
            return;
        }

        handleFile(files[0]);

    }
);


/* =========================
   HANDLE FILE
========================= */

async function handleFile(file) {

    clearStatus();

    resetResult();

    if (!supportedTypes.includes(file.type)) {

        showStatus(
            "Please select a JPG, PNG or WebP image.",
            "error"
        );

        return;

    }


    /*
     * Basic safety limit.
     *
     * This protects the browser from
     * accidentally loading extremely
     * large files.
     */

    const maxFileSize =
        50 * 1024 * 1024;


    if (file.size > maxFileSize) {

        showStatus(
            "The image is too large. Maximum size is 50 MB.",
            "error"
        );

        return;

    }


    selectedFile = file;


    try {

        showStatus(
            "Loading image..."
        );


        const image =
            await loadImage(file);


        originalImage = image;


        if (originalPreviewUrl) {

            URL.revokeObjectURL(
                originalPreviewUrl
            );

        }


        originalPreviewUrl =
            URL.createObjectURL(file);


        previewImage.src =
            originalPreviewUrl;


        originalSize.textContent =
            formatBytes(file.size);


        originalFormat.textContent =
            getReadableFormat(file.type);


        imageDimensions.textContent =
            `${image.naturalWidth} × ${image.naturalHeight}`;


        showStatus(
            "Image loaded successfully.",
            "success"
        );


        setStep(2);

    } catch (error) {

        console.error(
            "Nexauren image load error:",
            error
        );


        showStatus(
            "Unable to read this image.",
            "error"
        );

    }

}


/* =========================
   LOAD IMAGE
========================= */

function loadImage(file) {

    return new Promise(
        (resolve, reject) => {

            const url =
                URL.createObjectURL(file);

            const image =
                new Image();


            image.onload = () => {

                URL.revokeObjectURL(url);

                resolve(image);

            };


            image.onerror = () => {

                URL.revokeObjectURL(url);

                reject(
                    new Error(
                        "Invalid image."
                    )
                );

            };


            image.src = url;

        }
    );

}


/* =========================
   QUALITY
========================= */

qualityInput.addEventListener(
    "input",
    updateQualityLabel
);


function updateQualityLabel() {

    const value =
        Number(
            qualityInput.value
        );


    qualityValue.textContent =
        `${value}%`;

}


/* =========================
   COMPRESS
========================= */

compressButton.addEventListener(
    "click",
    compressImage
);


async function compressImage() {

    if (!selectedFile || !originalImage) {

        showStatus(
            "Please select an image first.",
            "error"
        );

        return;

    }


    clearStatus();


    compressButton.disabled =
        true;


    compressButton.textContent =
        "Compressing...";


    try {

        const mimeType =
            outputFormat.value;


        const quality =
            Number(
                qualityInput.value
            ) / 100;


        /*
         * Canvas performs the conversion
         * locally in the browser.
         */

        const canvas =
            document.createElement(
                "canvas"
            );


        const width =
            originalImage.naturalWidth;

        const height =
            originalImage.naturalHeight;


        canvas.width =
            width;

        canvas.height =
            height;


        const context =
            canvas.getContext(
                "2d",
                {
                    alpha: true
                }
            );


        if (!context) {

            throw new Error(
                "Canvas is not supported."
            );

        }


        /*
         * For JPEG output, use a white
         * background because JPEG does
         * not support transparency.
         */

        if (
            mimeType ===
            "image/jpeg"
        ) {

            context.fillStyle =
                "#ffffff";

            context.fillRect(
                0,
                0,
                width,
                height
            );

        }


        context.drawImage(
            originalImage,
            0,
            0,
            width,
            height
        );


        const blob =
            await canvasToBlob(
                canvas,
                mimeType,
                quality
            );


        if (!blob) {

            throw new Error(
                "Image conversion failed."
            );

        }


        resultBlob =
            blob;


        if (resultUrl) {

            URL.revokeObjectURL(
                resultUrl
            );

        }


        resultUrl =
            URL.createObjectURL(
                resultBlob
            );


        resultImage.src =
            resultUrl;


        resultOriginalSize.textContent =
            formatBytes(
                selectedFile.size
            );


        resultCompressedSize.textContent =
            formatBytes(
                resultBlob.size
            );


        resultSaved.textContent =
            calculateReduction(
                selectedFile.size,
                resultBlob.size
            );


        setStep(3);


        showStatus(
            "Image compressed successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "Nexauren compression error:",
            error
        );


        showStatus(
            "Something went wrong while compressing the image.",
            "error"
        );

    } finally {

        compressButton.disabled =
            false;

        compressButton.textContent =
            "Compress Image";

    }

}


/* =========================
   CANVAS → BLOB
========================= */

function canvasToBlob(
    canvas,
    mimeType,
    quality
) {

    return new Promise(
        resolve => {

            canvas.toBlob(
                blob => {

                    resolve(blob);

                },
                mimeType,
                quality
            );

        }
    );

}


/* =========================
   DOWNLOAD
========================= */

downloadButton.addEventListener(
    "click",
    downloadImage
);


function downloadImage() {

    if (!resultBlob || !resultUrl) {

        showStatus(
            "There is no processed image to download.",
            "error"
        );

        return;

    }


    const extension =
        getExtension(
            resultBlob.type
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        resultUrl;


    link.download =
        createFileName(
            selectedFile,
            extension
        );


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();

}


/* =========================
   COMPRESS ANOTHER
========================= */

compressAnotherButton.addEventListener(
    "click",
    resetTool
);


function resetTool() {

    selectedFile =
        null;

    originalImage =
        null;

    resultBlob =
        null;


    if (originalPreviewUrl) {

        URL.revokeObjectURL(
            originalPreviewUrl
        );

        originalPreviewUrl =
            null;

    }


    if (resultUrl) {

        URL.revokeObjectURL(
            resultUrl
        );

        resultUrl =
            null;

    }


    previewImage.removeAttribute(
        "src"
    );


    resultImage.removeAttribute(
        "src"
    );


    imageInput.value =
        "";


    originalSize.textContent =
        "—";

    originalFormat.textContent =
        "—";

    imageDimensions.textContent =
        "—";

    resultOriginalSize.textContent =
        "—";

    resultCompressedSize.textContent =
        "—";

    resultSaved.textContent =
        "—";


    clearStatus();


    setStep(1);

}


/* =========================
   RESET RESULT
========================= */

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


    resultImage.removeAttribute(
        "src"
    );

}


/* =========================
   STEP SYSTEM
========================= */

function setStep(currentStep) {

    steps.forEach(
        step => {

            const stepNumber =
                Number(
                    step.dataset.step
                );


            step.classList.remove(
                "active",
                "completed"
            );


            if (
                stepNumber <
                currentStep
            ) {

                step.classList.add(
                    "completed"
                );

            }


            if (
                stepNumber ===
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

            const contentStep =
                Number(
                    content.dataset.stepContent
                );


            const isCurrent =
                contentStep ===
                currentStep;


            content.hidden =
                !isCurrent;

        }
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================
   STATUS
========================= */

function showStatus(
    message,
    type = ""
) {

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

    toolStatus.textContent =
        "";

    toolStatus.className =
        "tool-status";

}


/* =========================
   FORMAT BYTES
========================= */

function formatBytes(bytes) {

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


    const index =
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
            index
        );


    const decimals =
        index === 0
            ? 0
            : value >= 100
                ? 0
                : value >= 10
                    ? 1
                    : 2;


    return `${value.toFixed(decimals)} ${units[index]}`;

}


/* =========================
   REDUCTION
========================= */

function calculateReduction(
    original,
    compressed
) {

    if (
        !Number.isFinite(original) ||
        original <= 0
    ) {

        return "0%";

    }


    const reduction =
        (
            (original - compressed) /
            original
        ) * 100;


    /*
     * A conversion can occasionally
     * produce a file larger than the
     * original.
     */

    if (reduction <= 0) {

        return "0%";

    }


    return `${reduction.toFixed(1)}%`;

}


/* =========================
   FORMAT NAME
========================= */

function getReadableFormat(
    mimeType
) {

    const formats = {

        "image/jpeg":
            "JPEG",

        "image/png":
            "PNG",

        "image/webp":
            "WebP",

        "image/gif":
            "GIF"

    };


    return (
        formats[mimeType] ||
        mimeType ||
        "Unknown"
    );

}


/* =========================
   FILE EXTENSION
========================= */

function getExtension(
    mimeType
) {

    const extensions = {

        "image/jpeg":
            "jpg",

        "image/png":
            "png",

        "image/webp":
            "webp"

    };


    return (
        extensions[mimeType] ||
        "jpg"
    );

}


/* =========================
   FILE NAME
========================= */

function createFileName(
    file,
    extension
) {

    const originalName =
        file?.name ||
        "image";


    const lastDot =
        originalName.lastIndexOf(
            "."
        );


    const baseName =
        lastDot > 0
            ? originalName.substring(
                0,
                lastDot
            )
            : originalName;


    return `${baseName}-nexauren.${extension}`;

}


/* =========================
   CLEANUP
========================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (originalPreviewUrl) {

            URL.revokeObjectURL(
                originalPreviewUrl
            );

        }


        if (resultUrl) {

            URL.revokeObjectURL(
                resultUrl
            );

        }

    }
);
