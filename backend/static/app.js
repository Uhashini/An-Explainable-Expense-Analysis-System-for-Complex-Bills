document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const resultsArea = document.getElementById('results-area');
    const imagePreview = document.getElementById('image-preview');
    const jsonOutput = document.getElementById('json-output');
    const loader = document.getElementById('loader');
    const copyBtn = document.getElementById('copy-json');

    // Click to upload
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag and Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('active'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('active'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                uploadFile(file);
                displayPreview(file);
            } else {
                alert('Please upload an image file (JPG or PNG).');
            }
        }
    }

    function displayPreview(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            imagePreview.src = e.target.result;
            resultsArea.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        loader.classList.remove('hidden');
        jsonOutput.textContent = 'Processing...';

        try {
            const response = await fetch('/api/v1/receipts/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Upload failed');
            }

            const result = await response.json();

            // Format JSON with syntax highlighting logic (simple version)
            jsonOutput.innerHTML = syntaxHighlight(result.data);

            // Scroll to results
            resultsArea.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            console.error('Error:', error);
            jsonOutput.textContent = 'Error: ' + error.message;
        } finally {
            loader.classList.add('hidden');
        }
    }

    function syntaxHighlight(json) {
        if (typeof json != 'string') {
            json = JSON.stringify(json, null, 2);
        }

        // Use standard JSON stringify if not string
        const jsonStr = json;

        return jsonStr.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    copyBtn.addEventListener('click', () => {
        const text = jsonOutput.innerText;
        navigator.clipboard.writeText(text).then(() => {
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
            }, 2000);
        });
    });
});
