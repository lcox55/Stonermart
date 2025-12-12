// Global variables
let currentWebsiteId = null;
let performanceChart = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadWebsites();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Add website form submission
    document.getElementById('add-website-form').addEventListener('submit', handleAddWebsite);
    
    // Date range change
    document.getElementById('date-range').addEventListener('change', function() {
        if (currentWebsiteId) {
            loadWebsiteMetrics(currentWebsiteId);
        }
    });
    
    // Modal close on outside click
    document.getElementById('add-website-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            hideAddWebsiteModal();
        }
    });
}

// Load all websites
async function loadWebsites() {
    try {
        showLoading();
        const response = await fetch('/api/websites');
        const websites = await response.json();
        
        displayWebsites(websites);
    } catch (error) {
        console.error('Error loading websites:', error);
        showNotification('Error loading websites', 'error');
    } finally {
        hideLoading();
    }
}

// Display websites in grid
function displayWebsites(websites) {
    const grid = document.getElementById('websites-grid');
    
    if (websites.length === 0) {
        grid.innerHTML = `
            <div class="empty-state glass-effect" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <i class="fas fa-globe fa-3x neon-icon" style="margin-bottom: 1rem;"></i>
                <h3>No websites added yet</h3>
                <p style="opacity: 0.7; margin-bottom: 2rem;">Add your first website to start monitoring SEO metrics</p>
                <button class="btn btn-primary neon-btn" onclick="showAddWebsiteModal()">
                    <i class="fas fa-plus"></i> Add Your First Website
                </button>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = websites.map(website => `
        <div class="website-card glass-effect fade-in-up" onclick="selectWebsite(${website.id}, '${website.name}')">
            <div class="website-header">
                <div>
                    <h3 class="website-name">${website.name}</h3>
                    <p class="website-url">${website.url}</p>
                </div>
                <div class="website-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); deleteWebsite(${website.id})" title="Delete Website">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="website-stats">
                <div class="stat-item">
                    <div class="stat-value">${website.is_verified ? 'Verified' : 'Pending'}</div>
                    <div class="stat-label">Status</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${website.last_audit ? 'Recent' : 'Never'}</div>
                    <div class="stat-label">Last Audit</div>
                </div>
            </div>
        </div>
    `).join('');
}

// Select a website to view metrics
async function selectWebsite(websiteId, websiteName) {
    currentWebsiteId = websiteId;
    document.getElementById('selected-website-name').textContent = `${websiteName} - Metrics`;
    document.getElementById('metrics-section').style.display = 'block';
    
    // Scroll to metrics section
    document.getElementById('metrics-section').scrollIntoView({ behavior: 'smooth' });
    
    await loadWebsiteMetrics(websiteId);
}

// Load metrics for a specific website
async function loadWebsiteMetrics(websiteId) {
    try {
        showLoading();
        const days = document.getElementById('date-range').value;
        const response = await fetch(`/api/websites/${websiteId}/metrics?days=${days}`);
        const metrics = await response.json();
        
        displayMetrics(metrics);
        updateChart(metrics);
    } catch (error) {
        console.error('Error loading metrics:', error);
        showNotification('Error loading metrics', 'error');
    } finally {
        hideLoading();
    }
}

// Display metrics in cards
function displayMetrics(metrics) {
    if (metrics.length === 0) {
        document.getElementById('total-clicks').textContent = '0';
        document.getElementById('total-impressions').textContent = '0';
        document.getElementById('avg-ctr').textContent = '0%';
        document.getElementById('avg-position').textContent = '0';
        return;
    }
    
    const totalClicks = metrics.reduce((sum, m) => sum + m.clicks, 0);
    const totalImpressions = metrics.reduce((sum, m) => sum + m.impressions, 0);
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : 0;
    const avgPosition = (metrics.reduce((sum, m) => sum + m.position, 0) / metrics.length).toFixed(1);
    
    document.getElementById('total-clicks').textContent = totalClicks.toLocaleString();
    document.getElementById('total-impressions').textContent = totalImpressions.toLocaleString();
    document.getElementById('avg-ctr').textContent = `${avgCtr}%`;
    document.getElementById('avg-position').textContent = avgPosition;
}

// Update performance chart
function updateChart(metrics) {
    const ctx = document.getElementById('performance-chart').getContext('2d');
    
    if (performanceChart) {
        performanceChart.destroy();
    }
    
    const labels = metrics.map(m => new Date(m.date).toLocaleDateString());
    const clicksData = metrics.map(m => m.clicks);
    const impressionsData = metrics.map(m => m.impressions);
    const positionData = metrics.map(m => m.position);
    
    performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Clicks',
                    data: clicksData,
                    borderColor: '#00f5ff',
                    backgroundColor: 'rgba(0, 245, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Impressions',
                    data: impressionsData,
                    borderColor: '#ff00ff',
                    backgroundColor: 'rgba(255, 0, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Average Position',
                    data: positionData,
                    borderColor: '#ffff00',
                    backgroundColor: 'rgba(255, 255, 0, 0.1)',
                    tension: 0.4,
                    fill: false,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#ffffff'
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });
}

// Show add website modal
function showAddWebsiteModal() {
    document.getElementById('add-website-modal').style.display = 'block';
    document.getElementById('website-name').focus();
}

// Hide add website modal
function hideAddWebsiteModal() {
    document.getElementById('add-website-modal').style.display = 'none';
    document.getElementById('add-website-form').reset();
}

// Handle add website form submission
async function handleAddWebsite(e) {
    e.preventDefault();
    
    const name = document.getElementById('website-name').value;
    const url = document.getElementById('website-url').value;
    
    try {
        showLoading();
        const response = await fetch('/api/websites', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, url })
        });
        
        if (response.ok) {
            hideAddWebsiteModal();
            showNotification('Website added successfully!', 'success');
            await loadWebsites();
        } else {
            const error = await response.json();
            showNotification(error.error || 'Error adding website', 'error');
        }
    } catch (error) {
        console.error('Error adding website:', error);
        showNotification('Error adding website', 'error');
    } finally {
        hideLoading();
    }
}

// Delete website
async function deleteWebsite(websiteId) {
    if (!confirm('Are you sure you want to delete this website? This action cannot be undone.')) {
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`/api/websites/${websiteId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('Website deleted successfully!', 'success');
            await loadWebsites();
            
            // Hide metrics section if current website was deleted
            if (currentWebsiteId === websiteId) {
                document.getElementById('metrics-section').style.display = 'none';
                currentWebsiteId = null;
            }
        } else {
            showNotification('Error deleting website', 'error');
        }
    } catch (error) {
        console.error('Error deleting website:', error);
        showNotification('Error deleting website', 'error');
    } finally {
        hideLoading();
    }
}

// Run audit for current website
async function runAudit() {
    if (!currentWebsiteId) {
        showNotification('Please select a website first', 'error');
        return;
    }
    
    try {
        showLoading();
        const response = await fetch(`/api/websites/${currentWebsiteId}/audit`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Audit completed successfully!', 'success');
            // You can display audit results here
            console.log('Audit results:', result.results);
        } else {
            showNotification(result.error || 'Error running audit', 'error');
        }
    } catch (error) {
        console.error('Error running audit:', error);
        showNotification('Error running audit', 'error');
    } finally {
        hideLoading();
    }
}

// Refresh data
async function refreshData() {
    await loadWebsites();
    if (currentWebsiteId) {
        await loadWebsiteMetrics(currentWebsiteId);
    }
    showNotification('Data refreshed!', 'success');
}

// Show loading overlay
function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} glass-effect`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add notification styles
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        color: white;
        z-index: 4000;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        max-width: 400px;
        animation: slideInRight 0.3s ease-out;
        ${type === 'success' ? 'border-left: 4px solid #00ff00;' : ''}
        ${type === 'error' ? 'border-left: 4px solid #ff0000;' : ''}
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
