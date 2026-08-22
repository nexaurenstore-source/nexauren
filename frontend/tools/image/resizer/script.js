"use strict";

/*
 * NEXAUREN — IMAGE RESIZER
 *
 * 1. Upload
 * 2. Resize + Preview
 * 3. Download
 *
 * All image processing happens locally
 * in the user's browser.
 */


/* =========================================
   DOM
========================================= */

const $ = (selector) =>
    document.querySelector(selector);

const imageInput = $("#image-input");
const chooseImageButton = $("#choose-image");
const changeImageButton = $("#change-image");
const uploadArea = $("#upload-area");

const previewImage = $("#preview-image");
const resultImage = $("#result-image");

const originalDimensions = $("#original-dimensions");

const widthInput = $("#width");
const heightInput = $("#height");

const lockRatio = $("#lock-ratio");
const preset = $("#preset");

const outputFormat = $("#output-format");

const qualityInput = $("#quality");
const qualityValue = $("#quality-value");

const resizeButton = $("#resize-image");
const downloadButton = $("#download-image");
const resizeAnotherButton = $("#resize-another");

const resultOriginalDimensions =
    $("#result-original-dimensions");

const resultNewDimensions =
    $("#result-new-dimensions");

const resultFileSize =
    $("#result-file-size");

const toolStatus = $("#tool-status");

const steps =
    document.querySelectorAll(".step");

const stepContents =
    document.querySelectorAll("[data-step-content]");


/* =========================================
   STATE
========================================= */

let selectedFile = null;
let originalImage = null;

let originalWidth = 0;
let originalHeight = 0;

let aspectRatio = 1;

let originalPreviewUrl = null;
let resultUrl = null;
let resultBlob = null;


/* =========================================
   SETTINGS
========================================= */

const supportedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

const MAX_FILE_SIZE =
    50 * 1024 * 1024;

const MAX_DIMENSION = 12000;


/* =========================================
   INITIALIZATION
========================================= */

function init() {

    if (!imageInput) {
        console.error(
            "Nexauren Resizer: image input not found."
        );
        return;
    }

    bindEvents();

    updateQualityLabel();

    setStep(1);

}


if (
    document.readyState === "loading"
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
   EVENTS
========================================= */

function bindEvents() {

    chooseImageButton?.addEventListener(
        "click",
        openFilePicker
    );


    changeImageButton?.addEventListener(
        "click",
        openFilePicker
    );


    imageInput.addEventListener(
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


    widthInput?.addEventListener(
        "input",
        handleWidthChange
    );


    heightInput?.addEventListener(
        "input",
        handleHeightChange
    );


    lockRatio?.addEventListener(
        "change",
        handleRatioChange
    );


    preset?.addEventListener(
        "change",
        handlePresetChange
    );


    qualityInput?.addEventListener(
        "input",
        updateQualityLabel
    );


    resizeButton?.addEventListener(
        "click",
        resizeImage
    );


    downloadButton?.addEventListener(
        "click",
        downloadImage
    );


    resizeAnotherButton?.addEventListener(
        "click",
        resetTool
    );


    window.addEventListener(
        "beforeunload",
        cleanupUrls
    );

}


/* =========================================
   FILE PICKER
========================================= */

function openFilePicker() {

    if (!imageInput) {
        return;
    }

    imageInput.value = "";

    imageInput.click();

}


/* =========================================
   INPUT CHANGE
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
   DRAG & DROP
========================================= */

function handleDragEnter(event) {

    event.preventDefault();
    event.stopPropagation();

    uploadArea?.classList.add(
        "drag-over"
    );

}


function handleDragOver(event) {

    event.preventDefault();
    event.stopPropagation();

    uploadArea?.classList.add(
        "drag-over"
    );

}


function handleDragLeave(event) {

    event.preventDefault();
    event.stopPropagation();

    uploadArea?.classList.remove(
        "drag-over"
    );

}


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


    if (!supportedTypes.includes(file.type)) {

        showStatus(
            "Unsupported image. Please choose JPG, PNG or WebP.",
            "error"
        );

        return;

    }


    if (file.size <= 0) {

        showStatus(
            "The selected file is empty.",
            "error"
        );

        return;

    }


    if (file.size > MAX_FILE_SIZE) {

        showStatus(
            "The image is too large. Maximum file size is 50 MB.",
            "error"
        );

        return;

    }


    try {

        showStatus(
            "Loading image..."
        );


        const image =
            await createImageFromFile(file);


        const width =
            image.naturalWidth ||
            image.width;

        const height =
            image.naturalHeight ||
            image.height;


        if (
            !width ||
            !height
        ) {

            throw new Error(
                "Image dimensions could not be detected."
            );

        }


        if (
            width > MAX_DIMENSION ||
            height > MAX_DIMENSION
        ) {

            showStatus(
                `Maximum supported dimension is ${MAX_DIMENSION} × ${MAX_DIMENSION} pixels.`,
                "error"
            );

            return;

        }


        selectedFile =
            file;

        originalImage =
            image;

        originalWidth =
            width;

        originalHeight =
            height;

        aspectRatio =
            width / height;


        replaceOriginalPreview(file);


        widthInput.value =
            width;

        heightInput.value =
            height;


        originalDimensions.textContent =
            `${width} × ${height} px`;


        preset.value =
            "custom";


        showStatus(
            "Image loaded successfully.",
            "success"
        );


        setStep(2);

    } catch (error) {

        console.error(
            "Nexauren Resizer upload error:",
            error
        );


        showStatus(
            "We couldn't load this image. Please try another JPG, PNG or WebP file.",
            "error"
        );

    }

}


/* =========================================
   CREATE IMAGE FROM FILE
========================================= */

function createImageFromFile(file) {

    return new Promise(
        (resolve, reject) => {

            const url =
                URL.createObjectURL(file);

            const image =
                new Image();


            image.decoding =
                "async";


            image.onload =
                () => {

                    URL.revokeObjectURL(
                        url
                    );

                    resolve(image);

                };


            image.onerror =
                () => {

                    URL.revokeObjectURL(
                        url
                    );

                    reject(
                        new Error(
                            "Browser could not decode image."
                        )
                    );

                };


            image.src =
                url;

        }
    );

}


/* =========================================
   PREVIEW
========================================= */

function replaceOriginalPreview(file) {

    if (originalPreviewUrl) {

        URL.revokeObjectURL(
            originalPreviewUrl
        );

    }


    originalPreviewUrl =
        URL.createObjectURL(file);


    previewImage.src =
        originalPreviewUrl;


    previewImage.onload =
        () => {

            previewImage.style.display =
                "block";

        };


    previewImage.onerror =
        () => {

            showStatus(
                "Preview could not be displayed.",
                "error"
            );

        };

}


/* =========================================
   WIDTH
========================================= */

function handleWidthChange() {

    preset.value =
        "custom";


    if (
        !lockRatio.checked ||
        !originalImage
    ) {
        return;
    }


    const width =
        Number(widthInput.value);


    if (
        !Number.isFinite(width) ||
        width <= 0
    ) {
        return;
    }


    const height =
        Math.round(
            width / aspectRatio
        );


    heightInput.value =
        height;

}


/* =========================================
   HEIGHT
========================================= */

function handleHeightChange() {

    preset.value =
        "custom";


    if (
        !lockRatio.checked ||
        !originalImage
    ) {
        return;
    }


    const height =
        Number(heightInput.value);


    if (
        !Number.isFinite(height) ||
        height <= 0
    ) {
        return;
    }


    const width =
        Math.round(
            height * aspectRatio
        );


    widthInput.value =
        width;

}


/* =========================================
   RATIO
========================================= */

function handleRatioChange() {

    if (
        !lockRatio.checked ||
        !originalImage
    ) {
        return;
    }


    const width =
        Number(widthInput.value);


    if (
        Number.isFinite(width) &&
        width > 0
    ) {

        heightInput.value =
            Math.round(
                width / aspectRatio
            );

    }

}


/* =========================================
   PRESETS
========================================= */

function handlePresetChange() {

    const value =
        preset.value;


    if (
        value === "custom"
    ) {
        return;
    }


    const targetWidth =
        Number(value);


    if (
        !originalImage ||
        !Number.isFinite(targetWidth)
    ) {
        return;
    }


    const targetHeight =
        Math.round(
            targetWidth / aspectRatio
        );


    widthInput.value =
        targetWidth;

    heightInput.value =
        targetHeight;

}


/* =========================================
   QUALITY
========================================= */

function updateQualityLabel() {

    if (!qualityInput || !qualityValue) {
        return;
    }


    qualityValue.textContent =
        `${qualityInput.value}%`;

}


/* =========================================
   RESIZE
========================================= */

async function resizeImage() {

    if (
        !selectedFile ||
        !originalImage
    ) {

        showStatus(
            "Please upload an image first.",
            "error"
        );

        return;

    }


    const targetWidth =
        Number(widthInput.value);

    const targetHeight =
        Number(heightInput.value);


    if (
        !Number.isInteger(targetWidth) ||
        !Number.isInteger(targetHeight) ||
        targetWidth < 1 ||
        targetHeight < 1
    ) {

        showStatus(
            "Enter a valid width and height.",
            "error"
        );

        return;

    }


    if (
        targetWidth > MAX_DIMENSION ||
        targetHeight > MAX_DIMENSION
    ) {

        showStatus(
            `Maximum supported dimension is ${MAX_DIMENSION} × ${MAX_DIMENSION} pixels.`,
            "error"
        );

        return;

    }


    resizeButton.disabled =
        true;

    resizeButton.textContent =
        "Resizing...";


    try {

        const canvas =
            document.createElement(
                "canvas"
            );


        canvas.width =
            targetWidth;

        canvas.height =
            targetHeight;


        const context =
            canvas.getContext(
                "2d"
            );


        if (!context) {

            throw new Error(
                "Canvas is unavailable."
            );

        }


        context.imageSmoothingEnabled =
            true;

        context.imageSmoothingQuality =
            "high";


        /*
         * JPG does not support
         * transparent backgrounds.
         */

        if (
            outputFormat.value ===
            "image/jpeg"
        ) {

            context.fillStyle =
                "#ffffff";

            context.fillRect(
                0,
                0,
                targetWidth,
                targetHeight
            );

        }


        context.drawImage(
            originalImage,
            0,
            0,
            targetWidth,
            targetHeight
        );


        const quality =
            Number(
                qualityInput.value
            ) / 100;


        const blob =
            await canvasToBlob(
                canvas,
                outputFormat.value,
                quality
            );


        if (!blob) {

            throw new Error(
                "Could not create output image."
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
                blob
            );


        resultImage.src =
            resultUrl;


        resultOriginalDimensions.textContent =
            `${originalWidth} × ${originalHeight}`;


        resultNewDimensions.textContent =
            `${targetWidth} × ${targetHeight}`;


        resultFileSize.textContent =
            formatBytes(blob.size);


        setStep(3);

        showStatus(
            "Image resized successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "Nexauren Resizer processing error:",
            error
        );


        showStatus(
            "The image could not be resized. Please try again.",
            "error"
        );

    } finally {

        resizeButton.disabled =
            false;

        resizeButton.textContent =
            "Resize Image";

    }

}


/* =========================================
   CANVAS → BLOB
========================================= */

function canvasToBlob(
    canvas,
    type,
    quality
) {

    return new Promise(
        (resolve, reject) => {

            canvas.toBlob(
                blob => {

                    if (!blob) {

                        reject(
                            new Error(
                                "Canvas conversion failed."
                            )
                        );

                        return;

                    }

                    resolve(blob);

                },
                type,
                quality
            );

        }
    );

}


/* =========================================
   DOWNLOAD
========================================= */

function downloadImage() {

    if (
        !resultBlob ||
        !resultUrl
    ) {

        showStatus(
            "There is no resized image available.",
            "error"
        );

        return;

    }


    const extension =
        getExtension(
            resultBlob.type
        );


    const baseName =
        getBaseName(
            selectedFile?.name
        );


    const fileName =
        `${baseName}-nexauren-resized.${extension}`;


    const link =
        document.createElement(
            "a"
        );


    link.href =
        resultUrl;

    link.download =
        fileName;


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

    originalImage =
        null;

    originalWidth =
        0;

    originalHeight =
        0;

    aspectRatio =
        1;

    resultBlob =
        null;


    cleanupUrls();


    imageInput.value =
        "";


    previewImage.removeAttribute(
        "src"
    );

    resultImage.removeAttribute(
        "src"
    );


    originalDimensions.textContent =
        "—";


    resultOriginalDimensions.textContent =
        "—";

    resultNewDimensions.textContent =
        "—";

    resultFileSize.textContent =
        "—";


    widthInput.value =
        "";

    heightInput.value =
        "";


    preset.value =
        "custom";


    clearStatus();

    setStep(1);

}


/* =========================================
   RESULT RESET
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


    resultImage.removeAttribute(
        "src"
    );

}


/* =========================================
   STEP SYSTEM
========================================= */

function setStep(currentStep) {

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
                number < currentStep
            ) {

                step.classList.add(
                    "completed"
                );

            }


            if (
                number === currentStep
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
                number !== currentStep;

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


    let decimals = 2;


    if (index === 0) {

        decimals = 0;

    } else if (value >= 100) {

        decimals = 0;

    } else if (value >= 10) {

        decimals = 1;

    }


    return `${value.toFixed(decimals)} ${units[index]}`;

}


/* =========================================
   EXTENSION
========================================= */

function getExtension(type) {

    const extensions = {

        "image/jpeg": "jpg",

        "image/png": "png",

        "image/webp": "webp"

    };


    return (
        extensions[type] ||
        "png"
    );

}


/* =========================================
   BASE NAME
========================================= */

function getBaseName(fileName) {

    if (!fileName) {

        return "image";

    }


    const lastDot =
        fileName.lastIndexOf(".");


    if (lastDot <= 0) {

        return fileName;

    }


    return fileName.substring(
        0,
        lastDot
    );

}


/* =========================================
   URL CLEANUP
========================================= */

function cleanupUrls() {

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

}
