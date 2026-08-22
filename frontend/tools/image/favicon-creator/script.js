"use strict";

/* =========================================================
   NEXAUREN — FAVICON CREATOR V1
   ========================================================= */


/* =========================================================
   ELEMENT HELPER
   ========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   ELEMENTS
   ========================================================= */

let app;
let accessLoading;

let fileInput;
let chooseButton;
let dropZone;

let previewCanvas;
let emptyPreview;

let downloadPng;
let downloadIco;
let downloadZip;

let resetButton;
let copyCode;
let htmlCode;


/* =========================================================
   STATE
   ========================================================= */

let sourceImage = null;
let sourceData = null;
let initialized = false;


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /*
     * Get elements only after the DOM exists.
     */

    app = $("app");
    accessLoading = $("access-loading");

    fileInput = $("file-input");
    chooseButton = $("choose-button");
    dropZone = $("drop-zone");

    previewCanvas = $("preview-canvas");
    emptyPreview = $("empty-preview");

    downloadPng = $("download-png");
    downloadIco = $("download-ico");
    downloadZip = $("download-zip");

    resetButton = $("reset-button");
    copyCode = $("copy-code");
    htmlCode = $("html-code");


    /*
     * Start access verification.
     */

    checkSession();

});


/* =========================================================
   SESSION CHECK
   ========================================================= */

async function checkSession() {

    showAccessScreen(
        "Dream. Create. Build."
    );


    /*
     * Timeout prevents infinite loading.
     */

    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            () => controller.abort(),
            8000
        );


    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",
                    credentials: "include",
                    cache: "no-store",

                    headers: {
                        "Accept":
                            "application/json"
                    },

                    signal:
                        controller.signal
                }
            );


        clearTimeout(timeout);


        if (!response.ok) {

            redirectToLogin();

            return;

        }


        const data =
            await response.json();


        if (
            !data ||
            data.success !== true ||
            data.authenticated !== true ||
            !data.user
        ) {

            redirectToLogin();

            return;

        }


        /*
         * Authentication succeeded.
         */

        openTool();


    } catch (error) {

        clearTimeout(timeout);


        console.error(
            "Nexauren Favicon Creator access error:",
            error
        );


        /*
         * Never leave the user stuck
         * on an infinite spinner.
         */

        redirectToLogin();

    }

}


/* =========================================================
   ACCESS SCREEN
   ========================================================= */

function showAccessScreen(message) {

    if (accessLoading) {

        accessLoading.hidden = false;

        const messageElement =
            accessLoading.querySelector(
                "[data-access-message]"
            );

        if (messageElement) {

            messageElement.textContent =
                message;

        } else {

            /*
             * Fallback for older HTML.
             */

            const text =
                accessLoading.querySelector(
                    ".loading-text"
                );

            if (text) {
                text.textContent = message;
            }

        }

    }


    if (app) {

        app.hidden = true;

    }

}


/* =========================================================
   OPEN TOOL
   ========================================================= */

function openTool() {

    if (accessLoading) {

        accessLoading.hidden = true;

    }


    if (app) {

        app.hidden = false;

    }


    document.body.classList.add(
        "authenticated"
    );


    /*
     * Prevent duplicate event listeners.
     */

    if (!initialized) {

        initializeTool();

        initialized = true;

    }

}


/* =========================================================
   LOGIN REDIRECT
   ========================================================= */

function redirectToLogin() {

    window.location.href =
        "/login";

}


/* =========================================================
   TOOL INITIALIZATION
   ========================================================= */

function initializeTool() {

    setupUpload();

    setupControls();

    setupDownloads();

    setupReset();

    setupCopy();

    updateHtmlCode();

}


/* =========================================================
   UPLOAD
   ========================================================= */

function setupUpload() {

    if (!fileInput || !dropZone) {

        console.error(
            "Favicon Creator: upload elements missing."
        );

        return;

    }


    if (chooseButton) {

        chooseButton.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                fileInput.click();

            }
        );

    }


    dropZone.addEventListener(
        "click",
        () => {

            fileInput.click();

        }
    );


    fileInput.addEventListener(
        "change",
        () => {

            const selectedFile =
                fileInput.files &&
                fileInput.files[0];


            if (selectedFile) {

                loadImage(
                    selectedFile
                );

            }

        }
    );


    dropZone.addEventListener(
        "dragover",
        (event) => {

            event.preventDefault();

            dropZone.classList.add(
                "dragging"
            );

        }
    );


    dropZone.addEventListener(
        "dragleave",
        () => {

            dropZone.classList.remove(
                "dragging"
            );

        }
    );


    dropZone.addEventListener(
        "drop",
        (event) => {

            event.preventDefault();

            dropZone.classList.remove(
                "dragging"
            );


            const selectedFile =
                event.dataTransfer.files &&
                event.dataTransfer.files[0];


            if (selectedFile) {

                loadImage(
                    selectedFile
                );

            }

        }
    );

}


/* =========================================================
   LOAD IMAGE
   ========================================================= */

function loadImage(file) {

    const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/webp"
    ];


    if (
        !allowedTypes.includes(
            file.type
        )
    ) {

        alert(
            "Please select a PNG, JPG, JPEG or WebP image."
        );

        return;

    }


    const reader =
        new FileReader();


    reader.onload = () => {

        const image =
            new Image();


        image.onload = () => {

            sourceImage =
                image;

            sourceData =
                reader.result;


            if (emptyPreview) {

                emptyPreview.hidden =
                    true;

            }


            if (previewCanvas) {

                previewCanvas.hidden =
                    false;

            }


            enableTool();

            render();

        };


        image.onerror = () => {

            alert(
                "Unable to read this image."
            );

        };


        image.src =
            reader.result;

    };


    reader.onerror = () => {

        alert(
            "Unable to load this file."
        );

    };


    reader.readAsDataURL(file);

}


/* =========================================================
   ENABLE TOOL
   ========================================================= */

function enableTool() {

    if (downloadPng) {

        downloadPng.disabled =
            false;

    }


    if (downloadIco) {

        downloadIco.disabled =
            false;

    }


    if (downloadZip) {

        downloadZip.disabled =
            false;

    }


    if (copyCode) {

        copyCode.disabled =
            false;

    }

}


/* =========================================================
   CONTROLS
   ========================================================= */

function setupControls() {

    const controls = [
        "main-size",
        "fit",
        "background-mode",
        "background"
    ];


    controls.forEach(
        (id) => {

            const element =
                $(id);


            if (!element) {
                return;
            }


            element.addEventListener(
                "change",
                render
            );

        }
    );


    const sliders = [
        ["radius", "radius-value"],
        ["zoom", "zoom-value"],
        ["position-x", "x-value"],
        ["position-y", "y-value"]
    ];


    sliders.forEach(
        ([inputId, valueId]) => {

            const input =
                $(inputId);

            const output =
                $(valueId);


            if (!input) {
                return;
            }


            input.addEventListener(
                "input",
                () => {

                    if (output) {

                        output.textContent =
                            input.value;

                    }


                    render();

                }
            );

        }
    );


    document
        .querySelectorAll(
            ".size-option"
        )
        .forEach(
            (checkbox) => {

                checkbox.addEventListener(
                    "change",
                    render
                );

            }
        );

}


/* =========================================================
   DRAW
   ========================================================= */

function draw(size) {

    const canvas =
        document.createElement(
            "canvas"
        );


    canvas.width =
        size;

    canvas.height =
        size;


    const ctx =
        canvas.getContext(
            "2d"
        );


    if (!sourceImage) {

        return canvas;

    }


    /*
     * Background
     */

    const backgroundMode =
        $("background-mode");

    const background =
        $("background");


    if (
        backgroundMode &&
        backgroundMode.value === "color" &&
        background
    ) {

        ctx.fillStyle =
            background.value;

        ctx.fillRect(
            0,
            0,
            size,
            size
        );

    }


    /*
     * Rounded corners
     */

    const radiusInput =
        $("radius");


    const radius =
        radiusInput
            ? size *
              (
                  Number(
                      radiusInput.value
                  ) / 100
              )
            : 0;


    if (radius > 0) {

        ctx.save();

        roundRect(
            ctx,
            0,
            0,
            size,
            size,
            radius
        );

        ctx.clip();

    }


    /*
     * Fit
     */

    const fitElement =
        $("fit");


    const fit =
        fitElement
            ? fitElement.value
            : "contain";


    const zoomElement =
        $("zoom");


    const scale =
        zoomElement
            ? Number(
                zoomElement.value
              ) / 100
            : 1;


    let ratio;


    if (fit === "cover") {

        ratio =
            Math.max(
                size /
                    sourceImage.width,

                size /
                    sourceImage.height
            );

    } else {

        ratio =
            Math.min(
                size /
                    sourceImage.width,

                size /
                    sourceImage.height
            );

    }


    const width =
        sourceImage.width *
        ratio *
        scale;


    const height =
        sourceImage.height *
        ratio *
        scale;


    const positionXElement =
        $("position-x");


    const positionYElement =
        $("position-y");


    const positionX =
        positionXElement
            ? Number(
                positionXElement.value
              ) / 100
            : 0.5;


    const positionY =
        positionYElement
            ? Number(
                positionYElement.value
              ) / 100
            : 0.5;


    const x =
        (size - width) *
        positionX;


    const y =
        (size - height) *
        positionY;


    ctx.drawImage(
        sourceImage,
        x,
        y,
        width,
        height
    );


    if (radius > 0) {

        ctx.restore();

    }


    return canvas;

}


/* =========================================================
   ROUNDED RECTANGLE
   ========================================================= */

function roundRect(
    ctx,
    x,
    y,
    width,
    height,
    radius
) {

    const r =
        Math.min(
            radius,
            width / 2,
            height / 2
        );


    ctx.beginPath();

    ctx.moveTo(
        x + r,
        y
    );

    ctx.arcTo(
        x + width,
        y,
        x + width,
        y + height,
        r
    );

    ctx.arcTo(
        x + width,
        y + height,
        x,
        y + height,
        r
    );

    ctx.arcTo(
        x,
        y + height,
        x,
        y,
        r
    );

    ctx.arcTo(
        x,
        y,
        x + width,
        y,
        r
    );

    ctx.closePath();

}


/* =========================================================
   RENDER
   ========================================================= */

function render() {

    if (
        !sourceImage ||
        !previewCanvas
    ) {

        return;

    }


    const sizeElement =
        $("main-size");


    const size =
        sizeElement
            ? Number(
                sizeElement.value
              )
            : 256;


    const canvas =
        draw(size);


    const ctx =
        previewCanvas.getContext(
            "2d"
        );


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


    ctx.drawImage(
        canvas,
        0,
        0
    );


    updateHtmlCode();

}


/* =========================================================
   SELECTED SIZES
   ========================================================= */

function selectedSizes() {

    return [
        ...document.querySelectorAll(
            ".size-option:checked"
        )
    ].map(
        checkbox =>
            Number(
                checkbox.value
            )
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


    const anchor =
        document.createElement(
            "a"
        );


    anchor.href =
        url;

    anchor.download =
        filename;


    document.body.appendChild(
        anchor
    );


    anchor.click();

    anchor.remove();


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
   DOWNLOADS
   ========================================================= */

function setupDownloads() {

    if (downloadPng) {

        downloadPng.addEventListener(
            "click",
            () => {

                if (!sourceImage) {
                    return;
                }


                const size =
                    Number(
                        $("main-size").value
                    );


                const canvas =
                    draw(size);


                canvas.toBlob(
                    (blob) => {

                        downloadBlob(
                            blob,
                            `favicon-${size}x${size}.png`
                        );

                    },
                    "image/png"
                );

            }
        );

    }


    /*
     * V1 ICO fallback.
     *
     * We do not rename PNG to ICO.
     */

    if (downloadIco) {

        downloadIco.addEventListener(
            "click",
            () => {

                if (!sourceImage) {
                    return;
                }


                const canvas =
                    draw(32);


                canvas.toBlob(
                    (blob) => {

                        downloadBlob(
                            blob,
                            "favicon-32x32.png"
                        );

                    },
                    "image/png"
                );

            }
        );

    }


    if (downloadZip) {

        downloadZip.addEventListener(
            "click",
            createZip
        );

    }

}


/* =========================================================
   ZIP
   ========================================================= */

async function createZip() {

    if (!sourceImage) {
        return;
    }


    const sizes =
        selectedSizes();


    if (!sizes.length) {

        alert(
            "Select at least one favicon size."
        );

        return;

    }


    downloadZip.disabled =
        true;

    downloadZip.textContent =
        "Creating pack...";


    try {

        if (!window.JSZip) {

            await loadScript(
                "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
            );

        }


        const zip =
            new window.JSZip();


        const folder =
            zip.folder(
                "nexauren-favicon-pack"
            );


        for (
            const size of sizes
        ) {

            const canvas =
                draw(size);


            const blob =
                await canvasToBlob(
                    canvas
                );


            if (blob) {

                folder.file(
                    `favicon-${size}x${size}.png`,
                    blob
                );

            }

        }


        folder.file(
            "favicon-code.html",
            htmlCode
                ? htmlCode.value
                : ""
        );


        folder.file(
            "README.txt",
            [
                "NEXAUREN FAVICON PACK",
                "",
                "Generated with Nexauren Favicon Creator V1.",
                "",
                "PNG favicon files are included.",
                "",
                "Use favicon-code.html inside your website <head>.",
                ""
            ].join("\n")
        );


        const output =
            await zip.generateAsync({
                type: "blob"
            });


        downloadBlob(
            output,
            "nexauren-favicon-pack.zip"
        );


    } catch (error) {

        console.error(
            "ZIP creation error:",
            error
        );


                alert(
            "Unable to create the favicon pack."
        );


    } finally {

        downloadZip.disabled =
            false;

        downloadZip.textContent =
            "Download Favicon Pack";

    }

}


/* =========================================================
   CANVAS TO BLOB
   ========================================================= */

function canvasToBlob(canvas) {

    return new Promise(
        (resolve) => {

            canvas.toBlob(
                resolve,
                "image/png"
            );

        }
    );

}


/* =========================================================
   LOAD EXTERNAL SCRIPT
   ========================================================= */

function loadScript(src) {

    return new Promise(
        (resolve, reject) => {

            const script =
                document.createElement(
                    "script"
                );


            script.src =
                src;

            script.async =
                true;


            script.onload =
                () => resolve();


            script.onerror =
                () => reject(
                    new Error(
                        "Failed to load external library."
                    )
                );


            document.head.appendChild(
                script
            );

        }
    );

}


/* =========================================================
   HTML CODE
   ========================================================= */

function updateHtmlCode() {

    if (!htmlCode) {
        return;
    }


    htmlCode.value =
`<!-- Nexauren Favicon -->

<link
    rel="icon"
    type="image/png"
    sizes="32x32"
    href="/favicon-32x32.png"
>

<link
    rel="icon"
    type="image/png"
    sizes="16x16"
    href="/favicon-16x16.png"
>`;


}


/* =========================================================
   COPY HTML
   ========================================================= */

function setupCopy() {

    if (!copyCode) {
        return;
    }


    copyCode.addEventListener(
        "click",
        async () => {

            if (!htmlCode) {
                return;
            }


            try {

                await navigator.clipboard.writeText(
                    htmlCode.value
                );


                const originalText =
                    copyCode.textContent;


                copyCode.textContent =
                    "Copied ✓";


                setTimeout(
                    () => {

                        copyCode.textContent =
                            originalText;

                    },
                    1200
                );


            } catch (error) {

                /*
                 * Clipboard fallback
                 */

                try {

                    htmlCode.focus();

                    htmlCode.select();

                    document.execCommand(
                        "copy"
                    );


                    copyCode.textContent =
                        "Copied ✓";


                    setTimeout(
                        () => {

                            copyCode.textContent =
                                "Copy HTML";

                        },
                        1200
                    );


                } catch (fallbackError) {

                    console.error(
                        "Copy error:",
                        fallbackError
                    );


                    alert(
                        "Unable to copy the HTML code."
                    );

                }

            }

        }
    );

}


/* =========================================================
   RESET
   ========================================================= */

function setupReset() {

    if (!resetButton) {
        return;
    }


    resetButton.addEventListener(
        "click",
        () => {

            sourceImage =
                null;

            sourceData =
                null;


            if (fileInput) {

                fileInput.value =
                    "";

            }


            if (previewCanvas) {

                previewCanvas.hidden =
                    true;

                const ctx =
                    previewCanvas.getContext(
                        "2d"
                    );


                if (ctx) {

                    ctx.clearRect(
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


            if (downloadPng) {

                downloadPng.disabled =
                    true;

            }


            if (downloadIco) {

                downloadIco.disabled =
                    true;

            }


            if (downloadZip) {

                downloadZip.disabled =
                    true;

            }


            if (copyCode) {

                copyCode.disabled =
                    true;

            }


            /*
             * Restore controls
             */

            const defaults = {
                "main-size": "256",
                "fit": "contain",
                "background-mode": "transparent",
                "background": "#ffffff",
                "radius": "0",
                "zoom": "100",
                "position-x": "50",
                "position-y": "50"
            };


            Object.entries(
                defaults
            ).forEach(
                ([id, value]) => {

                    const element =
                        $(id);


                    if (element) {

                        element.value =
                            value;

                    }

                }
            );


            /*
             * Restore slider labels
             */

            const values = {
                "radius-value": "0",
                "zoom-value": "100",
                "x-value": "50",
                "y-value": "50"
            };


            Object.entries(
                values
            ).forEach(
                ([id, value]) => {

                    const element =
                        $(id);


                    if (element) {

                        element.textContent =
                            value;

                    }

                }
            );


            updateHtmlCode();

        }
    );

}


/* =========================================================
   INITIAL UI STATE
   ========================================================= */

function initializeUiState() {

    /*
     * Make sure the tool remains hidden
     * until authentication succeeds.
     */

    if (app) {

        app.hidden =
            true;

    }


    if (accessLoading) {

        accessLoading.hidden =
            false;

    }


    /*
     * Disable actions before
     * an image is selected.
     */

    if (downloadPng) {

        downloadPng.disabled =
            true;

    }


    if (downloadIco) {

        downloadIco.disabled =
            true;

    }


    if (downloadZip) {

        downloadZip.disabled =
            true;

    }


    if (copyCode) {

        copyCode.disabled =
            true;

    }

}


/* =========================================================
   RUN INITIAL UI STATE
   ========================================================= */

initializeUiState();
