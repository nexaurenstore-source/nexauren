/* =========================================================
   NEXAUREN — FAVICON CREATOR
   SCRIPT.JS
   ========================================================= */

"use strict";


/* =========================================================
   DOM
   ========================================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];


/* =========================================================
   ELEMENTS
   ========================================================= */

const app = $("#app");
const pageTransition = $("#page-transition");

const dropZone = $("#drop-zone");
const chooseButton = $("#choose-button");
const fileInput = $("#file-input");

const emptyPreview = $("#empty-preview");
const previewCanvas = $("#preview-canvas");

const mainSize = $("#main-size");
const fitSelect = $("#fit");
const backgroundMode = $("#background-mode");
const backgroundInput = $("#background");

const radiusInput = $("#radius");
const zoomInput = $("#zoom");
const positionXInput = $("#position-x");
const positionYInput = $("#position-y");

const radiusValue = $("#radius-value");
const zoomValue = $("#zoom-value");
const xValue = $("#x-value");
const yValue = $("#y-value");

const sizeOptions = $$(".size-option");

const screens = $$(".tool-screen");
const steps = $$(".step");


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
        64
    ]

};


/* =========================================================
   CANVAS CONTEXT
   ========================================================= */

const ctx = previewCanvas
    ? previewCanvas.getContext("2d", {
        alpha: true,
        willReadFrequently: false
    })
    : null;


/* =========================================================
   INITIALIZATION
   ========================================================= */

function init() {

    if (!previewCanvas || !ctx) {
        console.error(
            "Nexauren Favicon Creator: Canvas is not supported."
        );
        return;
    }

    bindUploadEvents();

    bindControls();

    bindNavigation();

    bindSizeOptions();

    bindPageTransitions();

    updateControlValues();

    updateBackgroundControl();

    updateSteps();

    updateExportSizes();

}


/* =========================================================
   UPLOAD EVENTS
   ========================================================= */

function bindUploadEvents() {

    if (!dropZone || !fileInput) {
        return;
    }


    chooseButton?.addEventListener(
        "click",
        (event) => {

            event.stopPropagation();

            fileInput.click();

        }
    );


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


    fileInput.addEventListener(
        "change",
        (event) => {

            const file =
                event.target.files?.[0];

            if (file) {
                loadImage(file);
            }

        }
    );


    [
        "dragenter",
        "dragover"
    ].forEach((eventName) => {

        dropZone.addEventListener(
            eventName,
            (event) => {

                event.preventDefault();

                event.stopPropagation();

                dropZone.classList.add(
                    "dragging"
                );

            }
        );

    });


    [
        "dragleave",
        "drop"
    ].forEach((eventName) => {

        dropZone.addEventListener(
            eventName,
            (event) => {

                event.preventDefault();

                event.stopPropagation();

                dropZone.classList.remove(
                    "dragging"
                );

            }
        );

    });


    dropZone.addEventListener(
        "drop",
        (event) => {

            const files =
                event.dataTransfer?.files;

            if (!files || !files.length) {
                return;
            }

            const file = files[0];

            loadImage(file);

        }
    );

}


/* =========================================================
   IMAGE VALIDATION
   ========================================================= */

function isValidImage(file) {

    if (!file) {
        return false;
    }

    const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp"
    ];

    return allowedTypes.includes(
        file.type
    );

}


/* =========================================================
   LOAD IMAGE
   ========================================================= */

function loadImage(file) {

    if (!isValidImage(file)) {

        showMessage(
            "Please choose a PNG, JPG, JPEG or WebP image."
        );

        return;
    }


    const maxFileSize =
        25 * 1024 * 1024;


    if (file.size > maxFileSize) {

        showMessage(
            "The image is too large. Maximum size is 25 MB."
        );

        return;
    }


    if (state.objectURL) {

        URL.revokeObjectURL(
            state.objectURL
        );

    }


    state.file = file;

    state.objectURL =
        URL.createObjectURL(file);


    const image =
        new Image();


    image.onload = () => {

        state.image = image;

        state.imageWidth =
            image.naturalWidth;

        state.imageHeight =
            image.naturalHeight;


        renderPreview();

        goToStep(2);

    };


    image.onerror = () => {

        showMessage(
            "Unable to read this image."
        );

    };


    image.src =
        state.objectURL;

}


/* =========================================================
   CONTROLS
   ========================================================= */

function bindControls() {


    mainSize?.addEventListener(
        "change",
        () => {

            state.settings.size =
                Number(mainSize.value);

            renderPreview();

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
                Number(radiusInput.value);

            updateControlValues();

            renderPreview();

        }
    );


    zoomInput?.addEventListener(
        "input",
        () => {

            state.settings.zoom =
                Number(zoomInput.value);

            updateControlValues();

            renderPreview();

        }
    );


    positionXInput?.addEventListener(
        "input",
        () => {

            state.settings.positionX =
                Number(positionXInput.value);

            updateControlValues();

            renderPreview();

        }
    );


    positionYInput?.addEventListener(
        "input",
        () => {

            state.settings.positionY =
                Number(positionYInput.value);

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
        enabled ? "1" : ".45";

}


/* =========================================================
   RENDER PREVIEW
   ========================================================= */

function renderPreview() {

    if (!state.image || !ctx) {
        return;
    }


    const size =
        state.settings.size;


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
       CLIPPING
    ----------------------------------------------------- */

    const radius =
        size *
        (state.settings.radius / 100);


    ctx.save();

    if (radius > 0) {

        roundedRect(
            ctx,
            0,
            0,
            size,
            size,
            radius
        );

        ctx.clip();

    }


    /* -----------------------------------------------------
       IMAGE
    ----------------------------------------------------- */

    drawImageToCanvas(
        ctx,
        state.image,
        size
    );


    ctx.restore();


    /* -----------------------------------------------------
       UI
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

function drawImageToCanvas(
    context,
    image,
    size
) {

    const imageWidth =
        image.naturalWidth;

    const imageHeight =
        image.naturalHeight;


    const fit =
        state.settings.fit;


    const zoom =
        state.settings.zoom / 100;


    let scale;


    if (fit === "cover") {

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


    /*
     * Position values:
     *
     * 0%   = left / top
     * 50%  = center
     * 100% = right / bottom
     */

    const availableX =
        size - drawWidth;

    const availableY =
        size - drawHeight;


    const x =
        availableX *
        (state.settings.positionX / 100);


    const y =
        availableY *
        (state.settings.positionY / 100);


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
   ROUNDED RECT
   ========================================================= */

function roundedRect(
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
   SIZE OPTIONS
   ========================================================= */

function bindSizeOptions() {

    sizeOptions.forEach(
        (checkbox) => {

            checkbox.addEventListener(
                "change",
                updateExportSizes
            );

        }
    );

}


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
                    Number.isFinite(size)
            );


    /*
     * Always keep at least one
     * valid export size.
     */

    if (!state.exportSizes.length) {

        const first =
            sizeOptions[0];

        if (first) {

            first.checked =
                true;

            state.exportSizes =
                [Number(first.value)];

        }

    }

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function bindNavigation() {

    document.addEventListener(
        "click",
        (event) => {

            const target =
                event.target.closest(
                    "[data-next-step], [data-prev-step], [data-step-target]"
                );


            if (!target) {
                return;
            }


            const next =
                target.dataset.nextStep;

            const previous =
                target.dataset.prevStep;

            const direct =
                target.dataset.stepTarget;


            if (next) {

                goToStep(
                    Number(next)
                );

            }


            if (previous) {

                goToStep(
                    Number(previous)
                );

            }


            if (direct) {

                goToStep(
                    Number(direct)
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
        Math.max(
            1,
            Math.min(
                3,
                Number(step)
            )
        );


    /*
     * Do not allow export/customization
     * without an image.
     */

    if (
        step > 1 &&
        !state.image
    ) {

        step = 1;

    }


    state.currentStep =
        step;


    screens.forEach(
        (screen) => {

            const screenNumber =
                Number(
                    screen.dataset.screen
                );


            if (
                screenNumber === step
            ) {

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


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    /*
     * Refresh export screen
     * whenever the user enters it.
     */

    if (step === 3) {

        prepareExportScreen();

    }

}


/* =========================================================
   STEP INDICATOR
   ========================================================= */

function updateSteps() {

    steps.forEach(
        (stepElement) => {

            const number =
                Number(
                    stepElement.dataset.step
                );


            stepElement.classList.toggle(
                "active",
                number === state.currentStep
            );


            stepElement.classList.toggle(
                "completed",
                number < state.currentStep
            );

        }
    );


    /*
     * Update connecting lines.
     */

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

    const exportCanvas =
        $("#export-canvas");


    if (
        exportCanvas &&
        state.image
    ) {

        renderCanvasAtSize(
            exportCanvas,
            256
        );

    }


    const exportList =
        $("#export-size-list");


    if (exportList) {

        exportList.innerHTML =
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

}


/* =========================================================
   RENDER AT SPECIFIC SIZE
   ========================================================= */

function renderCanvasAtSize(
    canvas,
    size
) {

    if (!state.image) {
        return;
    }


    const context =
        canvas.getContext(
            "2d"
        );


    canvas.width =
        size;

    canvas.height =
        size;


    context.clearRect(
        0,
        0,
        size,
        size
    );


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


    context.save();


        const radius =
        size *
        (state.settings.radius / 100);


    if (radius > 0) {

        roundedRect(
            context,
            0,
            0,
            size,
            size,
            radius
        );

        context.clip();

    }


    drawImageToCanvas(
        context,
        state.image,
        size
    );


    context.restore();

}


/* =========================================================
   EXPORT ACTIONS
   ========================================================= */

function bindExportActions() {

    const downloadPackButton =
        $("#download-pack");

    const downloadSingleButton =
        $("#download-single");

    downloadPackButton?.addEventListener(
        "click",
        downloadFaviconPack
    );

    downloadSingleButton?.addEventListener(
        "click",
        downloadSingleFavicon
    );

}


/* =========================================================
   DOWNLOAD SINGLE FAVICON
   ========================================================= */

function downloadSingleFavicon() {

    if (!state.image) {

        showMessage(
            "Please upload an image first."
        );

        return;

    }


    const size =
        state.settings.size;


    const canvas =
        document.createElement("canvas");


    renderCanvasAtSize(
        canvas,
        size
    );


    canvas.toBlob(
        (blob) => {

            if (!blob) {

                showMessage(
                    "Unable to create the favicon."
                );

                return;

            }


            downloadBlob(
                blob,
                `favicon-${size}x${size}.png`
            );

        },
        "image/png"
    );

}


/* =========================================================
   DOWNLOAD FAVICON PACK
   ========================================================= */

async function downloadFaviconPack() {

    if (!state.image) {

        showMessage(
            "Please upload an image first."
        );

        return;

    }


    if (!state.exportSizes.length) {

        showMessage(
            "Choose at least one favicon size."
        );

        return;

    }


    const button =
        $("#download-pack");


    setButtonLoading(
        button,
        true
    );


    try {

        /*
         * ZIP is loaded only when needed.
         * This keeps the initial page lighter.
         */

        const JSZip =
            await loadJSZip();


        const zip =
            new JSZip();


        for (
            const size
            of state.exportSizes
        ) {

            const canvas =
                document.createElement(
                    "canvas"
                );


            renderCanvasAtSize(
                canvas,
                size
            );


            const blob =
                await canvasToBlob(
                    canvas,
                    "image/png"
                );


            zip.file(
                `favicon-${size}x${size}.png`,
                blob
            );

        }


        /*
         * Include a simple README
         * describing the generated files.
         */

        zip.file(
            "README.txt",
            createExportReadme()
        );


        const zipBlob =
            await zip.generateAsync({
                type: "blob",
                compression: "DEFLATE",
                compressionOptions: {
                    level: 6
                }
            });


        downloadBlob(
            zipBlob,
            "nexauren-favicon-pack.zip"
        );


        showMessage(
            "Your favicon pack is ready."
        );

    } catch (error) {

        console.error(
            "Favicon export error:",
            error
        );


        showMessage(
            "Unable to create the favicon pack."
        );

    } finally {

        setButtonLoading(
            button,
            false
        );

    }

}


/* =========================================================
   LOAD JSZIP
   ========================================================= */

function loadJSZip() {

    if (window.JSZip) {

        return Promise.resolve(
            window.JSZip
        );

    }


    return new Promise(
        (resolve, reject) => {

            const existing =
                document.querySelector(
                    'script[data-jszip]'
                );


            if (existing) {

                existing.addEventListener(
                    "load",
                    () => {

                        if (window.JSZip) {
                            resolve(
                                window.JSZip
                            );
                        } else {
                            reject(
                                new Error(
                                    "JSZip failed to load."
                                )
                            );
                        }

                    }
                );


                existing.addEventListener(
                    "error",
                    reject
                );


                return;

            }


            const script =
                document.createElement(
                    "script"
                );


            script.src =
                "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";

            script.async =
                true;

            script.dataset.jszip =
                "true";


            script.onload = () => {

                if (window.JSZip) {

                    resolve(
                        window.JSZip
                    );

                } else {

                    reject(
                        new Error(
                            "JSZip is unavailable."
                        )
                    );

                }

            };


            script.onerror =
                () => reject(
                    new Error(
                        "Could not load JSZip."
                    )
                );


            document.head.appendChild(
                script
            );

        }
    );

}


/* =========================================================
   CANVAS → BLOB
   ========================================================= */

function canvasToBlob(
    canvas,
    type = "image/png",
    quality
) {

    return new Promise(
        (resolve, reject) => {

            canvas.toBlob(
                (blob) => {

                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(
                            new Error(
                                "Canvas conversion failed."
                            )
                        );
                    }

                },
                type,
                quality
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
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


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


    /*
     * Delay revocation slightly so
     * mobile browsers have time to
     * begin the download.
     */

    setTimeout(
        () => {
            URL.revokeObjectURL(url);
        },
        1500
    );

}


/* =========================================================
   EXPORT README
   ========================================================= */

function createExportReadme() {

    const sizes =
        state.exportSizes
            .map(
                size =>
                    `${size} × ${size}`
            )
            .join(", ");


    return `NEXAUREN — FAVICON PACK

Generated locally in your browser.

Included sizes:
${sizes}

Source image:
${state.file?.name || "Unknown"}

Image dimensions:
${state.imageWidth} × ${state.imageHeight}

Settings:
- Fit: ${state.settings.fit}
- Background: ${state.settings.backgroundMode}
- Radius: ${state.settings.radius}%
- Zoom: ${state.settings.zoom}%
- Position X: ${state.settings.positionX}%
- Position Y: ${state.settings.positionY}%

No image was uploaded to a server by this tool.
`;


}


/* =========================================================
   BUTTON LOADING STATE
   ========================================================= */

function setButtonLoading(
    button,
    loading
) {

    if (!button) {
        return;
    }


    if (loading) {

        button.dataset.originalText =
            button.textContent;


        button.disabled =
            true;


        button.setAttribute(
            "aria-busy",
            "true"
        );


        button.textContent =
            "Creating pack…";

    } else {

        button.disabled =
            false;


        button.removeAttribute(
            "aria-busy"
        );


        if (
            button.dataset.originalText
        ) {

            button.textContent =
                button.dataset.originalText;

        }

    }

}


/* =========================================================
   PAGE TRANSITIONS
   ========================================================= */

function bindPageTransitions() {

    document.addEventListener(
        "click",
        (event) => {

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
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }


            /*
             * Only animate normal internal
             * navigation.
             */

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


            pageTransition?.classList.add(
                "active"
            );


            setTimeout(
                () => {

                    window.location.href =
                        url.href;

                },
                220
            );

        }
    );

}


/* =========================================================
   MESSAGE SYSTEM
   ========================================================= */

function showMessage(
    message
) {

    /*
     * Reuse an existing message
     * element when possible.
     */

    let toast =
        $("#favicon-toast");


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );


        toast.id =
            "favicon-toast";


        toast.className =
            "favicon-toast";


        toast.setAttribute(
            "role",
            "status"
        );


        document.body.appendChild(
            toast
        );

    }


    toast.textContent =
        message;


    toast.classList.add(
        "visible"
    );


    clearTimeout(
        showMessage.timeout
    );


    showMessage.timeout =
        setTimeout(
            () => {

                toast.classList.remove(
                    "visible"
                );

            },
            3200
        );

}


/* =========================================================
   RESET TOOL
   ========================================================= */

function resetTool() {

    if (state.objectURL) {

        URL.revokeObjectURL(
            state.objectURL
        );

    }


    state.image =
        null;

    state.file =
        null;

    state.objectURL =
        null;

    state.imageWidth =
        0;

    state.imageHeight =
        0;


    state.settings = {

        size: 256,

        fit: "contain",

        backgroundMode: "transparent",

        background: "#ffffff",

        radius: 0,

        zoom: 100,

        positionX: 50,

        positionY: 50

    };


    if (fileInput) {
        fileInput.value =
            "";
    }


    if (mainSize) {
        mainSize.value =
            "256";
    }


    if (fitSelect) {
        fitSelect.value =
            "contain";
    }


    if (backgroundMode) {
        backgroundMode.value =
            "transparent";
    }


    if (backgroundInput) {
        backgroundInput.value =
            "#ffffff";
    }


    if (radiusInput) {
        radiusInput.value =
            "0";
    }


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


    if (ctx) {

        ctx.clearRect(
            0,
            0,
            previewCanvas.width,
            previewCanvas.height
        );

    }


    previewCanvas?.setAttribute(
        "hidden",
        ""
    );


    emptyPreview?.removeAttribute(
        "hidden"
    );


    sizeOptions.forEach(
        (checkbox) => {

            checkbox.checked =
                [16, 32, 48, 64]
                    .includes(
                        Number(
                            checkbox.value
                        )
                    );

        }
    );


    updateExportSizes();

    updateControlValues();

    updateBackgroundControl();

    goToStep(1);

}


/* =========================================================
   BEFORE UNLOAD
   ========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (state.objectURL) {

            URL.revokeObjectURL(
                state.objectURL
            );

        }

    }
);


/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            init();

        },
        {
            once: true
        }
    );

} else {

    init();

}
