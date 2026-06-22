
// -----------------------------------------------------------------------------
// MOCK SIMULATION OF updateDeliveryAvailability
// -----------------------------------------------------------------------------

async function mock_updateDeliveryAvailability(partnerState, payload) {
    console.log(`[TRACE] Initial DB Status: "${partnerState.availabilityStatus}"`);
    console.log(`[TRACE] Requested Status: "${payload.status}"`);

    const { status } = payload || {};
    let validStatus = 'offline';
    if (status === 'online' || status === true) validStatus = 'online';

    console.log(`[TRACE] Evaluating Transition: ${partnerState.availabilityStatus} -> ${validStatus}`);

    // This is the EXACT logic from line 335 of delivery.service.js
    const deductionBlockTriggered = (partnerState.availabilityStatus === 'offline' && validStatus === 'online');

    if (deductionBlockTriggered) {
        console.log("✅ DEDUCTION BLOCK TRIGGERED: Calling activateDailyPass...");
        return { success: true, deducted: true };
    } else {
        console.log("❌ DEDUCTION BLOCK SKIPPED: Logic condition (offline -> online) failed.");
        return { success: true, deducted: false };
    }
}

async function runAudit() {
    console.log("====================================================");
    console.log("LOGIC AUDIT: STALE ONLINE BUG PROOF");
    console.log("====================================================\n");

    // CASE A: STALE ONLINE
    console.log("--- TEST CASE A: STALE ONLINE ---");
    const staleState = { availabilityStatus: 'online' };
    const resultA = await mock_updateDeliveryAvailability(staleState, { status: 'online' });
    console.log(`Result: ${resultA.deducted ? "Deducted" : "SKIPPED"}`);
    console.log("Proof: Rider is already online in DB, so line 335 evaluates to FALSE.\n");

    // CASE B: FRESH ONLINE
    console.log("--- TEST CASE B: FRESH ONLINE ---");
    const freshState = { availabilityStatus: 'offline' };
    const resultB = await mock_updateDeliveryAvailability(freshState, { status: 'online' });
    console.log(`Result: ${resultB.deducted ? "Deducted" : "SKIPPED"}`);
    console.log("Proof: Rider is offline in DB, so line 335 evaluates to TRUE.\n");

    console.log("====================================================");
    console.log("CONCLUSION: THE STALE ONLINE BUG IS VERIFIED");
    console.log("====================================================");
}

runAudit();
