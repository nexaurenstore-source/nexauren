/* =========================================================
   NEXAUREN — FAVICON CREATOR
   SCRIPT.JS — COMPLETE STABLE VERSION
   ========================================================= */

"use strict";


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (selector, parent = document) =>
    parent.querySelector(selector);

const $$ = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));


/* =========================================================
   STATE
   ========================================================= */

const state = {

    image: null,

    file: null,

    objectURL: null,

    imageWidth: 0,

    imageHeight: 0,

    currentStep: 1,

    exporting: false,

    settings: {

        size: 256,

        fit: "contain",

        backgroundMode: "transparent",

        background: "#ffffff",

        radius: 0,

        zoom: 100,

        positionX: 50,

        positionY: 50

    },

    exportSizes: [
        16,
        32,
        48,
        64,
        128,
        256
    ]

};


/* =========================================================
   DOM REFERENCES
   ========================================================= */

let pageTransition;
let dropZone;
let chooseButton;
let fileInput;

let emptyPreview;
let previewCanvas;
let previewContext;

let mainSize;
let fitSelect;
let backgroundMode;
let backgroundInput;

let radiusInput;
let zoomInput;
let positionXInput;
let positionYInput;

let radiusValue;
let zoomValue;
let xValue;
let yValue;

let screens = [];
let steps = [];
let sizeOptions = [];


/* =========================================================
   INITIALIZATION
   ========================================================= */

function init() {

    cacheDOM();

    console.log(
        "Nexauren Favicon Creator initialized."
    );


    readInitialSettings();

    initializeExportSizes();

    bindUploadEvents();

    bindControls();

    bindSizeOptions();

    bindNavigation();

    bindExportEvents();

    bindPageTransitions();

    bindKeyboardShortcuts();

    updateControlValues();

    updateBackgroundControl();

    updateSteps();

    updateExportSizeUI();

    showInitialScreen();

}


/* =========================================================
   CACHE DOM
   ========================================================= */

function cacheDOM() {

    pageTransition =
        $("#page-transition");

    dropZone =
        $("#drop-zone");

    chooseButton =
        $("#choose-button");

    fileInput =
        $("#file-input");

    emptyPreview =
        $("#empty-preview");

    previewCanvas =
        $("#preview-canvas");

    previewContext =
        previewCanvas
            ? previewCanvas.getContext("2d")
            : null;

    mainSize =
        $("#main-size");

    fitSelect =
        $("#fit");

    backgroundMode =
        $("#background-mode");

    backgroundInput =
        $("#background");

    radiusInput =
        $("#radius");

    zoomInput =
        $("#zoom");

    positionXInput =
        $("#position-x");

    positionYInput =
        $("#position-y");

    radiusValue =
        $("#radius-value");

    zoomValue =
        $("#zoom-value");

    xValue =
        $("#x-value");

    yValue =
        $("#y-value");

    screens =
        $$(".tool-screen");

    steps =
        $$(".step");

    sizeOptions =
        $$(".size-option");

}


/* =========================================================
   READ INITIAL SETTINGS
   ========================================================= */

function readInitialSettings() {

    if (mainSize) {

        const value =
            Number(mainSize.value);

        if (
            Number.isFinite(value) &&
            value > 0
        ) {

            state.settings.size =
                value;

        }

    }


    if (fitSelect) {

        state.settings.fit =
            fitSelect.value ||
            "contain";

    }


    if (backgroundMode) {

        state.settings.backgroundMode =
            backgroundMode.value ||
            "transparent";

    }


    if (backgroundInput) {

        state.settings.background =
            backgroundInput.value ||
            "#ffffff";

    }


    if (radiusInput) {

        state.settings.radius =
            clamp(
                Number(radiusInput.value),
                0,
                100
            );

    }


    if (zoomInput) {

        state.settings.zoom =
            clamp(
                Number(zoomInput.value),
                1,
                500
            );

    }


    if (positionXInput) {

        state.settings.positionX =
            clamp(
                Number(positionXInput.value),
                0,
                100
            );

    }


    if (positionYInput) {

        state.settings.positionY =
            clamp(
                Number(positionYInput.value),
                0,
                100
            );

    }

}


/* =========================================================
   INITIAL SCREEN
   ========================================================= */

function showInitialScreen() {

    state.currentStep = 1;

    screens.forEach(
        screen => {

            const number =
                Number(
                    screen.dataset.screen
                );

            if (number === 1) {

                screen.hidden = false;

                screen.classList.add(
                    "active"
                );

            } else {

                screen.hidden = true;

                screen.classList.remove(
                    "active"
                );

            }

        }
    );

    updateSteps();

}


/* =========================================================
   UPLOAD EVENTS
   ========================================================= */

function bindUploadEvents() {

    if (!fileInput) {
        return;
    }


    if (chooseButton) {

        chooseButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                event.stopPropagation();

                openFilePicker();

            }
        );

    }


    if (dropZone) {

        dropZone.addEventListener(
            "click",
            event => {

                if (
                    event.target.closest("button") ||
                    event.target.closest("input")
                ) {
                    return;
                }

                openFilePicker();

            }
        );


        dropZone.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {

                    event.preventDefault();

                    openFilePicker();

                }

            }
        );


        [
            "dragenter",
            "dragover"
        ].forEach(
            eventName => {

                dropZone.addEventListener(
                    eventName,
                    event => {

                        event.preventDefault();

                        event.stopPropagation();

                        dropZone.classList.add(
                            "dragging"
                        );

                    }
                );

            }
        );


        dropZone.addEventListener(
            "dragleave",
            event => {

                event.preventDefault();

                event.stopPropagation();

                if (
                    event.relatedTarget &&
                    dropZone.contains(
                        event.relatedTarget
                    )
                ) {
                    return;
                }

                dropZone.classList.remove(
                    "dragging"
                );

            }
        );


        dropZone.addEventListener(
            "drop",
            event => {

                event.preventDefault();

                event.stopPropagation();

                dropZone.classList.remove(
                    "dragging"
                );


                const files =
                    event.dataTransfer?.files;


                if (
                    files &&
                    files.length
                ) {

                    loadImage(
                        files[0]
                    );

                }

            }
        );

    }


    fileInput.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];

            if (file) {

                loadImage(file);

            }

        }
    );

}


/* =========================================================
   OPEN FILE PICKER
   ========================================================= */

function openFilePicker() {

    if (!fileInput) {
        return;
    }

    fileInput.click();

}


/* =========================================================
   VALIDATE IMAGE
   ========================================================= */

function validateImageFile(file) {

    if (!file) {

        return {
            valid: false,
            message: "No image was selected."
        };

    }


    const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp"
    ];


    const extension =
        String(file.name || "")
            .split(".")
            .pop()
            .toLowerCase();


    const allowedExtensions = [
        "png",
        "jpg",
        "jpeg",
        "webp"
    ];


    const validType =
        allowedTypes.includes(
            file.type
        );


    const validExtension =
        allowedExtensions.includes(
            extension
        );


    if (
        !validType &&
        !validExtension
    ) {

        return {
            valid: false,
            message:
                "Please choose a PNG, JPG, JPEG or WebP image."
        };

    }


    if (
        file.size >
        25 * 1024 * 1024
    ) {

        return {
            valid: false,
            message:
                "The maximum image size is 25 MB."
        };

    }


    return {
        valid: true,
        message: ""
    };

}


/* =========================================================
   LOAD IMAGE
   ========================================================= */

function loadImage(file) {

    const validation =
        validateImageFile(file);


    if (!validation.valid) {

        showMessage(
            validation.message,
            "error"
        );

        return;

    }


    releaseObjectURL();


    const objectURL =
        URL.createObjectURL(file);


    const image =
        new Image();


    image.onload = () => {

        state.file =
            file;

        state.objectURL =
            objectURL;

        state.image =
            image;

        state.imageWidth =
            image.naturalWidth;

        state.imageHeight =
            image.naturalHeight;


        resetImagePosition();

        renderPreview();

        goToStep(2);


        showMessage(
            "Image loaded successfully.",
            "success"
        );

    };


    image.onerror = () => {

        URL.revokeObjectURL(
            objectURL
        );


        showMessage(
            "The image could not be loaded.",
            "error"
        );

    };


    image.src =
        objectURL;

}


/* =========================================================
   RESET IMAGE POSITION
   ========================================================= */

function resetImagePosition() {

    state.settings.zoom =
        100;

    state.settings.positionX =
        50;

    state.settings.positionY =
        50;


    if (zoomInput) {
        zoomInput.value = "100";
    }

    if (positionXInput) {
        positionXInput.value = "50";
    }

    if (positionYInput) {
        positionYInput.value = "50";
    }


    updateControlValues();

}


/* =========================================================
   CONTROLS
   ========================================================= */

function bindControls() {

    mainSize?.addEventListener(
        "input",
        () => {

            const value =
                Number(mainSize.value);

            if (
                Number.isFinite(value) &&
                value > 0
            ) {

                state.settings.size =
                    value;

                renderPreview();

            }

        }
    );


    mainSize?.addEventListener(
        "change",
        () => {

            const value =
                Number(mainSize.value);

            if (
                Number.isFinite(value) &&
                value > 0
            ) {

                state.settings.size =
                    value;

                renderPreview();

            }

        }
    );


    fitSelect?.addEventListener(
        "change",
        () => {

            state.settings.fit =
                fitSelect.value;

            renderPreview();

        }
    );


    backgroundMode?.addEventListener(
        "change",
        () => {

            state.settings.backgroundMode =
                backgroundMode.value;

            updateBackgroundControl();

            renderPreview();

        }
    );


    backgroundInput?.addEventListener(
        "input",
        () => {

            state.settings.background =
                backgroundInput.value;

            renderPreview();

        }
    );


    radiusInput?.addEventListener(
        "input",
        () => {

            state.settings.radius =
                clamp(
                    Number(radiusInput.value),
                    0,
                    100
                );

            updateControlValues();

            renderPreview();

        }
    );


    zoomInput?.addEventListener(
        "input",
        () => {

            state.settings.zoom =
                clamp(
                    Number(zoomInput.value),
                    1,
                    500
                );

            updateControlValues();

            renderPreview();

        }
    );


    positionXInput?.addEventListener(
        "input",
        () => {

            state.settings.positionX =
                clamp(
                    Number(positionXInput.value),
                    0,
                    100
                );

            updateControlValues();

            renderPreview();

        }
    );


    positionYInput?.addEventListener(
        "input",
        () => {

            state.settings.positionY =
                clamp(
                    Number(positionYInput.value),
                    0,
                    100
                );

            updateControlValues();

            renderPreview();

        }
    );

}


/* =========================================================
   CONTROL VALUES
   ========================================================= */

function updateControlValues() {

    if (radiusValue) {

        radiusValue.textContent =
            Math.round(
                state.settings.radius
            );

    }


    if (zoomValue) {

        zoomValue.textContent =
            Math.round(
                state.settings.zoom
            );

    }


    if (xValue) {

        xValue.textContent =
            Math.round(
                state.settings.positionX
            );

    }


    if (yValue) {

        yValue.textContent =
            Math.round(
                state.settings.positionY
            );

    }

}


/* =========================================================
   BACKGROUND CONTROL
   ========================================================= */

function updateBackgroundControl() {

    if (!backgroundInput) {
        return;
    }


    const enabled =
        state.settings.backgroundMode ===
        "color";


    backgroundInput.disabled =
        !enabled;


    backgroundInput.style.opacity =
        enabled
            ? "1"
            : ".45";

}


/* =========================================================
   RENDER PREVIEW
   ========================================================= */

function renderPreview() {

    if (
        !state.image ||
        !previewCanvas ||
        !previewContext
    ) {
        return;
    }


    const size =
        Number(
            state.settings.size
        );


    if (
        !Number.isFinite(size) ||
        size <= 0
    ) {
        return;
    }


    previewCanvas.width =
        size;

    previewCanvas.height =
        size;


    previewContext.clearRect(
        0,
        0,
        size,
        size
    );


    drawFavicon(
        previewContext,
        size
    );


    if (emptyPreview) {
        emptyPreview.hidden = true;
    }


    previewCanvas.hidden =
        false;

}


/* =========================================================
   DRAW FAVICON
   ========================================================= */

function drawFavicon(
    context,
    size
) {

    if (!state.image) {
        return;
    }


    /* Background */

    if (
        state.settings.backgroundMode ===
        "color"
    ) {

        context.fillStyle =
            state.settings.background;

        context.fillRect(
            0,
            0,
            size,
            size
        );

    }


    /* Rounded corners */

    context.save();


    const radius =
        size *
        (
            state.settings.radius /
            100
        );


    if (radius > 0) {

        createRoundedRectPath(
            context,
            0,
            0,
            size,
            size,
            radius
        );

        context.clip();

    }


    drawImageToContext(
        context,
        state.image,
        size
    );


    context.restore();

}


/* =========================================================
   DRAW IMAGE
   ========================================================= */

function drawImageToContext(
    context,
    image,
    size
) {

    const imageWidth =
        image.naturalWidth;

    const imageHeight =
        image.naturalHeight;


    if (
        !imageWidth ||
        !imageHeight
    ) {
        return;
    }


    const zoom =
        state.settings.zoom /
        100;


    let scale;


    if (
        state.settings.fit ===
        "cover"
    ) {

        scale =
            Math.max(
                size / imageWidth,
                size / imageHeight
            );

    } else {

        scale =
            Math.min(
                size / imageWidth,
                size / imageHeight
            );

    }


    scale *= zoom;


    const drawWidth =
        imageWidth * scale;

    const drawHeight =
        imageHeight * scale;


    const availableX =
        size - drawWidth;

    const availableY =
        size - drawHeight;


    const x =
        availableX *
        (
            state.settings.positionX /
            100
        );


    const y =
        availableY *
        (
            state.settings.positionY /
            100
        );


    context.imageSmoothingEnabled =
        true;

    context.imageSmoothingQuality =
        "high";


    context.drawImage(
        image,
        x,
        y,
        drawWidth,
        drawHeight
    );

}


/* =========================================================
   ROUNDED RECTANGLE
   ========================================================= */

function createRoundedRectPath(
    context,
    x,
    y,
    width,
    height,
    radius
) {

    radius =
        Math.max(
            0,
            Math.min(
                radius,
                width / 2,
                height / 2
            )
        );


    context.beginPath();


    context.moveTo(
        x + radius,
        y
    );


    context.lineTo(
                x + width - radius,
        y
    );


    context.quadraticCurveTo(
        x + width,
        y,
        x + width,
        y + radius
    );


    context.lineTo(
        x + width,
        y + height - radius
    );


    context.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height
    );


    context.lineTo(
        x + radius,
        y + height
    );


    context.quadraticCurveTo(
        x,
        y + height,
        x,
        y + height - radius
    );


    context.lineTo(
        x,
        y + radius
    );


    context.quadraticCurveTo(
        x,
        y,
        x + radius,
        y
    );


    context.closePath();

}


/* =========================================================
   EXPORT SIZES
   ========================================================= */

function initializeExportSizes() {

    if (
        !sizeOptions ||
        !sizeOptions.length
    ) {

        return;

    }


    const selected =
        sizeOptions
            .filter(
                option =>
                    option.checked
            )
            .map(
                option =>
                    Number(option.value)
            )
            .filter(
                value =>
                    Number.isFinite(value) &&
                    value > 0
            );


    if (selected.length) {

        state.exportSizes =
            [...new Set(selected)];

    }


    /*
     * If nothing is selected, automatically
     * select the first available option.
     */

    if (!state.exportSizes.length) {

        const first =
            sizeOptions[0];

        if (first) {

            first.checked =
                true;

            const value =
                Number(first.value);


            if (
                Number.isFinite(value) &&
                value > 0
            ) {

                state.exportSizes = [
                    value
                ];

            }

        }

    }


    updateExportSizeUI();

}


/* =========================================================
   BIND SIZE OPTIONS
   ========================================================= */

function bindSizeOptions() {

    if (
        !sizeOptions ||
        !sizeOptions.length
    ) {

        return;

    }


    sizeOptions.forEach(
        option => {

            option.addEventListener(
                "change",
                () => {

                    updateExportSizes();

                }
            );

        }
    );

}


/* =========================================================
   UPDATE EXPORT SIZES
   ========================================================= */

function updateExportSizes() {

    if (
        !sizeOptions ||
        !sizeOptions.length
    ) {

        return;

    }


    const selected =
        sizeOptions
            .filter(
                option =>
                    option.checked
            )
            .map(
                option =>
                    Number(option.value)
            )
            .filter(
                value =>
                    Number.isFinite(value) &&
                    value > 0
            );


    /*
     * Never allow an empty export pack.
     */

    if (!selected.length) {

        const first =
            sizeOptions[0];

        if (first) {

            first.checked =
                true;

            const value =
                Number(first.value);


            if (
                Number.isFinite(value) &&
                value > 0
            ) {

                state.exportSizes = [
                    value
                ];

            }

        }

    } else {

        state.exportSizes =
            [...new Set(selected)];

    }


    updateExportSizeUI();

}


/* =========================================================
   EXPORT SIZE UI
   ========================================================= */

function updateExportSizeUI() {

    const list =
        $("#export-size-list");


    if (!list) {
        return;
    }


    list.innerHTML =
        state.exportSizes
            .map(
                size => `
                    <span class="export-size">
                        ${size} × ${size}
                    </span>
                `
            )
            .join("");

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function bindNavigation() {

    document.addEventListener(
        "click",
        event => {

            const target =
                event.target.closest(
                    "[data-next-step], [data-prev-step], [data-step-target]"
                );


            if (!target) {
                return;
            }


            /*
             * Do not allow another handler
             * to process this navigation click.
             */

            event.preventDefault();
            event.stopPropagation();


            if (
                target.dataset.nextStep !==
                undefined
            ) {

                goToStep(
                    Number(
                        target.dataset.nextStep
                    )
                );

                return;

            }


            if (
                target.dataset.prevStep !==
                undefined
            ) {

                goToStep(
                    Number(
                        target.dataset.prevStep
                    )
                );

                return;

            }


            if (
                target.dataset.stepTarget !==
                undefined
            ) {

                goToStep(
                    Number(
                        target.dataset.stepTarget
                    )
                );

            }

        }
    );

}


/* =========================================================
   GO TO STEP
   ========================================================= */

function goToStep(step) {

    let targetStep =
        Number(step);


    if (
        !Number.isFinite(targetStep)
    ) {

        return;

    }


    targetStep =
        Math.round(targetStep);


    targetStep =
        clamp(
            targetStep,
            1,
            3
        );


    /*
     * Step 2 and Step 3 require an image.
     */

    if (
        targetStep > 1 &&
        !state.image
    ) {

        showMessage(
            "Please upload an image first.",
            "error"
        );


        targetStep =
            1;

    }


    /*
     * Make sure export sizes exist
     * before entering Step 3.
     */

    if (
        targetStep === 3
    ) {

        updateExportSizes();

    }


    state.currentStep =
        targetStep;


    /*
     * Toggle screens.
     */

    if (
        screens &&
        screens.length
    ) {

        screens.forEach(
            screen => {

                const number =
                    Number(
                        screen.dataset.screen
                    );


                const active =
                    number ===
                    targetStep;


                if (active) {

                    screen.hidden =
                        false;

                    screen.removeAttribute(
                        "hidden"
                    );

                    screen.classList.add(
                        "active"
                    );

                } else {

                    screen.hidden =
                        true;

                    screen.setAttribute(
                        "hidden",
                        ""
                    );

                    screen.classList.remove(
                        "active"
                    );

                }

            }
        );

    }


    updateSteps();


    /*
     * Render customization preview.
     */

    if (
        targetStep === 2
    ) {

        requestAnimationFrame(
            () => {

                renderPreview();

            }
        );

    }


    /*
     * Prepare export screen.
     */

    if (
        targetStep === 3
    ) {

        requestAnimationFrame(
            () => {

                prepareExportScreen();

            }
        );

    }


    /*
     * Scroll to top.
     */

    try {

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    } catch {

        window.scrollTo(
            0,
            0
        );

    }

}


/* =========================================================
   STEP INDICATOR
   ========================================================= */

function updateSteps() {

    if (
        !steps ||
        !steps.length
    ) {

        return;

    }


    steps.forEach(
        stepElement => {

            const number =
                Number(
                    stepElement.dataset.step
                );


            stepElement.classList.toggle(
                "active",
                number ===
                state.currentStep
            );


            stepElement.classList.toggle(
                "completed",
                number <
                state.currentStep
            );

        }
    );


    const lines =
        $$(".step-line");


    lines.forEach(
        (line, index) => {

            const completed =
                state.currentStep >
                index + 1;


            line.style.background =
                completed
                    ? "rgba(22, 163, 106, .35)"
                    : "";

        }
    );

}


/* =========================================================
   PREPARE EXPORT SCREEN
   ========================================================= */

function prepareExportScreen() {

    if (!state.image) {
        return;
    }


    updateExportSizes();


    const exportCanvas =
        $("#export-canvas");


    if (exportCanvas) {

        const previewSize =
            256;


        const rendered =
            renderAtSize(
                previewSize
            );


        if (rendered) {

            const context =
                exportCanvas.getContext(
                    "2d"
                );


            if (context) {

                exportCanvas.width =
                    rendered.width;

                exportCanvas.height =
                    rendered.height;


                context.clearRect(
                    0,
                    0,
                    rendered.width,
                    rendered.height
                );


                context.drawImage(
                    rendered,
                    0,
                    0
                );

            }

        }

    }


    updateExportSizeUI();

}


/* =========================================================
   RENDER AT SIZE
   ========================================================= */

function renderAtSize(size) {

    if (!state.image) {
        return null;
    }


    size =
        Number(size);


    if (
        !Number.isFinite(size) ||
        size <= 0
    ) {

        return null;

    }


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        Math.round(size);

    canvas.height =
        Math.round(size);


    const context =
        canvas.getContext(
            "2d"
        );


    if (!context) {
        return null;
    }


    context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    drawFavicon(
        context,
        canvas.width
    );


    return canvas;

}


/* =========================================================
   EXPORT EVENTS
   ========================================================= */

function bindExportEvents() {

    document.addEventListener(
        "click",
        event => {

            const target =
                event.target.closest(
                    "[data-export], [data-export-size], [data-export-pack], #download-button, #download-pack, #export-button, #export-pack"
                );


            if (!target) {
                return;
            }


            event.preventDefault();


            if (
                target.hasAttribute(
                    "data-export-pack"
                ) ||
                target.id ===
                "download-pack" ||
                target.id ===
                "export-pack"
            ) {

                exportPack();

                return;

            }


            const requestedSize =
                target.dataset.exportSize;


            if (
                requestedSize !==
                undefined
            ) {

                exportPNG(
                    Number(
                        requestedSize
                    )
                );

                return;

            }


            exportPNG(
                state.settings.size
            );

        }
    );

}


/* =========================================================
   EXPORT PNG
   ========================================================= */

async function exportPNG(size) {

    if (
        !state.image ||
        state.exporting
    ) {

        return;

    }


    size =
        Number(size);


    if (
        !Number.isFinite(size) ||
        size <= 0
    ) {

        showMessage(
            "Invalid export size.",
            "error"
        );

        return;

    }


    const canvas =
        renderAtSize(
            size
        );


    if (!canvas) {

        showMessage(
            "Unable to create the favicon.",
            "error"
        );

        return;

    }


    state.exporting =
        true;


    setExportButtonsDisabled(
        true
    );


    try {

        const blob =
            await canvasToBlob(
                canvas,
                "image/png"
            );


        if (!blob) {

            throw new Error(
                "Canvas returned an empty blob."
            );

        }


        downloadBlob(
            blob,
            `favicon-${size}x${size}.png`
        );


        showMessage(
            `Favicon ${size} × ${size} exported.`,
            "success"
        );

    } catch (error) {

        console.error(
            "PNG export failed:",
            error
        );


        showMessage(
            "Unable to export the PNG.",
            "error"
        );

    } finally {

        state.exporting =
            false;


        setExportButtonsDisabled(
            false
        );

    }

}


/* =========================================================
   EXPORT COMPLETE PACK
   ========================================================= */

async function exportPack() {

    if (
        !state.image ||
        state.exporting
    ) {

        return;

    }


    updateExportSizes();


    if (
        !state.exportSizes.length
    ) {

        showMessage(
            "Select at least one favicon size.",
            "error"
        );

        return;

    }


    state.exporting =
        true;


    setExportButtonsDisabled(
        true
    );


    try {

        for (
            const size
            of state.exportSizes
        ) {

            const canvas =
                renderAtSize(
                    size
                );


            if (!canvas) {
                continue;
            }


            const blob =
                await canvasToBlob(
                    canvas,
                    "image/png"
                );


            if (!blob) {
                continue;
            }


            downloadBlob(
                blob,
                `favicon-${size}x${size}.png`
            );


            await wait(
                150
            );

        }


        showMessage(
            "Your favicon pack has been exported.",
            "success"
        );

    } catch (error) {

        console.error(
            "Export pack failed:",
            error
        );


        showMessage(
            "Something went wrong during export.",
            "error"
        );

    } finally {

        state.exporting =
            false;


        setExportButtonsDisabled(
            false
        );

    }

}


/* =========================================================
   CANVAS TO BLOB
   ========================================================= */

function canvasToBlob(
    canvas,
    type = "image/png"
) {

    return new Promise(
        resolve => {

            if (
                !canvas ||
                typeof canvas.toBlob !==
                "function"
            ) {

                resolve(null);

                return;

            }


            canvas.toBlob(
                blob => {

                    resolve(
                        blob
                    );

                },
                type
            );

        }
    );

}


/* =========================================================
   DOWNLOAD BLOB
   ========================================================= */

function downloadBlob(
    blob,
    filename
) {

    if (!blob) {
        return;
    }


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;

    link.download =
        filename;

    link.style.display =
        "none";


    document.body.appendChild(
        link
    );


    /*
     * requestAnimationFrame improves
     * compatibility with some browsers.
     */

    requestAnimationFrame(
        () => {

            link.click();

            link.remove();

        }
    );


    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        1500
    );

}


/* =========================================================
   DISABLE EXPORT BUTTONS
   ========================================================= */

function setExportButtonsDisabled(
    disabled
) {

    const selectors = [
        "#download-button",
        "#download-pack",
        "#export-button",
        "#export-pack",
        "[data-export]",
        "[data-export-size]",
        "[data-export-pack]"
    ];


    const buttons = [];


    selectors.forEach(
        selector => {

            $$(selector).forEach(
                element => {

                    if (
                        !buttons.includes(
                            element
                        )
                    ) {

                        buttons.push(
                            element
                        );

                    }

                }
            );

        }
    );


    buttons.forEach(
        button => {

            if (
                "disabled" in button
            ) {

                button.disabled =
                    disabled;

            }


            button.setAttribute(
                "aria-disabled",
                String(disabled)
            );

        }
    );

}


/* =========================================================
   PAGE TRANSITIONS
   ========================================================= */

function bindPageTransitions() {

    document.addEventListener(
        "click",
        event => {

            /*
             * IMPORTANT:
             * Navigation buttons must NOT be captured
             * by the page transition handler.
             */

            const navigation =
                event.target.closest(
                    "[data-next-step], [data-prev-step], [data-step-target]"
                );


            if (navigation) {
                return;
            }


            const link =
                event.target.closest(
                    "a[href]"
                );


            if (!link) {
                return;
            }


            const href =
                link.getAttribute(
                    "href"
                );


                        if (
                !href ||
                href.startsWith("#") ||
                href.startsWith("javascript:")
            ) {

                return;

            }


            if (
                link.target === "_blank" ||
                link.hasAttribute("download") ||
                link.hasAttribute("data-no-transition")
            ) {

                return;

            }


            let url;


            try {

                url =
                    new URL(
                        href,
                        window.location.href
                    );

            } catch {

                return;

            }


            /*
             * Only intercept links belonging
             * to the current website.
             */

            if (
                url.origin !==
                window.location.origin
            ) {

                return;

            }


            /*
             * Do not interfere with special
             * browser actions.
             */

            if (
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
            ) {

                return;

            }


            event.preventDefault();


            if (pageTransition) {

                pageTransition.classList.add(
                    "active"
                );

            }


            setTimeout(
                () => {

                    window.location.href =
                        url.href;

                },
                180
            );

        }
    );

}


/* =========================================================
   KEYBOARD SHORTCUTS
   ========================================================= */

function bindKeyboardShortcuts() {

    document.addEventListener(
        "keydown",
        event => {

            /*
             * Ignore shortcuts while typing.
             */

            const target =
                event.target;


            const tagName =
                target &&
                target.tagName
                    ? target.tagName.toLowerCase()
                    : "";


            const isTyping =
                tagName === "input" ||
                tagName === "textarea" ||
                tagName === "select" ||
                target?.isContentEditable;


            if (isTyping) {
                return;
            }


            /*
             * Escape:
             * return to the previous step.
             */

            if (
                event.key === "Escape"
            ) {

                if (
                    state.currentStep > 1
                ) {

                    event.preventDefault();

                    goToStep(
                        state.currentStep - 1
                    );

                }

                return;

            }


            /*
             * Arrow Left:
             * previous step.
             */

            if (
                event.key === "ArrowLeft"
            ) {

                if (
                    state.currentStep > 1
                ) {

                    event.preventDefault();

                    goToStep(
                        state.currentStep - 1
                    );

                }

                return;

            }


            /*
             * Arrow Right:
             * next step.
             */

            if (
                event.key === "ArrowRight"
            ) {

                if (
                    state.currentStep < 3
                ) {

                    event.preventDefault();

                    goToStep(
                        state.currentStep + 1
                    );

                }

                return;

            }


            /*
             * Ctrl/Cmd + S:
             * export the current favicon.
             */

            if (
                (
                    event.ctrlKey ||
                    event.metaKey
                ) &&
                event.key.toLowerCase() === "s"
            ) {

                if (state.image) {

                    event.preventDefault();

                    exportPNG(
                        state.settings.size
                    );

                }

            }

        }
    );

}


/* =========================================================
   MESSAGE SYSTEM
   ========================================================= */

function showMessage(
    message,
    type = "info"
) {

    if (!message) {
        return;
    }


    /*
     * Try existing message elements first.
     */

    const existing =
        $(
            "#message, #status-message, #toast, .toast"
        );


    if (existing) {

        existing.textContent =
            message;


        existing.classList.remove(
            "success",
            "error",
            "info",
            "warning",
            "show",
            "visible"
        );


        existing.classList.add(
            type
        );


        /*
         * Support both common toast
         * class naming conventions.
         */

        existing.classList.add(
            "show"
        );

        existing.classList.add(
            "visible"
        );


        clearTimeout(
            existing._nexaurenMessageTimer
        );


        existing._nexaurenMessageTimer =
            setTimeout(
                () => {

                    existing.classList.remove(
                        "show",
                        "visible"
                    );

                },
                3000
            );


        return;

    }


    /*
     * If the HTML does not contain a
     * message element, create one.
     */

    let toast =
        $("#nexauren-toast");


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );


        toast.id =
            "nexauren-toast";


        toast.setAttribute(
            "role",
            "status"
        );


        toast.setAttribute(
            "aria-live",
            "polite"
        );


        document.body.appendChild(
            toast
        );

    }


    toast.textContent =
        message;


    toast.className =
        `nexauren-toast ${type} show`;


    clearTimeout(
        toast._nexaurenMessageTimer
    );


    toast._nexaurenMessageTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            3000
        );

}


/* =========================================================
   CLAMP
   ========================================================= */

function clamp(
    value,
    min,
    max
) {

    value =
        Number(value);


    if (!Number.isFinite(value)) {

        return min;

    }


    return Math.min(
        max,
        Math.max(
            min,
            value
        )
    );

}


/* =========================================================
   WAIT
   ========================================================= */

function wait(
    milliseconds
) {

    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                milliseconds
            );

        }
    );

}


/* =========================================================
   RELEASE OBJECT URL
   ========================================================= */

function releaseObjectURL() {

    if (
        state.objectURL
    ) {

        try {

            URL.revokeObjectURL(
                state.objectURL
            );

        } catch (error) {

            console.warn(
                "Could not revoke object URL:",
                error
            );

        }

    }


    state.objectURL =
        null;

}


/* =========================================================
   RESET APPLICATION
   ========================================================= */

function resetApplication() {

    releaseObjectURL();


    state.image =
        null;

    state.file =
        null;

    state.imageWidth =
        0;

    state.imageHeight =
        0;

    state.currentStep =
        1;

    state.exporting =
        false;


    state.settings.zoom =
        100;

    state.settings.positionX =
        50;

    state.settings.positionY =
        50;


    if (fileInput) {

        fileInput.value =
            "";

    }


    if (previewCanvas) {

        previewCanvas.hidden =
            true;


        if (previewContext) {

            previewContext.clearRect(
                0,
                0,
                previewCanvas.width,
                previewCanvas.height
            );

        }

    }


    if (emptyPreview) {

        emptyPreview.hidden =
            false;

    }


    updateControlValues();

    showInitialScreen();

}


/* =========================================================
   BEFORE UNLOAD
   ========================================================= */

function bindBeforeUnload() {

    window.addEventListener(
        "beforeunload",
        () => {

            releaseObjectURL();

        }
    );

}


/* =========================================================
   DOM READY
   ========================================================= */

function startApplication() {

    /*
     * Prevent accidental double initialization.
     */

    if (
        document.documentElement.dataset
            .nexaurenFaviconInitialized ===
        "true"
    ) {

        return;

    }


    document.documentElement.dataset
        .nexaurenFaviconInitialized =
        "true";


    init();

    bindBeforeUnload();

}


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState === "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        startApplication,
        {
            once: true
        }
    );

} else {

    startApplication();

}


/* =========================================================
   END
   ========================================================= */
 
