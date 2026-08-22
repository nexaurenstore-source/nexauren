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

const app = $("app");
const accessLoading = $("access-loading");

const fileInput = $("file-input");
const chooseButton = $("choose-button");
const dropZone = $("drop-zone");

const previewCanvas = $("preview-canvas");
const emptyPreview = $("empty-preview");

const downloadPng = $("download-png");
const downloadIco = $("download-ico");
const downloadZip = $("download-zip");

const resetButton = $("reset-button");
const copyCode = $("copy-code");
const htmlCode = $("html-code");


/* =========================================================
   STATE
   ========================================================= */

let sourceImage = null;
let sourceData = null;


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const authenticated =
            await checkSession();

        if (!authenticated) {
            return;
        }

        initializeTool();

    }
);


/* =========================================================
   SESSION
   ========================================================= */

async function checkSession() {

    /*
     * The user should not see technical
     * session information.
     *
     * The loading message is handled
     * by the HTML:
     *
     * Dream. Create. Build.
     */

    try {

        const response =
            await fetch(
                "/api/me",
                {
                    method: "GET",
                    credentials: "include",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            redirectToLogin();

            return false;

        }


        const data =
            await response.json();


        if (
            !data.success ||
            !data.authenticated ||
            !data.user
        ) {

            redirectToLogin();

            return false;

        }


        /*
         * Session exists.
         * Show the tool.
         */

        if (accessLoading) {
            accessLoading.hidden = true;
        }

        if (app) {
            app.hidden = false;
        }

        document.body.classList.add(
            "authenticated"
        );


        return true;


    } catch (error) {

        console.error(
            "Favicon Creator session error:",
            error
        );


        redirectToLogin();

        return false;

    }

}


/* =========================================================
   LOGIN REDIRECT
   ========================================================= */

function redirectToLogin() {

    window.location.href = "/login";

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

            const file =
                fileInput.files[0];

            if (file) {
                loadImage(file);
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


            const file =
                event.dataTransfer.files[0];


            if (file) {
                loadImage(file);
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


    if (!allowedTypes.includes(file.type)) {

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

            sourceImage = image;

            sourceData =
                reader.result;


            if (emptyPreview) {
                emptyPreview.hidden = true;
            }

            if (previewCanvas) {
                previewCanvas.hidden = false;
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


    reader.readAsDataURL(file);

}


/* =========================================================
   ENABLE TOOL
   ========================================================= */

function enableTool() {

    if (downloadPng) {
        downloadPng.disabled = false;
    }

    if (downloadIco) {
        downloadIco.disabled = false;
    }

    if (downloadZip) {
        downloadZip.disabled = false;
    }

    if (copyCode) {
        copyCode.disabled = false;
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

            const element = $(id);

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
        .querySelectorAll(".size-option")
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


    canvas.width = size;
    canvas.height = size;


    const ctx =
        canvas.getContext("2d");


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
                  Number(radiusInput.value) /
                  100
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
            ? Number(zoomElement.value) / 100
            : 1;


    let ratio;


    if (fit === "cover") {

        ratio =
            Math.max(
                size / sourceImage.width,
                size / sourceImage.height
            );

    } else {

        ratio =
            Math.min(
                size / sourceImage.width,
                size / sourceImage.height
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
            ? Number(positionXElement.value) / 100
            : 0.5;


    const positionY =
        positionYElement
            ? Number(positionYElement.value) / 100
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

    if (!sourceImage || !previewCanvas) {
        return;
    }


    const sizeElement =
        $("main-size");


    const size =
        sizeElement
            ? Number(sizeElement.value)
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


    anchor.href = url;
    anchor.download = filename;


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
     * V1:
     * Download a valid PNG instead of
     * pretending a PNG is an ICO.
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


    downloadZip.disabled = true;

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


            folder.file(
                `favicon-${size}x${size}.png`,
                blob
            );

        }


        folder.file(
            "favicon-code.html",
            htmlCode.value
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
            await zip.generateAsync(
                {
                    type: "blob"
                }
            );


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

        downloadZip.disabled = false;

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


            script.src = src;


            script.onload =
                resolve;


            script.onerror =
                () => {

                    reject(
                        new Error(
                            "Failed to load external library."
                        )
                    );

                };


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
   COPY
   ========================================================= */

function setupCopy() {

    if (!copyCode) {
        return;
    }


    copyCode.addEventListener(
        "click",
        async () => {

            try {

                await navigator.clipboard.writeText(
                    htmlCode.value
                );


                const original =
                    copyCode.textContent;


                copyCode.textContent =
                    "Copied ✓";


                setTimeout(
                    () => {

                        copyCode.textContent =
                            original;

                    },
                    1200
                );


            } catch (error) {

                htmlCode.select();

                document.execCommand(
                    "copy"
  
