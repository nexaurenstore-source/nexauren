import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const $ = (s) => document.querySelector(s);
const screens = [...document.querySelectorAll('.tool-screen')];
const input = $('#pdf-input');
const uploadArea = $('.upload-area');
const uploadError = $('#upload-error');
const settingsError = $('#settings-error');
const resultError = $('#result-error');
const format = $('#format-select');
const quality = $('#quality-input');
const qualityValue = $('#quality-value');
const scale = $('#scale-select');
const pages = $('#pages-select');
const rangeWrap = $('#range-wrap');
const pageRange = $('#page-range');
const fileName = $('#file-name');
const fileInfo = $('#file-info');
const results = $('#results');
const progress = $('#progress');
const progressBar = $('#progress-bar');
const progressText = $('#progress-text');
const modal = $('#download-modal');

let pdfFile = null;
let pdfDoc = null;
let outputFiles = [];
let pendingDownload = null;

function showScreen(name) {
  screens.forEach((screen) => {
    const active = screen.dataset.screen === name;
    screen.hidden = !active;
    screen.classList.toggle('is-active', active);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setError(el, message) {
  el.textContent = message || '';
  el.hidden = !message;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function parsePages(value, total) {
  const selected = new Set();
  for (const part of value.split(',')) {
    const token = part.trim();
    if (!token) continue;
    if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (n < 1 || n > total) throw new Error(`Page ${n} is outside this PDF.`);
      selected.add(n);
      continue;
    }
    const match = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) throw new Error(`Invalid page range: ${token}`);
    let start = Number(match[1]);
    let end = Number(match[2]);
    if (start > end) [start, end] = [end, start];
    if (start < 1 || end > total) throw new Error(`Page range ${token} is outside this PDF.`);
    for (let n = start; n <= end; n++) selected.add(n);
  }
  return [...selected].sort((a, b) => a - b);
}

function filenameBase() {
  return (pdfFile?.name || 'document').replace(/\.pdf$/i, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'document';
}

async function loadPdf(file) {
  setError(uploadError, '');
  setError(settingsError, '');
  setError(resultError, '');
  if (!file || file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    setError(uploadError, 'Please choose a valid PDF file.');
    return;
  }
  if (file.size === 0) {
    setError(uploadError, 'This PDF is empty.');
    return;
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    pdfDoc = await loadingTask.promise;
    pdfFile = file;
    fileName.textContent = file.name;
    fileInfo.textContent = `${pdfDoc.numPages} page${pdfDoc.numPages === 1 ? '' : 's'} · ${formatBytes(file.size)}`;
    pageRange.value = `1-${pdfDoc.numPages}`;
    showScreen('settings');
  } catch (error) {
    console.error(error);
    setError(uploadError, 'The PDF could not be opened. It may be damaged, encrypted or unsupported.');
  }
}

async function convert() {
  setError(settingsError, '');
  setError(resultError, '');
  if (!pdfDoc) return;
  let selectedPages;
  try {
    selectedPages = pages.value === 'all' ? Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1) : parsePages(pageRange.value, pdfDoc.numPages);
    if (!selectedPages.length) throw new Error('Choose at least one page.');
  } catch (error) {
    setError(settingsError, error.message);
    return;
  }

  outputFiles = [];
  results.innerHTML = '';
  progress.hidden = false;
  $('#download-all').disabled = true;
  showScreen('result');

  try {
    for (let index = 0; index < selectedPages.length; index++) {
      const pageNumber = selectedPages[index];
      progressText.textContent = `Converting page ${pageNumber} of ${selectedPages.length}…`;
      progressBar.style.width = `${Math.round((index / selectedPages.length) * 100)}%`;
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const page = await pdfDoc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: Number(scale.value) });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: format.value === 'png' });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;

      const mime = format.value === 'png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, Number(quality.value) / 100));
      if (!blob) throw new Error(`Could not create the image for page ${pageNumber}.`);

      const extension = format.value === 'png' ? 'png' : 'jpg';
      const name = `${filenameBase()}-page-${pageNumber}.${extension}`;
      const url = URL.createObjectURL(blob);
      outputFiles.push({ name, blob, url, pageNumber, width: canvas.width, height: canvas.height });
      addResultCard(outputFiles[outputFiles.length - 1]);
    }
    progressBar.style.width = '100%';
    progressText.textContent = `${outputFiles.length} image${outputFiles.length === 1 ? '' : 's'} ready.`;
    $('#download-all').disabled = false;
  } catch (error) {
    console.error(error);
    setError(resultError, error.message || 'Conversion failed.');
  } finally {
    progress.hidden = true;
  }
}

function addResultCard(file) {
  const card = document.createElement('article');
  card.className = 'result-card';
  const img = document.createElement('img');
  img.src = file.url;
  img.alt = `Converted page ${file.pageNumber}`;
  const meta = document.createElement('div');
  meta.className = 'result-meta';
  meta.innerHTML = `<span>Page ${file.pageNumber}</span><span>${file.width}×${file.height}</span>`;
  const button = document.createElement('button');
  button.className = 'button button-secondary';
  button.type = 'button';
  button.textContent = 'Download';
  button.addEventListener('click', () => openDownloadModal(file));
  card.append(img, meta, button);
  results.appendChild(card);
}

function openDownloadModal(download) {
  pendingDownload = download;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
}

function saveFile(file) {
  if (!file) return;
  const link = document.createElement('a');
  link.href = file.url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function downloadAll() {
  if (!outputFiles.length) return;
  if (outputFiles.length === 1) {
    openDownloadModal(outputFiles[0]);
    return;
  }
  const zip = new JSZip();
  for (const file of outputFiles) zip.file(file.name, file.blob);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  openDownloadModal({ name: `${filenameBase()}-images.zip`, blob, url: URL.createObjectURL(blob) });
}

uploadArea.addEventListener('dragover', (event) => { event.preventDefault(); uploadArea.classList.add('is-dragging'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('is-dragging'));
uploadArea.addEventListener('drop', (event) => { event.preventDefault(); uploadArea.classList.remove('is-dragging'); loadPdf(event.dataTransfer.files[0]); });
input.addEventListener('change', () => loadPdf(input.files[0]));
quality.addEventListener('input', () => { qualityValue.textContent = `${quality.value}%`; });
pages.addEventListener('change', () => { rangeWrap.hidden = pages.value !== 'range'; });

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'back-upload') showScreen('upload');
  if (action === 'back-settings') showScreen('settings');
  if (action === 'convert') convert();
  if (action === 'download-all') downloadAll();
  if (action === 'close-modal') closeModal();
  if (action === 'confirm-download') { saveFile(pendingDownload); closeModal(); }
});

window.addEventListener('beforeunload', () => outputFiles.forEach((file) => URL.revokeObjectURL(file.url)));
