document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const previewContainer = document.getElementById('previewContainer');
    const imagePreview = document.getElementById('imagePreview');
    const processBtn = document.getElementById('processBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    const pipelineSection = document.getElementById('pipelineSection');
    const resultsSection = document.getElementById('resultsSection');
    
    let selectedFile = null;

    // Upload logic
    uploadZone.addEventListener('click', () => fileInput.click());
    
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--primary)';
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.borderColor = 'var(--border-color)';
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.borderColor = 'var(--border-color)';
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            uploadZone.classList.add('hidden');
            previewContainer.classList.remove('hidden');
            pipelineSection.classList.add('hidden');
            resultsSection.classList.add('hidden');
            resetPipelineUI();
        };
        reader.readAsDataURL(file);
    }

    resetBtn.addEventListener('click', () => {
        selectedFile = null;
        fileInput.value = '';
        uploadZone.classList.remove('hidden');
        previewContainer.classList.add('hidden');
        pipelineSection.classList.add('hidden');
        resultsSection.classList.add('hidden');
    });

    // Processing Logic
    processBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        
        processBtn.disabled = true;
        processBtn.textContent = 'Processing...';
        pipelineSection.classList.remove('hidden');
        resultsSection.classList.add('hidden');
        resetPipelineUI();
        
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            startFakeProgress();
            
            const response = await fetch('/api/v1/demo/process-receipt', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('API request failed');
            
            const data = await response.json();
            
            displayResults(data);
            
        } catch (error) {
            alert('Error processing receipt: ' + error.message);
        } finally {
            processBtn.disabled = false;
            processBtn.textContent = 'Process Receipt';
        }
    });

    function resetPipelineUI() {
        document.querySelectorAll('.timeline-step').forEach(step => {
            step.classList.remove('active', 'completed');
            step.querySelector('.step-details').classList.add('hidden');
            step.querySelector('.step-time').textContent = '-- ms';
        });
        document.getElementById('totalTime').textContent = 'Total: -- ms';
    }

    function startFakeProgress() {
        const step1 = document.getElementById('step-classification');
        step1.classList.add('active');
    }

    function displayResults(data) {
        // Update total time
        document.getElementById('totalTime').textContent = `Total: ${data.timings.total} s`;

        // Step 1: Classification
        const step1 = document.getElementById('step-classification');
        step1.classList.remove('active');
        step1.classList.add('completed');
        step1.querySelector('.step-time').textContent = `${data.timings.classification} s`;
        step1.querySelector('.step-details').classList.remove('hidden');
        document.getElementById('val-source').textContent = data.classification.source;
        document.getElementById('val-source-conf').textContent = `${(data.classification.confidence * 100).toFixed(1)}%`;

        // Step 2: OCR
        const step2 = document.getElementById('step-ocr');
        step2.classList.add('completed');
        step2.querySelector('.step-time').textContent = `${data.timings.ocr} s`;
        step2.querySelector('.step-details').classList.remove('hidden');
        document.getElementById('val-ocr-count').textContent = data.ocr.words_count;
        document.getElementById('val-ocr-text').textContent = data.ocr.text || (data.ocr.words_sample ? data.ocr.words_sample.join(' ') : '');

        // Step 3: LayoutLM
        const step3 = document.getElementById('step-layoutlm');
        step3.classList.add('completed');
        step3.querySelector('.step-time').textContent = `${data.timings.layoutlm} s`;
        step3.querySelector('.step-details').classList.remove('hidden');
        
        const entitiesContainer = document.getElementById('val-layoutlm-entities');
        entitiesContainer.innerHTML = '';
        if (data.entities && data.entities.length > 0) {
            data.entities.forEach(ent => {
                const type = (ent.entity_type || ent.entity || 'O').replace('B-', '').replace('I-', '');
                const span = document.createElement('span');
                span.className = `entity-tag tag-${type}`;
                span.textContent = `${ent.text} [${type}]`;
                entitiesContainer.appendChild(span);
            });
        } else {
            entitiesContainer.textContent = 'No entities extracted.';
        }

        // Show Final Results & Summary Cards
        resultsSection.classList.remove('hidden');
        const vendorName = (data.summary.vendor !== "Unknown" && data.summary.vendor !== "") ? data.summary.vendor : "RECEIPT VENDOR";
        document.getElementById('res-vendor').textContent = vendorName;
        document.getElementById('res-total').textContent = data.summary.total;
        document.getElementById('res-date').textContent = data.summary.date;

        // Render Digital Receipt Reconstruction Table
        document.getElementById('rec-vendor').textContent = vendorName;
        document.getElementById('rec-date').textContent = data.summary.date;
        document.getElementById('rec-total').textContent = data.summary.total;
        
        const tbody = document.getElementById('rec-items-body');
        tbody.innerHTML = '';
        if (data.summary.items && data.summary.items.length > 0) {
            data.summary.items.forEach(item => {
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

        // Render Discounts if any
        const discArea = document.getElementById('rec-discounts-area');
        if (data.summary.discounts && data.summary.discounts.length > 0) {
            discArea.classList.remove('hidden');
            discArea.innerHTML = '';
            data.summary.discounts.forEach(d => {
                discArea.innerHTML += `<span>🎁 ${d.name || 'Loyalty / Discount'}</span> <span>-$${Math.abs(d.amount).toFixed(2)}</span>`;
            });
        } else {
            discArea.classList.add('hidden');
        }

        document.getElementById('rawJsonOutput').textContent = JSON.stringify(data, null, 2);
    }
});
