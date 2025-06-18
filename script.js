// Set current year in footer
try {
    const currentYearElement = document.getElementById('current-year');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
} catch (error) {
    console.warn('Error setting current year:', error);
}

// Function to format number to Indonesian currency format
function formatIndonesianCurrency(amount) {
    try {
        if (typeof amount !== 'number') {
            amount = parseFloat(amount) || 0;
        }
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    } catch (error) {
        // Fallback formatting
        return `Rp ${amount.toLocaleString('id-ID')}`;
    }
}

// Load Santri data from Sheet
function loadSantriData() {
    const santriUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTEAPZssfdgaP5kOimNNhe_TDNkSDVOI9iW6-tUhct37I22OOCQhJH2JQ_EpVbwRousAaznBZk-AXVK/pub?gid=0&single=true&output=tsv';
    const pembayaranUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTEAPZssfdgaP5kOimNNhe_TDNkSDVOI9iW6-tUhct37I22OOCQhJH2JQ_EpVbwRousAaznBZk-AXVK/pub?gid=583952215&single=true&output=tsv';
    
    // Load both sheets simultaneously
    Promise.all([
        fetch(santriUrl).then(response => response.text()),
        fetch(pembayaranUrl).then(response => response.text()).catch(() => '') // Return empty string if pembayaran sheet doesn't exist
    ])
    .then(([santriTsv, pembayaranTsv]) => {
        // Parse Santri data
        const santriLines = santriTsv.split('\n');
        const santriHeaders = santriLines[0].split('\t').map(header => header.trim());
        const santriData = [santriHeaders];
        
        for (let i = 1; i < santriLines.length; i++) {
            if (santriLines[i].trim()) {
                try {
                    const values = santriLines[i].split('\t').map(value => value.trim());
                    santriData.push(values);
                } catch (error) {
                    console.warn('Error parsing santri line:', i, error);
                }
            }
        }
        
        // Parse Pembayaran data (if available)
        let pembayaranData = [['ID', 'Wajib', 'Nominal']]; // Default headers
        if (pembayaranTsv && pembayaranTsv.trim()) {
            try {
                const pembayaranLines = pembayaranTsv.split('\n');
                const pembayaranHeaders = pembayaranLines[0].split('\t').map(header => header.trim());
                pembayaranData = [pembayaranHeaders];
                
                for (let i = 1; i < pembayaranLines.length; i++) {
                    if (pembayaranLines[i].trim()) {
                        try {
                            const values = pembayaranLines[i].split('\t').map(value => value.trim());
                            pembayaranData.push(values);
                        } catch (error) {
                            console.warn('Error parsing pembayaran line:', i, error);
                        }
                    }
                }
            } catch (error) {
                console.warn('Error parsing pembayaran data:', error);
            }
        }
        
        if (santriData.length > 1) {
            try {
                processCombinedData(santriData, pembayaranData);
            } catch (error) {
                console.error('Error processing data:', error);
                const loadingElement = document.getElementById('loading');
                if (loadingElement) {
                    loadingElement.innerHTML = 
                        '<p style="color: red;">Gagal memproses data. Silakan coba lagi nanti.</p>';
                }
            }
        } else {
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.innerHTML = 
                    '<p>Tidak ada data santri yang ditemukan.</p>';
            }
        }
    })
    .catch(error => {
        console.error('Error loading data:', error);
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.innerHTML = 
                '<p style="color: red;">Gagal memuat data. Silakan coba lagi nanti.</p>';
        }
    });
}

// Process combined data from both sheets
function processCombinedData(santriData, pembayaranData) {
    // Process Santri data
    const santriHeaders = santriData[0];
    const santriRows = santriData.slice(1);
    
    const santriProcessed = {
        headers: santriHeaders,
        data: santriRows.map(row => {
            const obj = {};
            santriHeaders.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            return obj;
        })
    };
    
    // Process Pembayaran data
    const pembayaranHeaders = pembayaranData[0];
    const pembayaranRows = pembayaranData.slice(1);
    
    const pembayaranProcessed = {
        headers: pembayaranHeaders,
        data: pembayaranRows.map(row => {
            const obj = {};
            pembayaranHeaders.forEach((header, index) => {
                obj[header] = row[index] || '';
            });
            return obj;
        })
    };
    
    // Combine data by matching IDs
    try {
        const combinedData = combineSantriAndPembayaran(santriProcessed, pembayaranProcessed);
        
        // Update stats
        try {
            updateCombinedStats(combinedData);
        } catch (error) {
            console.error('Error updating stats:', error);
        }
        
        // Update filter options
        try {
            updateStatusFilter(combinedData);
            updateFormalFilter(combinedData);
            updatePaymentFilter(combinedData);
        } catch (error) {
            console.error('Error updating filters:', error);
        }
        
        // Display table
        try {
            displayCombinedTable(combinedData);
        } catch (error) {
            console.error('Error displaying table:', error);
            const loadingElement = document.getElementById('loading');
            if (loadingElement) {
                loadingElement.innerHTML = 
                    '<p style="color: red;">Gagal menampilkan data. Silakan coba lagi nanti.</p>';
            }
            return;
        }
        
        // Hide loading spinner
        try {
            const loadingElement = document.getElementById('loading');
            const dataTableElement = document.getElementById('data-table');
            if (loadingElement) loadingElement.style.display = 'none';
            if (dataTableElement) dataTableElement.style.display = 'block';
        } catch (error) {
            console.warn('Error hiding loading spinner:', error);
        }
        
        // Store data for filtering
        window.combinedData = combinedData;
    } catch (error) {
        console.error('Error combining data:', error);
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.innerHTML = 
                '<p style="color: red;">Gagal menggabungkan data. Silakan coba lagi nanti.</p>';
        }
    }
}

// Combine Santri and Pembayaran data based on ID
function combineSantriAndPembayaran(santriData, pembayaranData) {
    const combined = santriData.data.map(santri => {
        const santriId = santri.ID || santri.id || '';
        const pembayaranForSantri = pembayaranData.data.filter(pembayaran => {
            // Check if pembayaran ID starts with santri ID (e.g., 00087263-01, 00087263-02)
            const pembayaranId = pembayaran.ID || pembayaran.id || '';
            try {
                return pembayaranId && pembayaranId.startsWith(santriId + '-');
            } catch (error) {
                console.warn('Error checking pembayaran ID:', error);
                return false;
            }
        });
        
        // Calculate payment statistics
        const totalWajib = pembayaranForSantri.reduce((sum, p) => {
            // Handle format like "Rp961.000,00" - remove "Rp" and replace comma with dot
            let wajibStr = (p.Wajib || p.wajib || '0').toString();
            if (wajibStr.includes('Rp')) {
                wajibStr = wajibStr.replace('Rp', '').replace(/\./g, '').replace(',', '.');
            }
            const wajib = parseFloat(wajibStr) || 0;
            return sum + wajib;
        }, 0);
        
        const totalBayar = pembayaranForSantri.reduce((sum, p) => {
            // Handle format like "Rp200.000,00" - remove "Rp" and replace comma with dot
            let nominalStr = (p.Nominal || p.nominal || '0').toString();
            if (nominalStr.includes('Rp')) {
                nominalStr = nominalStr.replace('Rp', '').replace(/\./g, '').replace(',', '.');
            }
            const nominal = parseFloat(nominalStr) || 0;
            return sum + nominal;
        }, 0);
        
        const sisaBayar = totalWajib - totalBayar;
        const statusBayar = sisaBayar <= 0 && totalWajib > 0 ? 'Lunas' : 'Belum Lunas';
        
        return {
            ...santri,
            pembayaran: pembayaranForSantri,
            totalWajib: totalWajib,
            totalBayar: totalBayar,
            sisaBayar: sisaBayar,
            statusBayar: statusBayar,
            jumlahPembayaran: pembayaranForSantri.length
        };
    });
    
    return {
        headers: santriData.headers,
        data: combined
    };
}

function updateCombinedStats(combinedData) {
    try {
        const totalSantri = combinedData.data.length;
        const totalSantriElement = document.getElementById('total-santri');
        if (totalSantriElement) totalSantriElement.textContent = totalSantri;
        
        // Count mukim santri
        const mukimSantri = combinedData.data.filter(santri => {
            return santri.Status && santri.Status.toLowerCase() === 'mukim';
        }).length;
        const mukimSantriElement = document.getElementById('mukim-santri');
        if (mukimSantriElement) mukimSantriElement.textContent = mukimSantri;
        
        // Count boyong santri
        const boyongSantri = combinedData.data.filter(santri => {
            return santri.Status && santri.Status.toLowerCase() === 'boyong';
        }).length;
        const boyongSantriElement = document.getElementById('boyong-santri');
        if (boyongSantriElement) boyongSantriElement.textContent = boyongSantri;

        // Payment statistics
        const totalWajib = combinedData.data.reduce((sum, santri) => sum + santri.totalWajib, 0);
        const totalBayar = combinedData.data.reduce((sum, santri) => sum + santri.totalBayar, 0);
        const totalSisa = combinedData.data.reduce((sum, santri) => sum + santri.sisaBayar, 0);
        const lunasCount = combinedData.data.filter(santri => santri.statusBayar === 'Lunas').length;
        const belumLunasCount = combinedData.data.filter(santri => santri.statusBayar === 'Belum Lunas').length;
        const noPaymentCount = combinedData.data.filter(santri => santri.totalWajib === 0).length;

        // Update payment stats in HTML (you'll need to add these elements to your HTML)
        const paymentStatsContainer = document.getElementById('payment-stats');
        if (paymentStatsContainer) {
            try {
                paymentStatsContainer.innerHTML = `
                    <div class="stat-item">
                        <div class="stat-number">${lunasCount}</div>
                        <div class="stat-label">Lunas</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${belumLunasCount}</div>
                        <div class="stat-label">Belum Lunas</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${noPaymentCount}</div>
                        <div class="stat-label">Belum Ada Data</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${formatIndonesianCurrency(totalWajib)}</div>
                        <div class="stat-label">Total Wajib</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${formatIndonesianCurrency(totalBayar)}</div>
                        <div class="stat-label">Total Bayar</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${formatIndonesianCurrency(totalSisa)}</div>
                        <div class="stat-label">Total Sisa</div>
                    </div>
                `;
            } catch (error) {
                paymentStatsContainer.innerHTML = `
                    <div class="stat-item">
                        <div class="stat-number">${lunasCount}</div>
                        <div class="stat-label">Lunas</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${belumLunasCount}</div>
                        <div class="stat-label">Belum Lunas</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${noPaymentCount}</div>
                        <div class="stat-label">Belum Ada Data</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">Rp ${totalWajib}</div>
                        <div class="stat-label">Total Wajib</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">Rp ${totalBayar}</div>
                        <div class="stat-label">Total Bayar</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">Rp ${totalSisa}</div>
                        <div class="stat-label">Total Sisa</div>
                    </div>
                `;
            }
        }

        // Update formal chart
        updateFormalChart(combinedData);
    } catch (error) {
        console.error('Error updating combined stats:', error);
    }
}

function updateStatusFilter(combinedData) {
    try {
        // Get unique status values
        const statusValues = [...new Set(combinedData.data.map(santri => santri.Status).filter(status => status))];
        
        // Get status filter select element
        const statusFilter = document.getElementById('status-filter');
        if (!statusFilter) return;
        
        // Clear existing options except the first one
        while (statusFilter.options.length > 1) {
            statusFilter.remove(1);
        }
        
        // Add new options
        statusValues.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            statusFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error updating status filter:', error);
    }
}

function updateFormalFilter(combinedData) {
    try {
        // Get unique formal values
        const formalValues = [...new Set(combinedData.data.map(santri => santri.Formal).filter(formal => formal))];
        
        // Get formal filter select element
        const formalFilter = document.getElementById('formal-filter');
        if (!formalFilter) return;
        
        // Clear existing options except the first one
        while (formalFilter.options.length > 1) {
            formalFilter.remove(1);
        }
        
        // Add new options
        formalValues.forEach(formal => {
            const option = document.createElement('option');
            option.value = formal;
            option.textContent = formal;
            formalFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error updating formal filter:', error);
    }
}

function updatePaymentFilter(combinedData) {
    try {
        // Get unique payment status values
        const paymentValues = [];
        
        // Add "Belum Ada Data" if there are santri without payment data
        const hasNoPaymentData = combinedData.data.some(santri => santri.totalWajib === 0);
        if (hasNoPaymentData) {
            paymentValues.push('Belum Ada Data');
        }
        
        // Add actual payment statuses
        const actualStatuses = [...new Set(combinedData.data
            .filter(santri => santri.totalWajib > 0)
            .map(santri => santri.statusBayar)
            .filter(status => status))];
        
        paymentValues.push(...actualStatuses);
        
        // Get payment filter select element
        const paymentFilter = document.getElementById('payment-filter');
        if (!paymentFilter) return; // Skip if element doesn't exist
        
        // Clear existing options except the first one
        while (paymentFilter.options.length > 1) {
            paymentFilter.remove(1);
        }
        
        // Add new options
        paymentValues.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            paymentFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Error updating payment filter:', error);
    }
}

function updateFormalChart(combinedData) {
    try {
        const formalData = {
            'MTs': 0,
            'MA': 0
        };

        // Count formal types
        combinedData.data.forEach(santri => {
            if (santri.Formal) {
                try {
                    // Cek jika Formal mengandung 'MTs' atau 'MA'
                    if (santri.Formal.includes('MTs')) {
                        formalData['MTs']++;
                    } else if (santri.Formal.includes('MA')) {
                        formalData['MA']++;
                    }
                } catch (error) {
                    console.warn('Error checking formal type:', error);
                }
            }
        });

        // Create chart
        const chartContainer = document.getElementById('formal-chart');
        if (!chartContainer) return;
        
        chartContainer.innerHTML = '';

        // Find max value for percentage calculation
        const maxValue = Math.max(...Object.values(formalData));

        // Create bars
        Object.entries(formalData).forEach(([type, count]) => {
            const percentage = (count / maxValue) * 100;
            
            const barContainer = document.createElement('div');
            barContainer.style.marginBottom = '20px';
            
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.width = `${percentage}%`;
            
            const label = document.createElement('div');
            label.className = 'chart-label';
            label.textContent = type;
            
            const value = document.createElement('div');
            value.className = 'chart-value';
            value.textContent = count;
            
            bar.appendChild(label);
            bar.appendChild(value);
            barContainer.appendChild(bar);
            chartContainer.appendChild(barContainer);
        });
    } catch (error) {
        console.error('Error updating formal chart:', error);
    }
}

function displayCombinedTable(combinedData) {
    try {
        const dataContainer = document.getElementById('data-table');
        if (!dataContainer) return;
        
        dataContainer.innerHTML = '';
        
        // Create santri list container
        const santriList = document.createElement('div');
        santriList.className = 'santri-list';
        
        // Process each santri
        combinedData.data.forEach((santri, index) => {
            try {
                const santriItem = document.createElement('div');
                santriItem.className = 'santri-item';
                santriItem.dataset.index = index;
                
                // Create avatar with initials
                const avatar = document.createElement('div');
                avatar.className = 'santri-avatar';
                const nameInitials = (santri.Nama || '')
                    .split(' ')
                    .map(word => word[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 2);
                avatar.textContent = nameInitials || '?';
                
                // Create info container
                const info = document.createElement('div');
                info.className = 'santri-info';
                
                // Name
                const name = document.createElement('div');
                name.className = 'santri-name';
                name.textContent = santri.Nama || '-';
                
                // Details
                const details = document.createElement('div');
                details.className = 'santri-details';
                
                // ID
                const id = document.createElement('span');
                id.textContent = `ID: ${santri.ID || '-'}`;
                
                // Status
                const status = document.createElement('span');
                status.className = `santri-status ${santri.Status?.toLowerCase() === 'aktif' ? 'status-active' : 'status-inactive'}`;
                status.textContent = santri.Status || '-';
                
                // Payment status
                const paymentStatus = document.createElement('span');
                paymentStatus.className = `payment-status ${santri.totalWajib > 0 ? (santri.statusBayar === 'Lunas' ? 'status-lunas' : 'status-belum-lunas') : 'status-no-data'}`;
                paymentStatus.textContent = santri.totalWajib > 0 ? santri.statusBayar : 'Belum Ada Data';
                
                // Payment details
                const paymentDetails = document.createElement('div');
                paymentDetails.className = 'payment-details';
                
                if (santri.totalWajib > 0) {
                    try {
                        paymentDetails.innerHTML = `
                            <small>Wajib: ${formatIndonesianCurrency(santri.totalWajib)} | Bayar: ${formatIndonesianCurrency(santri.totalBayar)} | Sisa: ${formatIndonesianCurrency(santri.sisaBayar)}</small>
                        `;
                    } catch (error) {
                        paymentDetails.innerHTML = `
                            <small>Wajib: Rp ${santri.totalWajib} | Bayar: Rp ${santri.totalBayar} | Sisa: Rp ${santri.sisaBayar}</small>
                        `;
                    }
                } else {
                    paymentDetails.innerHTML = `
                        <small>Belum ada data pembayaran</small>
                    `;
                }
                
                // Append all elements
                details.appendChild(id);
                details.appendChild(status);
                details.appendChild(paymentStatus);
                
                info.appendChild(name);
                info.appendChild(details);
                info.appendChild(paymentDetails);
                
                santriItem.appendChild(avatar);
                santriItem.appendChild(info);
                
                santriList.appendChild(santriItem);
            } catch (error) {
                console.warn('Error creating santri item:', error);
            }
        });
        
        dataContainer.appendChild(santriList);
    } catch (error) {
        console.error('Error displaying combined table:', error);
    }
}

// Update filter function for new layout
function filterTable() {
    try {
        if (!window.combinedData || !window.combinedData.data) {
            console.warn('No combined data available for filtering');
            return;
        }
        
        const searchText = document.getElementById('search-input')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('status-filter')?.value || '';
        const formalFilter = document.getElementById('formal-filter')?.value || '';
        const paymentFilter = document.getElementById('payment-filter')?.value || '';
        
        const items = document.querySelectorAll('.santri-item');
        if (!items || items.length === 0) {
            console.warn('No santri items found for filtering');
            return;
        }
        
        items.forEach(item => {
            try {
                const santri = window.combinedData.data[item.dataset.index];
                if (!santri) {
                    item.style.display = 'none';
                    return;
                }
                
                let shouldShow = true;
                
                // Search filter
                if (searchText) {
                    try {
                        const matches = Object.values(santri).some(value => 
                            value.toString().toLowerCase().includes(searchText)
                        );
                        if (!matches) shouldShow = false;
                    } catch (error) {
                        console.warn('Error in search filter:', error);
                        shouldShow = false;
                    }
                }
                
                // Status filter
                if (statusFilter && santri.Status !== statusFilter) {
                    shouldShow = false;
                }
                
                // Formal filter
                if (formalFilter && santri.Formal !== formalFilter) {
                    shouldShow = false;
                }
                
                // Payment status filter
                if (paymentFilter && paymentFilter !== 'Belum Ada Data') {
                    if (santri.statusBayar !== paymentFilter) {
                        shouldShow = false;
                    }
                } else if (paymentFilter === 'Belum Ada Data') {
                    if (santri.totalWajib > 0) {
                        shouldShow = false;
                    }
                }
                
                item.style.display = shouldShow ? 'flex' : 'none';
            } catch (error) {
                console.warn('Error filtering item:', error);
                item.style.display = 'none';
            }
        });
    } catch (error) {
        console.error('Error in filterTable:', error);
    }
}

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
    try {
        loadSantriData();
        
        // Navigation click handler
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', function(e) {
                try {
                    e.preventDefault();
                    const tabId = this.getAttribute('data-tab');
                    if (tabId) {
                        // Update active nav item
                        navItems.forEach(nav => nav.classList.remove('active'));
                        this.classList.add('active');
                        
                        // Show selected tab content
                        document.querySelectorAll('.tab-content').forEach(tab => {
                            tab.classList.remove('active');
                        });
                        try {
                            const targetTab = document.getElementById(tabId);
                            if (targetTab) {
                                targetTab.classList.add('active');
                            }
                        } catch (error) {
                            console.warn('Error showing tab:', error);
                        }
                    }
                } catch (error) {
                    console.error('Error in navigation click:', error);
                }
            });
        });

        // Theme switching functionality
        let savedTheme = 'default';
        try {
            savedTheme = localStorage.getItem('theme') || 'default';
        } catch (error) {
            console.warn('Error accessing localStorage:', error);
        }
        document.documentElement.setAttribute('data-theme', savedTheme);
        try {
            const activeThemeElement = document.querySelector(`[data-theme="${savedTheme}"]`);
            if (activeThemeElement) {
                activeThemeElement.classList.add('active');
            }
        } catch (error) {
            console.warn('Error setting active theme:', error);
        }

        // Theme click handler
        const themeOptions = document.querySelectorAll('.theme-option');
        themeOptions.forEach(option => {
            option.addEventListener('click', function() {
                try {
                    const theme = this.getAttribute('data-theme');
                    document.documentElement.setAttribute('data-theme', theme);
                    try {
                        localStorage.setItem('theme', theme);
                    } catch (error) {
                        console.warn('Error saving theme to localStorage:', error);
                    }
                    
                    // Update active state
                    themeOptions.forEach(opt => opt.classList.remove('active'));
                    this.classList.add('active');
                } catch (error) {
                    console.error('Error in theme click:', error);
                }
            });
        });
    } catch (error) {
        console.error('Error in DOMContentLoaded:', error);
    }
});
