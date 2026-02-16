// Save Estimate to Database
// This file contains functions for persisting estimates to Supabase

// Function to save the current estimate to database
async function saveEstimate() {
    try {
        // Check if we have estimate data to save
        if (!estimate.estimateId) {
            alert('⚠️ No estimate to save. Please generate an estimate first.');
            return;
        }

        // Show saving indicator
        const saveButton = event.target;
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = '💾 Saving...';

        // Prepare payload
        const payload = {
            estimateData: {
                estimate_id: estimate.estimateId,
                work_name: estimate.workName,
                work_category: estimate.workCategory,
                voltage_levels: estimate.voltageLevels,
                prepared_by: estimate.preparedBy,
                surveyed_by: estimate.surveyedBy,
                structures: estimate.structures,
                route_lengths: estimate.routeLengths,
                gst_percent: estimate.gstPercent,
                gst_on: estimate.gstOn,
                contingency_percent: estimate.contingencyPercent,
                contingency_on: estimate.contingencyOn,
                supervision_percent: estimate.supervisionPercent,
                supervision_on: estimate.supervisionOn,
                cess_percent: estimate.cessPercent,
                cess_on: estimate.cessOn
            },
            calculatedResults: {
                materials: window.lastGeneratedMaterials || [],
                labour: window.lastGeneratedLabour || [],
                total_material_cost: window.lastTotalMaterialCost || 0,
                total_labour_cost: window.lastTotalLabourCost || 0,
                grand_total: window.lastGrandTotal || 0
            }
        };

        // Send to API
        const response = await fetch('/api/estimates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': window.currentUser ? window.currentUser.id : ''
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Failed to save estimate');
        }

        // Success!
        alert(`✅ Estimate saved successfully!\n\nEstimate ID: ${result.estimate_id}`);
        saveButton.textContent = '✅ Saved';

        // Reset button after 2 seconds
        setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.disabled = false;
        }, 2000);

    } catch (error) {
        console.error('Error saving estimate:', error);
        alert('❌ Failed to save estimate: ' + error.message);

        // Reset button
        const saveButton = event.target;
        saveButton.textContent = '💾 Save Estimate';
        saveButton.disabled = false;
    }
}
