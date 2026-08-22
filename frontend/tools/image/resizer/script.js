"use strict";

/*
 * NEXAUREN
 * Image Resizer
 *
 * Flow:
 * 1. Upload
 * 2. Resize + Preview
 * 3. Download
 *
 * Processing happens locally
 * inside the user's browser.
 */


/* =========================
   ELEMENTS
========================= */

const imageInput =
    document.getElementById("image-input");

const chooseImageButton =
    document.getElementById("choose-image");

const changeImageButton =
    document.getElementById("change-image");

const uploadArea =
    document.getElementById("upload-area");

const previewImage =
    document.getElementById("preview-image");

const resultImage =
    document.getElementById("result-image");

const originalDimensions =
    document.getElementById(
        "original-dimensions"
    );

const widthInput =
    document.getElementById("width");

const heightInput =
    document.getElementById("height");

const lockRatio =
    document.getElementById("lock-ratio");

const preset =
    document.getElementById("preset");

const outputFormat =
    document.getElementById(
        "output-format"
    );

const qualityInput =
    document.getElementById("quality");

const qualityValue =
    document.getElementById(
        "quality-value"
    );

const resizeButton =
    document.getElementById(
        "resize-image"
    );

const downloadButton =
    document.getElementById(
        "download-image"
    );

const resizeAnotherButton =
    document.getElementById(
        "resize-another"
    );

const resultOriginalDimensions =
    document.getElementById(
        "result-original-dimensions"
    );

const resultNewDimensions =
    document.getElementById(
        "result-new-dimensions"
    );

const resultFileSize =
    document.getElementById(
        "result-file-size"
    );

const toolStatus =
    document.getElementById(
        "tool-status"
    );

const steps =
    document.querySelectorAll(
        ".step"
    );

const stepContents =
    document.querySelectorAll(
        "[data-step-content]"
    );


/* =========================
   STATE
========================= */

let selectedFile = null;

let originalImage = null;

let originalWidth = 0;

let originalHeight = 0;

let aspectRatio = 1;

let originalPreviewUrl = null;

let resultBlob = null;

let resultUrl = null;


/* =========================
   CONSTANTS
========================= */

const supportedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
];

const maxFileSize =
    50 * 1024 * 1024;

const maxDimension =
    12000;


/* =========================
   INITIALIZE
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        updateQualityLabel();

        setStep(1);

    }
);


/* =========================
   OPEN FILE PICKER
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
].forEach(
    eventName => {

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

    }
);


[
    "dragleave",
    "dragend"
].forEach(
    eventName => {

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

    }
);


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

        if (
            !files ||
            !files.length
        ) {
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


    if (
        !supportedTypes.includes(
            file.type
        )
    ) {

        showStatus(
            "Please select a JPG, PNG or WebP image.",
            "error"
        );

        return;

    }


    if (
        file.size >
        maxFileSize
    ) {

        showStatus(
            "The image is too large. Maximum size is 50 MB.",
            "error"
        );

        return;

    }


    try {

        showStatus(
            "Loading image..."
        );


        const image =
            await loadImage(file);


        selectedFile =
            file;

        originalImage =
            image;


        originalWidth =
            image.naturalWidth;

        originalHeight =
            image.naturalHeight;


        if (
            originalWidth >
            maxDimension ||
            originalHeight >
            maxDimension
        ) {

            showStatus(
                "This image exceeds the maximum supported dimension of 12000 × 12000 pixels.",
                "error"
            );

            return;

        }


        aspectRatio =
            originalWidth /
            originalHeight;


        if (originalPreviewUrl) {

            URL.revokeObjectURL(
                originalPreviewUrl
            );

        }


        originalPreviewUrl =
            URL.createObjectURL(
                file
            );


        previewImage.src =
            originalPreviewUrl;


        originalDimensions.textContent =
            `${originalWidth} × ${originalHeight} px`;


        widthInput.value =
            originalWidth;

        heightInput.value =
            originalHeight;


        preset.value =
            "custom";


        showStatus(
            "Image loaded successfully.",
            "success"
        );


        setStep(2);

    } catch (error) {

        console.error(
            "Nexauren image loading error:",
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
                URL.createObjectURL(
                    file
                );

            const image =
                new Image();


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
                            "Invalid image."
                        )
                    );

                };


            image.src =
                url;

        }
    );

}


/* =========================
   WIDTH CHANGE
========================= */

widthInput.addEventListener(
    "input",
    () => {

        preset.value =
            "custom";


        if (
            !lockRatio.checked ||
            !originalImage
        ) {

            return;

        }


        const width =
            Number(
                widthInput.value
            );


        if (
            !Number.isFinite(width) ||
            width <= 0
        ) {

            return;

        }


        const height =
            Math.round(
                width /
                aspectRatio
            );


        heightInput.value =
            height;

    }
);


/* =========================
   HEIGHT CHANGE
========================= */

heightInput.addEventListener(
    "input",
    () => {

        preset.value =
            "custom";


        if (
            !lockRatio.checked ||
            !originalImage
        ) {

            return;

        }


        const height =
            Number(
                heightInput.value
            );


        if (
            !Number.isFinite(height) ||
            height <= 0
        ) {

            return;

        }


        const width =
            Math.round(
                height *
                aspectRatio
            );


        widthInput.value =
            width;

    }
);


/* =========================
   LOCK RATIO
========================= */

lockRatio.addEventListener(
    "change",
    () => {

        if (
            !lockRatio.checked ||
            !originalImage
        ) {

            return;

        }


        const width =
            Number(
                widthInput.value
            );


        if (
            width > 0
        ) {

            heightInput.value =
                Math.round(
                    width /
                    aspectRatio
                );

        }

    }
);


/* =========================
   PRESETS
========================= */

preset.addEventListener(
    "change",
    () => {

        const value =
            preset.value;


        if (
            value ===
            "custom"
        ) {

            return;

        }


        const targetWidth =
            Number(value);


        if (
            !originalImage ||
            !Number.isFinite(
                targetWidth
            )
        ) {

            return;

        }


        let targetHeight =
            Math.round(
                targetWidth /
                aspectRatio
            );


        /*
         * If the original image is
         * smaller than the selected
         * preset, don't enlarge it
         * automatically.
         */

        if (
            targetWidth >
            originalWidth
        ) {

            showStatus(
                "The selected preset is larger than the original image. You can still use it if you want to enlarge the image."
            );

        }


        widthInput.value =
            targetWidth;

        heightInput.value =
            targetHeight;

    }
);


/* =========================
   QUALITY
========================= */

qualityInput.addEventListener(
    "input",
    updateQualityLabel
);


function updateQualityLabel() {

    qualityValue.textContent =
        `${qualityInput.value}%`;

}


/* =========================
   RESIZE
========================= */

resizeButton.addEventListener(
    "click",
    resizeImage
);


async function resizeImage() {

    if (
        !selectedFile ||
        !originalImage
    ) {

        showStatus(
            "Please select an image first.",
            "error"
        );

        return;

    }


    const targetWidth =
        Number(
            widthInput.value
        );

    const targetHeight =
        Number(
            heightInput.value
        );


    if (
        !Number.isInteger(
            targetWidth
        ) ||
        !Number.isInteger(
            targetHeight
        ) ||
        targetWidth < 1 ||
        targetHeight < 1
    ) {

        showStatus(
            "Please enter valid width and height values.",
            "error"
        );

        return;

    }


    if (
        targetWidth >
        maxDimension ||
        targetHeight >
        maxDimension
    ) {

        showStatus(
            "Maximum supported dimension is 12000 × 12000 pixels.",
            "error"
        );

        return;

    }


    clearStatus();


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
                "Canvas is not supported."
            );

        }


        /*
         * High-quality image
         * interpolation.
         */

        context.imageSmoothingEnabled =
            true;

        context.imageSmoothingQuality =
            "high";


        /*
         * JPEG doesn't support
         * transparency.
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


        const blob =
            await canvasToBlob(
                canvas,
                outputFormat.value,
                Number(
                    qualityInput.value
                ) / 100
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


        resultOriginalDimensions.textContent =
            `${originalWidth} × ${originalHeight}`;


        resultNewDimensions.textContent =
            `${targetWidth} × ${targetHeight}`;


        resultFileSize.textContent =
            formatBytes(
                resultBlob.size
            );


        setStep(3);


        showStatus(
            "Image resized successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "Nexauren resize error:",
            error
        );


        showStatus(
            "Something went wrong while resizing the image.",
            "error"
        );

    } finally {

        resizeButton.disabled =
            false;

        resizeButton.textContent =
            "Resize Image";

    }

}


/* =========================
   CANVAS TO BLOB
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

    if (
        !resultBlob ||
        !resultUrl
    ) {

        showStatus(
            "There is no resized image to download.",
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
   RESIZE ANOTHER
========================= */

resizeAnotherButton.addEventListener(
    "click",
    resetTool
);


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

function setStep(
    currentStep
) {

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


            content.hidden =
                contentStep !==
                currentStep;

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

        "image
