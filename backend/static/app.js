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
            const info = result.data.receipt_info || {};

            // Populate Digital Receipt Table
            const vendorName = (info.merchant_name && info.merchant_name !== "Unknown") ? info.merchant_name : "RECEIPT VENDOR";
            document.getElementById('rec-vendor').textContent = vendorName;
            document.getElementById('rec-date').textContent = info.date || '--';
            document.getElementById('rec-total').textContent = Number(info.total_amount || 0).toFixed(2);
            
            const tbody = document.getElementById('rec-items-body');
            tbody.innerHTML = '';
            if (info.items && info.items.length > 0) {
                info.items.forEach(item => {
                    const tr = document.createElement('tr');
                    const rateText = item.unit_price > 0 ? `$${Number(item.unit_price).toFixed(2)}` : '--';
                    tr.innerHTML = `
                        <td>${item.quantity || 1}</td>
                        <td class="item-name-col">${item.name || 'Item'} <span class="item-badge">menu.nm</span></td>
                        <td>${rateText}</td>
                        <td class="text-right font-bold">$${Number(item.total_price || 0).toFixed(2)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 1.5rem; color: #6b7280;">No line items detected on this receipt</td></tr>';
            }

            const discArea = document.getElementById('rec-discounts-area');
            if (info.discounts && info.discounts.length > 0) {
                discArea.classList.remove('hidden');
                discArea.innerHTML = '';
                info.discounts.forEach(d => {
                    discArea.innerHTML += `<span>🎁 ${d.name || 'Loyalty / Discount'}</span> <span>-$${Math.abs(d.amount).toFixed(2)}</span>`;
                });
            } else {
                discArea.classList.add('hidden');
            }

            // Format JSON with syntax highlighting logic
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
