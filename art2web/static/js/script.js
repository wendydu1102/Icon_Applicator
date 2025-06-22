document.addEventListener('DOMContentLoaded', () => {
    const fileElem = document.getElementById('fileElem');
    const dropArea = document.getElementById('drop-area');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const convertBtn = document.getElementById('convert-btn');

    const resultSection = document.getElementById('result-section');
    const loadingSpinner = document.getElementById('loading-spinner');
    const errorMessage = document.getElementById('error-message');
    const svgOutput = document.getElementById('svg-output');
    const svgPreviewContainer = document.getElementById('svg-preview-container');
    const svgPreview = document.getElementById('svg-preview');
    const svgCode = document.getElementById('svg-code');
    const copySvgBtn = document.getElementById('copy-svg-btn');
    const downloadSvgBtn = document.getElementById('download-svg-btn');

    let currentFile = null;

    // --- Drag and Drop ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false); // Prevent browser from opening file
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('highlight'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('highlight'), false);
    });

    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }

    // --- File Input Change ---
    fileElem.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        // Validate file type (client-side)
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            displayError('Invalid file type. Please upload JPG, PNG, or GIF.');
            resetUploadState();
            return;
        }

        // Validate file size (client-side) - e.g. 16MB
        const maxSize = 16 * 1024 * 1024;
        if (file.size > maxSize) {
            displayError(`File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum size is 16 MB.`);
            resetUploadState();
            return;
        }

        currentFile = file;
        previewImage(file);
        convertBtn.disabled = false;
        resultSection.style.display = 'none'; // Hide previous results
        errorMessage.style.display = 'none';
    }

    function previewImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreviewContainer.style.display = 'block';
        }
        reader.readAsDataURL(file);
    }

    function resetUploadState() {
        currentFile = null;
        fileElem.value = ''; // Reset file input
        imagePreview.src = '#';
        imagePreviewContainer.style.display = 'none';
        convertBtn.disabled = true;
    }

    // --- Conversion Logic ---
    convertBtn.addEventListener('click', () => {
        if (!currentFile) {
            displayError('Please select a file first.');
            return;
        }

        resultSection.style.display = 'block';
        svgOutput.style.display = 'none';
        errorMessage.style.display = 'none';
        loadingSpinner.style.display = 'block';
        convertBtn.disabled = true; // Disable while processing

        const formData = new FormData();
        formData.append('file', currentFile);

        fetch('/convert', {
            method: 'POST',
            body: formData
        })
            .then(response => {
                if (!response.ok) {
                    // Try to parse error from JSON, otherwise use status text
                    return response.json().then(errData => {
                        throw new Error(errData.error || `Server error: ${response.statusText}`);
                    }).catch(() => { // If parsing JSON fails or no JSON body
                        throw new Error(`Server error: ${response.statusText} (Status: ${response.status})`);
                    });
                }
                return response.json();
            })
            .then(data => {
                loadingSpinner.style.display = 'none';
                if (data.success) {
                    displaySvgResult(data.svg_data, data.svg_filename);
                } else {
                    displayError(data.error || 'Conversion failed.');
                }
            })
            .catch(error => {
                loadingSpinner.style.display = 'none';
                console.error('Error:', error);
                displayError(`An error occurred: ${error.message}`);
            })
            .finally(() => {
                if (currentFile) { // Re-enable convert button only if a file is still selected
                    convertBtn.disabled = false;
                }
            });
    });

    function displaySvgResult(svgData, svgFilename) {
        svgOutput.style.display = 'block';
        svgCode.value = svgData;

        // Preview SVG using a data URI in an <img> tag for safety
        const svgDataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
        svgPreview.src = svgDataUri;
        svgPreviewContainer.style.display = 'block';

        // Set up download button
        // Option 1: Create a Blob and object URL for client-side download
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        downloadSvgBtn.href = url;
        downloadSvgBtn.download = svgFilename || 'artwork.svg';

        // Option 2: Link to server endpoint if you prefer server-side download
        // downloadSvgBtn.href = `/download_svg/${svgFilename}`;
        // downloadSvgBtn.download = svgFilename; // The 'download' attribute suggests filename
    }

    function displayError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        svgOutput.style.display = 'none'; // Hide results if error
    }

    // --- Copy SVG Code ---
    copySvgBtn.addEventListener('click', () => {
        svgCode.select();
        svgCode.setSelectionRange(0, 99999); // For mobile devices

        try {
            const successful = document.execCommand('copy');
            const msg = successful ? 'SVG code copied to clipboard!' : 'Failed to copy SVG code.';
            // Simple feedback, could be a small temporary popup/toast
            alert(msg);
        } catch (err) {
            alert('Oops, unable to copy. Please copy manually.');
            console.error('Fallback: Oops, unable to copy', err);
        }
    });

});