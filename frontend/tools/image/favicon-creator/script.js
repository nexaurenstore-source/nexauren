/* =========================================================
   NEXAUREN — FAVICON CREATOR
   SCRIPT.JS — COMPLETE REBUILD
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
   DOM ELEMENTS
   ========================================================= */

const pageTransition =
    $("#page-transition");

const dropZone =
    $("#drop-zone");

const chooseButton =
    $("#choose-button");

const fileInput =
    $("#file-input");

const emptyPreview =
    $("#empty-preview");

const previewCanvas =
    $("#preview-canvas");

const mainSize =
    $("#main-size");

const fitSelect =
    $("#fit");

const backgroundMode =
    $("#background-mode");

const backgroundInput =
    $("#background");

const radiusInput =
    $("#radius");

const zoomInput =
    $("#zoom");

const positionXInput =
    $("#position-x");

const positionYInput =
    $("#position-y");

const radiusValue =
    $("#radius-value");

const zoomValue =
    $("#zoom-value");

const xValue =
    $("#x-value");

const yValue =
    $("#y-value");

const screens =
    $$(".tool-screen");

const steps =
    $$(".step");

const sizeOptions =
    $$(".size-option");


/* =========================================================
   CANVAS
   ========================================================= */

const ctx =
    previewCanvas
        ? previewCanvas.getContext("2d")
        : null;


/* =========================================================
   APPLICATION STATE
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

        size: mainSize
            ? Number(mainSize.value) || 256
            : 256,

        fit: fitSelect
            ? fitSelect.value
            : "contain",

        backgroundMode: backgroundMode
            ? backgroundMode.value
            : "transparent",

        background: backgroundInput
            ? backgroundInput.value
            : "#ffffff",

        radius: radiusInput
            ? Number(radiusInput.value)
            : 0,

        zoom: zoomInput
            ? Number(zoomInput.value)
            : 100,

        positionX: positionXInput
            ? Number(positionXInput.value)
            : 50,

        positionY: positionYInput
            ? Number(positionYInput.value)
            : 50

    },

    exportSizes: []

};


/* =========================================================
   INITIALIZATION
   ========================================================= */

function init() {

    console.log(
        "Nexauren Favicon Creator initialized."
    );


    if (!previewCanvas || !ctx) {

        console.error(
            "Nexauren Favicon Creator: Canvas unavailable."
        );

        return;

    }


    initializeExportSizes();

    bindUpload();

    bindControls();

    bindSizeOptions();

    bindNavigation();

    bindPageTransitions();

    bindKeyboardShortcuts();

    updateControlLabels();

    updateBackgroundControl();

    updateSteps();

    createExportFallbackUI();

}


/* =========================================================
   UPLOAD
   ========================================================= */

function bindUpload() {

    if (!dropZone || !fileInput) {
        return;
    }


    /* -----------------------------------------------------
       CHOOSE BUTTON
    ----------------------------------------------------- */

    chooseButton?.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            event.stopPropagation();

            fileInput.click();

        }
    );


    /* -----------------------------------------------------
       DROP ZONE CLICK
    ----------------------------------------------------- */

    dropZone.addEventListener(
        "click",
        (event) => {

            if (
                event.target.closest("button")
            ) {
                return;
            }

            fileInput.click();

        }
    );


    /* -----------------------------------------------------
       KEYBOARD
    ----------------------------------------------------- */

    dropZone.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter" ||
                event.key === " "
            ) {

                event.preventDefault();

                fileInput.click();

            }

        }
    );


    /* -----------------------------------------------------
       FILE INPUT
    ----------------------------------------------------- */

    fileInput.addEventListener(
        "change",
        () => {

            const file =
                fileInput.files &&
                fileInput.files[0];

            if (file) {
                loadImage(file);
            }

        }
    );


    /* -----------------------------------------------------
       DRAG ENTER / OVER
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       DRAG LEAVE / DROP
    ----------------------------------------------------- */

    [
        "dragleave",
        "drop"
    ].forEach(
        eventName => {

            dropZone.addEventListener(
                eventName,
                event => {

                    event.preventDefault();

                    event.stopPropagation();

                    dropZone.classList.remove(
                        "dragging"
                    );

                }
            );

        }
    );


    /* -----------------------------------------------------
       DROP
    ----------------------------------------------------- */

    dropZone.addEventListener(
        "drop",
        event => {

            const files =
                event.dataTransfer?.files;

            if (!files?.length) {
                return;
            }

            loadImage(files[0]);

        }
    );

}


/* =========================================================
   IMAGE VALIDATION
   ========================================================= */

function validateImageFile(file) {

    if (!file) {

        return {
            valid: false,
            message: "No image was selected."
        };

    }


    const allowedTypes = new Set([
        "image/png",
        "image/jpeg",
        "image/webp"
    ]);


    if (!allowedTypes.has(file.type)) {

        return {
            valid: false,
            message:
                "Please choose a PNG, JPG, JPEG or WebP image."
        };

    }


    const maxSize =
        25 * 1024 * 1024;


    if (file.size > maxSize) {

        return {
            valid: false,
            message:
                "The maximum image size is 25 MB."
        };

    }


    return {
        valid: true
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


    state.file =
        file;

    state.objectURL =
        objectURL;


    const image =
        new Image();


    image.onload = () => {

        state.image =
            image;

        state.imageWidth =
            image.naturalWidth;

        state.imageHeight =
            image.naturalHeight;


        resetImageAdjustments();

        renderPreview();

        goToStep(2);


        showMessage(
            "Image loaded successfully.",
            "success"
        );

    };


    image.onerror = () => {

        releaseObjectURL();

        state.image =
            null;

        state.file =
            null;


        showMessage(
            "The image could not be loaded.",
            "error"
        );

    };


    image.src =
        objectURL;

}


/* =========================================================
   RESET IMAGE ADJUSTMENTS
   ========================================================= */

function resetImageAdjustments() {

    state.settings.zoom =
        100;

    state.settings.positionX =
        50;

    state.settings.positionY =
        50;


    if (zoomInput) {
        zoomInput.value =
            "100";
    }

    if (positionXInput) {
        positionXInput.value =
            "50";
    }

    if (positionYInput) {
        positionYInput.value =
            "50";
    }


    updateControlLabels();

}


/* =========================================================
   CONTROLS
   ========================================================= */

function bindControls() {

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
                    50
                );

            updateControlLabels();

            renderPreview();

        }
    );


    zoomInput?.addEventListener(
        "input",
        () => {

            state.settings.zoom =
                clamp(
                    Number(zoomInput.value),
                    50,
                    200
                );

            updateControlLabels();

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

            updateControlLabels();

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

            updateControlLabels();

            renderPreview();

        }
    );

}


/* =========================================================
   CONTROL LABELS
   ========================================================= */

function updateControlLabels() {

    if (radiusValue) {

        radiusValue.textContent =
            state.settings.radius;

    }


    if (zoomValue) {

        zoomValue.textContent =
            state.settings.zoom;

    }


    if (xValue) {

        xValue.textContent =
            state.settings.positionX;

    }


    if (yValue) {

        yValue.textContent =
            state.settings.positionY;

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


    backgroundInput.setAttribute(
        "aria-disabled",
        String(!enabled)
    );

}


/* =========================================================
   PREVIEW
   ========================================================= */

function renderPreview() {

    if (
        !state.image ||
        !previewCanvas ||
        !ctx
    ) {
        return;
    }


    const size =
        state.settings.size;


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


    ctx.clearRect(
        0,
        0,
        size,
        size
    );


    /* -----------------------------------------------------
       BACKGROUND
    ----------------------------------------------------- */

    if (
        state.settings.backgroundMode ===
        "color"
    ) {

        ctx.fillStyle =
            state.settings.background;

        ctx.fillRect(
            0,
            0,
            size,
            size
        );

    }


    /* -----------------------------------------------------
       IMAGE CLIP
    ----------------------------------------------------- */

    ctx.save();


    const radius =
        size *
        (
            state.settings.radius /
            100
        );


    if (radius > 0) {

        createRoundedRectPath(
            ctx,
            0,
            0,
            size,
            size,
            radius
        );

        ctx.clip();

    }


    drawImage(
        ctx,
        state.image,
        size
    );


    ctx.restore();


    /* -----------------------------------------------------
       SHOW CANVAS
    ----------------------------------------------------- */

    emptyPreview?.setAttribute(
        "hidden",
        ""
    );

    previewCanvas.removeAttribute(
        "hidden"
    );

}


/* =========================================================
   DRAW IMAGE
   ========================================================= */

function drawImage(
    context,
    image,
    canvasSize
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
                canvasSize / imageWidth,
                canvasSize / imageHeight
            );

    } else {

        scale =
            Math.min(
                canvasSize / imageWidth,
                canvasSize / imageHeight
            );

    }


    scale *=
        zoom;


    const width =
        imageWidth * scale;

    const height =
        imageHeight * scale;


    const availableX =
        canvasSize - width;

    const availableY =
        canvasSize - height;


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
        width,
        height
    );

}


/* =========================================================
   ROUNDED RECT
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
        Math.min(
            radius,
            width / 2,
            height / 2
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
   RENDER AT EXPORT SIZE
   ========================================================= */

function renderAtSize(size) {

    if (!state.image) {
        return null;
    }


    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        size;

    canvas.height =
        size;


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
        size,
        size
    );


    /* -----------------------------------------------------
       BACKGROUND
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       RADIUS
    ----------------------------------------------------- */

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


    drawImage(
        context,
        state.image,
        size
    );


    context.restore();


    return canvas;

}


/* =========================================================
   SIZE OPTIONS
   ========================================================= */

function initializeExportSizes() {

    state.exportSizes =
        sizeOptions
            .filter(
                input =>
                    input.checked
            )
            .map(
                input =>
                    Number(input.value)
            )
            .filter(
                Number.isFinite
            );


    if (!state.exportSizes.length) {

        state.exportSizes = [
            16,
            32,
            48,
            64
        ];

    }

}


/* =========================================================
   BIND SIZE OPTIONS
   ========================================================= */

function bindSizeOptions() {

    sizeOptions.forEach(
        checkbox => {

            checkbox.addEventListener(
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

    state.exportSizes =
        sizeOptions
            .filter(
                checkbox =>
                    checkbox.checked
            )
            .map(
                checkbox =>
                    Number(checkbox.value)
            )
            .filter(
                size =>
                    Number.isFinite(size) &&
                    size > 0
            );


    /*
     * Never allow an empty export pack.
     */

    if (!state.exportSizes.length) {

        const first =
            sizeOptions[0];

        if (first) {

            first.checked = true;

            state.exportSizes = [
                Number(first.value)
            ];

        }

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


            event.preventDefault();


            if (
                target.dataset.nextStep
            ) {

                goToStep(
                    Number(
                        target.dataset.nextStep
                    )
                );

                return;

            }


            if (
                target.dataset.prevStep
            ) {

                goToStep(
                    Number(
                        target.dataset.prevStep
                    )
                );

                return;

            }


            if (
                target.dataset.stepTarget
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

    step =
        clamp(
            Number(step),
            1,
            3
        );


    /*
     * Step 2 and 3 require
     * an uploaded image.
     */

    if (
        step > 1 &&
        !state.image
    ) {

        step = 1;

    }


    /*
     * Export requires at least
     * one selected size.
     */

    if (
        step === 3 &&
        !state.exportSizes.length
    ) {

        updateExportSizes();

    }


    state.currentStep =
        step;


    screens.forEach(
        screen => {

            const number =
                Number(
                    screen.dataset.screen
                );


            const active =
                number === step;


            if (active) {

                screen.removeAttribute(
                    "hidden"
                );

                screen.classList.add(
                    "active"
                );

            } else {

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


    updateSteps();


    if (step === 2) {

        requestAnimationFrame(
            () => renderPreview()
        );

    }


    if (step === 3) {

        prepareExportScreen();

    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/* =========================================================
   STEP INDICATOR
   ========================================================= */

function updateSteps() {

    steps.forEach(
        step => {

            const number =
                Number(
                    step.dataset.step
                );


            step.classList.toggle(
                "active",
                number === state.currentStep
            );


            step.classList.toggle(
                "completed",
                number < state.currentStep
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
   EXPORT SCREEN
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
            Math.min(
                256,
                Math.max(
                    ...state.exportSizes,
                    256
                )
            );


        const rendered =
            renderAtSize(
                previewSize
            );


        if (rendered) {

            const exportContext =
                exportCanvas.getContext(
                    "2d"
                );


            if (exportContext) {

                exportCanvas.width =
                    rendered.width;

                exportCanvas.height =
                    rendered.height;


                exportContext.clearRect(
                    0,
                    0,
                    rendered.width,
                    rendered.height
                );


                exportContext.drawImage(
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
   PAGE TRANSITIONS
   ========================================================= */

function bindPageTransitions() {

    document.addEventListener(
        "click",
        event => {

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


            /*
             * Ignore:
             * - anchors
             * - external links
             * - downloads
             * - new tabs
             */

            if (
                !href ||
                href.startsWith("#") ||
                href.startsWith("javascript:") ||
                link.target === "_blank" ||
                link.hasAttribute("download")
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


            if (
                url.origin !==
                window.location.origin
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


    window.addEventListener(
        "pageshow",
        () => {

            pageTransition?.classList.remove(
                "active"
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
             * Don't intercept keyboard input
             * while typing/selecting.
             */

            const tag =
                event.target?.tagName;


            if (
                tag === "INPUT" ||
                tag === "SELECT" ||
                tag === "TEXTAREA"
            ) {
                return;
            }


            /*
             * Arrow navigation
             */

            if (
                event.key === "ArrowRight"
            ) {

                if (
                    state.currentStep < 3
                ) {

                    goToStep(
                        state.currentStep + 1
                    );

                }

            }


            if (
                event.key === "ArrowLeft"
            ) {

                if (
                    state.currentStep > 1
                ) {

                    goToStep(
                        state.currentStep - 1
                    );

                }

            }


            /*
             * Escape returns to upload.
             */

            if (
                event.key === "Escape" &&
                state.currentStep > 1
            ) {

                goToStep(1);

            }

        }
    );

}


/* =========================================================
   EXPORT FALLBACK UI
   ========================================================= */

function createExportFallbackUI() {

    /*
     * This function does not modify the HTML structure.
     *
     * It only detects whether export controls
     * already exist.
     */

    const exportScreen =
        $('[data-screen="3"]');


    if (!exportScreen) {
        return;
    }


    const exportCanvas =
        $("#export-canvas");


    if (exportCanvas) {

        exportCanvas.setAttribute(
            "aria-label",
            "Favicon export preview"
        );

    }

}


/* =========================================================
   EXPORT SINGLE PNG
   ========================================================= */

function exportPNG(size) {

    if (
        !state.image ||
        state.exporting
    ) {
        return;
    }


    const numericSize =
        Number(size);


    if (
        !Number.isFinite(numericSize) ||
        numericSize <= 0
    ) {
        return;
    }


    const canvas =
        renderAtSize(
            numericSize
        );


    if (!canvas) {

        showMessage(
            "Unable to create the favicon.",
            "error"
        );

        return;

    }


    canvas.toBlob(
        blob => {

            if (!blob) {

                showMessage(
                    "Unable to generate the PNG.",
                    "error"
                );

                return;

            }


            downloadBlob(
                blob,
                `favicon-${numericSize}x${numericSize}.png`
            );

        },
        "image/png"
    );

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


    if (!state.exportSizes.length) {

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
            const size of state.exportSizes
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


            /*
             * Small delay prevents browsers
             * from blocking multiple downloads.
             */

            await wait(100);

        }


        showMessage(
            "Your favicon pack has been exported.",
            "success"
        );

    } catch (error) {

        console.error(
            "Favicon export failed:",
            error
        );


        showMessage(
            "Something went wrong while exporting.",
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
   CANVAS → BLOB
   ========================================================= */

function canvasToBlob(
    canvas,
    type = "image/png"
) {

    return new Promise(
        resolve => {

            canvas.toBlob(
                blob => {

                    resolve(blob);

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


    link.click();


    link.remove();


    setTimeout(
        () => {

            URL.revokeObjectURL(
                url
            );

        },
        1000
    );

}


/* =========================================================
   EXPORT BUTTON DISCOVERY
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
        "[data-export-pack]"
    ];


    selectors.forEach(
        selector => {

            $$(selector).forEach(
                button => {

                    if (
                        button instanceof
                        HTMLButtonElement
                    ) {

                        button.disabled =
                            disabled;

                    }

                }
            );

        }
    );

}


/* =========================================================
   EXPORT CLICK HANDLERS
   ========================================================= */

function bindExportEvents() {

    document.addEventListener(
        "click",
        event => {

            const target =
                event.target.closest(
                    "[data-export], [data-export-size], [data-export-pack]"
                );


            if (!target) {
                return;
            }


            event.preventDefault();


            if (
                target.hasAttribute(
                    "data-export-pack"
                )
            ) {

                exportPack();

                return;

            }


            const size =
                target.dataset.exportSize;


            if (size) {

                exportPNG(
                    Number(size)
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
   RESET TOOL
   ========================================================= */

function resetTool() {

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


    state.settings.size =
        mainSize
            ? Number(mainSize.value) || 256
            : 256;


    state.settings.fit =
        fitSelect
            ? fitSelect.value
            : "contain";


    state.settings.backgroundMode =
        backgroundMode
            ? backgroundMode.value
            : "transparent";


    state.settings.background =
        backgroundInput
            ? backgroundInput.value
            : "#ffffff";


    state.settings.radius =
        0;

    state.settings.zoom =
        100;

    state.settings.positionX =
        50;

    state.settings.positionY =
        50;


    if (previewCanvas) {

        previewCanvas.width =
            1;

        previewCanvas.height =
            1;

        previewCanvas.setAttribute(
            "hidden",
            ""
        );

    }


    emptyPreview?.removeAttribute(
        "hidden"
    );


    if (fileInput) {
        fileInput.value = "";
    }


    if (radiusInput) {
        radiusInput.value = "0";
    }

    if (zoomInput) {
        zoomInput.value = "100";
    }

    if (positionXInput) {
        positionXInput.value = "50";
    }

    if (positionYInput) {
        positionYInput.value = "50";
    }


    updateControlLabels();

    updateBackgroundControl();

    goToStep(1);

}


/* =========================================================
   OBJECT URL CLEANUP
   ========================================================= */

function releaseObjectURL() {

    if (state.objectURL) {

        URL.revokeObjectURL(
            state.objectURL
        );

        state.objectURL =
            null;

    }

}


/* =========================================================
   MESSAGE SYSTEM
   ========================================================= */

function showMessage(
    message,
    type = "info"
) {

    let container =
        $("#favicon-message");


    if (!container) {

        container =
            document.createElement(
                "div"
            );


        container.id =
            "favicon-message";


        container.setAttribute(
            "role",
            "status"
        );


        container.style.position =
            "fixed";

        container.style.left =
            "50%";

        container.style.bottom =
            "24px";

        container.style.transform =
            "translateX(-50%) translateY(20px)";

        container.style.zIndex =
            "10000";

        container.style.maxWidth =
            "calc(100% - 32px)";

        container.style.padding =
            "12px 18px";

        container.style.borderRadius =
            "14px";

        container.style.fontSize =
            "14px";

        container.style.fontWeight =
            "700";

        container.style.boxShadow =
                     "0 15px 40px rgba(20,30,70,.18)";

        container.style.opacity =
            "0";

        container.style.transition =
            "opacity .25s ease, transform .25s ease";

        document.body.appendChild(
            container
        );

    }


    container.textContent =
        message;


    /* -----------------------------------------------------
       MESSAGE TYPE
    ----------------------------------------------------- */

    if (type === "error") {

        container.style.background =
            "#fff0f0";

        container.style.color =
            "#b42318";

    } else if (type === "success") {

        container.style.background =
            "#ecfdf3";

        container.style.color =
            "#067647";

    } else {

        container.style.background =
            "#eef4ff";

        container.style.color =
            "#2457a6";

    }


    /* -----------------------------------------------------
       SHOW
    ----------------------------------------------------- */

    requestAnimationFrame(
        () => {

            container.style.opacity =
                "1";

            container.style.transform =
                "translateX(-50%) translateY(0)";

        }
    );


    clearTimeout(
        showMessage.timeout
    );


    showMessage.timeout =
        setTimeout(
            () => {

                container.style.opacity =
                    "0";

                container.style.transform =
                    "translateX(-50%) translateY(20px)";

            },
            3500
        );

}


/* =========================================================
   UTILITY — CLAMP
   ========================================================= */

function clamp(
    value,
    min,
    max
) {

    if (!Number.isFinite(value)) {
        return min;
    }

    return Math.min(
        Math.max(
            value,
            min
        ),
        max
    );

}


/* =========================================================
   UTILITY — WAIT
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
   INITIALIZE APPLICATION
   ========================================================= */

function initializeApplication() {

    init();

    bindExportEvents();

}


/* =========================================================
   DOM READY
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeApplication,
        {
            once: true
        }
    );

} else {

    initializeApplication();

}


/* =========================================================
   CLEANUP
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        releaseObjectURL();

    }
);


/* =========================================================
   GLOBAL DEBUG API
   ========================================================= */

/*
 * Useful while developing the tool.
 * Does not interfere with normal operation.
 */

window.NexaurenFavicon =
    Object.freeze({

        getState() {

            return {
                step:
                    state.currentStep,

                hasImage:
                    Boolean(state.image),

                imageWidth:
                    state.imageWidth,

                imageHeight:
                    state.imageHeight,

                settings:
                    {
                        ...state.settings
                    },

                exportSizes:
                    [...state.exportSizes]

            };

        },

        next() {

            goToStep(
                state.currentStep + 1
            );

        },

        previous() {

            goToStep(
                state.currentStep - 1
            );

        },

        reset() {

            resetTool();

        },

        render() {

            renderPreview();

        },

        exportPNG(size) {

            exportPNG(size);

        },

        exportPack() {

            exportPack();

        }

    });
