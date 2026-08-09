
// ==UserScript==
// @name         VCS COL Camp bot by yalnunez
// @namespace    tampermonkey.net/
// @version      0.9.2.5
// @updateURL    https://raw.githubusercontent.com/yalnunez/campbotdaniteam/main/camp-aux-monitor-dave.user.js
// @downloadURL  https://raw.githubusercontent.com/yalnunez/campbotdaniteam/main/camp-aux-monitor-dave.user.js
// @description  VCS COL Camp bot - Monitor CAMP AUX durations, send alerts to OM webhooks by team, auto-change state - Sequential AutoClick (3.5s), System/Break/Break2/Break3/Lunch/Personal double-check via dedicated columns, Missed double-check via Missed Contacts column, On Contact alternating alerts, AWS UI Cloudscape dropdown fix, Post-dropdown agent verification, Multi-OM webhook routing, BOT_OPERATOR prompt, System Issue manual button, Event logs on close/refresh
// @author       @yalnunez
// @match        https://prod-iad.camp.wwcs.amazon.dev/Metrics
// @match        https://prod-fra.camp.wwcs.amazon.dev/Metrics
// @grant        GM_xmlhttpRequest
// @connect      hooks.chime.aws
// ==/UserScript==

(function () {
    'use strict';
const BOT_OPERATOR = prompt('Ingresa tu login para iniciar Camp Aux Monitor:') || 'unknown';

// ===== WEBHOOK CONFIGURATION =====

    const MANAGERS_WEBHOOKS = {
        'drvamzn': 'https://hooks.chime.aws/incomingwebhooks/5bde7c99-33ab-49ef-b829-4c1f9705bcc0?token=TkJTMHVzR1p8MXxvZ0hwMUF3WXBWaFVtRDkxZUZybDBUZXhUSU9MNHdnbElyM1hINGZnOGVv',
        'dvveland': 'https://hooks.chime.aws/incomingwebhooks/2ca54cf8-f8b2-4be0-8900-aca66d6922f6?token=ODFDQVlOMlF8MXxiSFpsR2Zib1d4SVMwQ2pCR3RDOVpvdUx5aGZ0ZlNzUnRMdHhSZUIzU1o4',
        'hincapg': 'https://hooks.chime.aws/incomingwebhooks/67141fea-a1f6-49aa-bba3-c3b3e6c5d4fc?token=Y2pJNTJ2cFZ8MXxlLVlpRmJMTTl6YW84UUFLcWNwZ1RidVdLVS1KaWZQcnNuVWo3SVhXUklF',
        'sernlaur': 'https://hooks.chime.aws/incomingwebhooks/44aee192-2f97-4bc6-9c42-b9677122115b?token=UmlnMjJIb018MXxwS21pVVlsMWRGMWZNM2lGS2FJYy1SdVo0QXY5N2RBNk9BRXE1WHRxVlc0'
    };

    const TM_TO_OM = {
        // drvamzn
        'admatall': 'drvamzn',
        'saaimara': 'drvamzn',
        'sandreac': 'drvamzn',
        'yalnunez': 'drvamzn',
        'cvillabo': 'drvamzn',
        'veraardi': 'drvamzn',
        // dvveland
        'camargis': 'dvveland',
        'cruizher': 'dvveland',
        'claraaqu': 'dvveland',
        'llandine': 'dvveland',
        'luribesa': 'dvveland',
        'robayotl': 'dvveland',
        // hincapg
        'narancri': 'hincapg',
        'omariacb': 'hincapg',
        'jcaldani': 'hincapg',
        'josefrzp': 'hincapg',
        'jeshin': 'hincapg',
        'jluckert': 'hincapg',
        // sernlaur
        'callealm': 'sernlaur',
        'erasergi': 'sernlaur',
        'humbrolo': 'sernlaur',
        'jslvaaa': 'sernlaur',
        'ospinabo': 'sernlaur',
        'rdrkat': 'sernlaur'
    };

    function getManagerWebhook(teamName) {
        const tm = teamName.trim().toLowerCase();
        const om = TM_TO_OM[tm];
        return om ? MANAGERS_WEBHOOKS[om] : null;
    }

    const TEAM_WEBHOOKS = {
         // ===== Dani =====
        'yalnunez': 'https://hooks.chime.aws/incomingwebhooks/3791ebb3-125b-40d8-85d0-b845fbd48d53?token=NkR6Y0NwOWR8MXxweGhWOFZRLVVxQTd2eUZ4S1B1Y2tEVm5uSXJZd2JwZXlLNlJPd2NXRW9n',
        'saaimara': 'https://hooks.chime.aws/incomingwebhooks/1b679063-b661-439b-b11a-778c5bb76277?token=SEx2ZndBTFR8MXxOd204VC1NVU9HNmF1b2JON2U0N0xqc2RhX296ckhGdzdwdGZMSU1XbEhB',
        'cvillabo': 'https://hooks.chime.aws/incomingwebhooks/d4182f95-dd4d-485a-ae75-44005a6f5326?token=S3BZU3FLam98MXxick9KOUlLUDhWQWh5am1RRlVVWW45a0YtazFPTzdUY1dfNVd0eWxZd3Zv',
        'sandreac': 'https://hooks.chime.aws/incomingwebhooks/7d15ca9a-38e2-497d-bd3b-a1e65ba90192?token=ekhFem1FUjZ8MXxINnQ1dXlCWTRwdWhBMEdyODZyMlpaX1YzYW9wdXdjRUxhM2xXNUx4V1lj',
        'admatall': 'https://hooks.chime.aws/incomingwebhooks/715cd178-45fa-447b-8e5c-4f50dc078e2e?token=V2hXOVdKMEZ8MXxkVkVuS2J5ajFOR3VOU05VbFVBODRXaTA2dFQ4bnFvelpzR2pZMkIxeVZz',
        'veraardi': 'https://hooks.chime.aws/incomingwebhooks/9e61e821-58b3-477f-8bf1-f05c494798a1?token=cmlLckFJVkt8MXwwaGNOQmdQSmVFTmgzdng2c1FmNmlWSlkxZlUxcE85NEo1ajFUdGU4c2Jz',
         // ===== Dave =====
        'robayotl': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'cruizher': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'llandine': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'luribesa': 'https://hooks.chime.aws/incomingwebhooks/206fb198-4995-43d3-9785-ca27ed5da95f?token=dm1Fa0JiSE18MXxnbDBzVXZKX3AyUDYxZTVkVTZJMjNvUXJENXJSNU85R0JseGFxS1BPTlZv',
        'camargis': 'https://hooks.chime.aws/incomingwebhooks/d167f698-1c19-4780-9fe6-00251348bd3f?token=RGoyTlVHSFB8MXxxNGZIVi1vZWs0Ny0wYW42ckN1YzE4UXpWb0RNaDd6YXpqQ0diZm5jZHdB',
        'claraaqu': 'https://hooks.chime.aws/incomingwebhooks/6cc7fcfa-e146-47b0-a077-86d535cfb4eb?token=VlhCc1FwdUl8MXxVVkdDN1dYMjdwemY2RlM4M1RKZ2FFS0x2X1pkMjNUSm5FcWthMnVIWkpF',
     // ===== Gus =====
        'narancri': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'omariacb': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'jcaldani': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'josefrzp': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'jeshin': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'jluckert': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
     // ===== Lau =====
        'callealm': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'erasergi': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'humbrolo': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'jslvaaa': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'ospinabo': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz',
        'rdrkat': 'https://hooks.chime.aws/incomingwebhooks/ab46dce3-8b29-42ae-8747-39966a9caed3?token=S2tUWnJ0VmF8MXxQOWI0cmNJdmpnOHhad1J5SVJXa0tTc2o5bVBkblhmdmgxNy1tbW16aVBz'
    };

    const LOG_WEBHOOK_URL = 'https://hooks.chime.aws/incomingwebhooks/ea16df87-66ad-4eab-b1e3-37967f8fbc26?token=M2VScERzbk58MXxqVERpUmVBYmQ2MWJzNzhqbFloVk56d2tCMFk3dHNzOG5HejVEaDF2eEpJ';

    // ===== UI: LEFT SIDEBAR PANEL =====

    const banner = document.createElement('div');
    banner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 280px;
        height: 100vh;
        color: white;
        background: #0073bb;
        padding: 10px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        box-sizing: border-box;
    `;

    const controls = document.createElement('div');
    controls.style.cssText = `display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;`;

    const startBtn = document.createElement('button');
    const pauseBtn = document.createElement('button');
    startBtn.style.cssText = `padding: 8px 15px; cursor: pointer; font-weight: bold; border-radius: 4px; border: none;`;
    pauseBtn.style.cssText = `padding: 8px 15px; cursor: pointer; font-weight: bold; border-radius: 4px; border: none;`;
    startBtn.textContent = 'Start Monitoring';
    pauseBtn.textContent = 'Pause Monitoring';

    let autoClickEnabled = false;
    const autoClickBtn = document.createElement('button');
    autoClickBtn.style.cssText = `padding: 8px 15px; cursor: pointer; background: #ff4d4d; color: white; border: 2px solid white; border-radius: 4px; font-weight: bold;`;
    autoClickBtn.textContent = '\u{1F534} AutoClick OFF';
    autoClickBtn.addEventListener('click', () => {
        autoClickEnabled = !autoClickEnabled;
        autoClickBtn.textContent = autoClickEnabled ? '\u{1F7E2} AutoClick ON' : '\u{1F534} AutoClick OFF';
        autoClickBtn.style.background = autoClickEnabled ? '#28a745' : '#ff4d4d';
        addStatusMessage(autoClickEnabled ? 'AutoClick ENABLED' : 'AutoClick DISABLED');
    });

    let debugMode = false;
    const debugBtn = document.createElement('button');
    debugBtn.style.cssText = `padding: 8px 15px; cursor: pointer; background: #6c757d; color: white; border: 2px solid white; border-radius: 4px; font-weight: bold; font-size: 11px;`;
    debugBtn.textContent = '\u{1F41B} Debug OFF';
    debugBtn.addEventListener('click', () => {
        debugMode = !debugMode;
        debugBtn.textContent = debugMode ? '\u{1F41B} Debug ON' : '\u{1F41B} Debug OFF';
        debugBtn.style.background = debugMode ? '#17a2b8' : '#6c757d';
        addStatusMessage(debugMode ? 'Debug mode ON' : 'Debug mode OFF');
    });

    controls.appendChild(startBtn);
    controls.appendChild(pauseBtn);
    controls.appendChild(autoClickBtn);
    controls.appendChild(debugBtn);
// ===== SYSTEM ISSUE BUTTON + INPUT =====
const systemIssueContainer = document.createElement('div');
systemIssueContainer.style.cssText = `display: flex; flex-direction: column; gap: 4px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 8px; margin-top: 4px;`;

const systemInput = document.createElement('input');
systemInput.type = 'text';
systemInput.placeholder = 'Agent login...';
systemInput.style.cssText = `padding: 6px 10px; border-radius: 4px; border: 1px solid #ccc; font-size: 12px; color: #333;`;

const systemBtn = document.createElement('button');
systemBtn.style.cssText = `padding: 8px 15px; cursor: pointer; background: #ff8c00; color: white; border: 2px solid white; border-radius: 4px; font-weight: bold; font-size: 11px;`;
systemBtn.textContent = '⚙️ Move to System Issue';
systemBtn.addEventListener('click', async () => {
    const login = systemInput.value.trim().toLowerCase();
    if (!login) {
        addStatusMessage('⚠️ Enter an agent login first');
        return;
    }
    addStatusMessage(`⚙️ Searching for ${login}...`);

    const table = findRelevantTable();
    if (!table) { addStatusMessage('❌ Table not found'); return; }

    const idx = findColumnIndexes(table);
    const rows = table.querySelectorAll('tbody tr');
    let targetCell = null;
    let agentFullName = '';

    for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 5) {
            const agentText = cells[idx.agent].textContent.trim();
            const agentLogin = agentText.replace(/@amazon.*$/i, '').trim().toLowerCase();
            if (agentLogin === login) {
                targetCell = cells[idx.state];
                agentFullName = agentText;
                break;
            }
        }
    }

    if (!targetCell) {
        addStatusMessage(`❌ Agent "${login}" not found in table`);
        return;
    }

    addStatusMessage(`⚙️ Moving ${login} to System...`);
    const success = await openDropdownAndSelectState(targetCell, agentFullName, 'System');
  if (success) {
    addStatusMessage(`✅ ${login} → System Issue`);
    logDisconnection(login, 'System', 'Manual', 'System Issue', BOT_OPERATOR);
    systemInput.value = '';

    // Enviar alerta al OM del operador
    const operatorOM = TM_TO_OM[BOT_OPERATOR.trim().toLowerCase()];
    const systemAlertUrl = operatorOM ? MANAGERS_WEBHOOKS[operatorOM] : MANAGERS_WEBHOOKS.drvamzn;

    GM_xmlhttpRequest({
        method: 'POST',
        url: systemAlertUrl,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
            Content: `/md
⚙️ **System Issue Manual**

**${BOT_OPERATOR}** movió a **${login}** a estado **System Issue** manualmente.

Hora: ${new Date().toLocaleTimeString()}`
        }),
        onload: (r) => { addStatusMessage(r.status < 300 ? `\u{1F4E4} System Issue alert sent [${operatorOM || 'fallback'}]` : `\u{274C} System alert HTTP ${r.status}`); },
        onerror: () => { addStatusMessage('\u{274C} System Issue alert failed'); }
    });
} else {
    addStatusMessage(`❌ Failed to move ${login} to System`);
}
});

systemIssueContainer.appendChild(systemInput);
systemIssueContainer.appendChild(systemBtn);
controls.appendChild(systemIssueContainer);

    const statusDisplay = document.createElement('div');
    statusDisplay.style.cssText = `flex-grow: 1; overflow-y: auto; font-size: 11px; line-height: 1.4; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 10px; margin-top: 10px;`;

    banner.appendChild(controls);
    banner.appendChild(statusDisplay);
    document.body.insertBefore(banner, document.body.firstChild);

    const rootDiv = document.querySelector('#root');
    if (rootDiv) rootDiv.style.marginLeft = '280px';
    const navbar = document.querySelector('#navbar');
    if (navbar) navbar.style.marginLeft = '280px';

    // ===== AUX THRESHOLDS =====

    const AUX_THRESHOLDS = {
      	'Available': 10800,
        'Meeting': 10800,
        'Training': 10800,
        'Missed': 60,
        'Email': 90,
        'Break': 915,
        'Break2': 915,
        'Break3': 0,
        'Personal': 375,
        'Project': 10800,
        'Lunch': 3615,
        'System': 300,
        'On Contact': 1800,
        'UpcomingOffline': 60,

    };

    //===== PWD AGENTS (Extended Break: 20:15 = 1215s) =====
    const PWD_AGENTS = [
        'roalvarz',
        'duqqcarl',
        // Agregar más logins aquí
    ];
    const PWD_BREAK_THRESHOLD = 1215;
    function getBreakThreshold(agentName) {
        const login = agentName.replace(/@amazon.*$/i, '').trim().toLowerCase();
        return PWD_AGENTS.includes(login) ? PWD_BREAK_THRESHOLD : AUX_THRESHOLDS.Break;
    }

    const AUTO_OFFLINE_STATES = ['Missed', 'Break', 'Break2', 'Break3', 'Personal', 'Lunch', 'System', 'Email', 'UpcomingOffline'];

    let isMonitoring = false;
    let monitoringTimeout = null;
    let disconnectionLog = [];

    // ===== Previous cycle tracking for On Contact alternating =====
    let previousOnContactAlerted = new Set();

    // ===== Session counters for enhanced log =====
    let sessionCounters = {
        totalDisconnected: 0,
        totalMovedToAvailable: 0,
        totalFailed: 0,
        totalManagerAlerts: 0,
        totalTeamAlerts: 0
    };

    // ===== UTILITY FUNCTIONS =====

    function debugLog(...args) { if (debugMode) console.log('[CAMP Monitor]', ...args); }
    function getClassName(el) { return el ? (el.getAttribute('class') || '') : ''; }

    function addStatusMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        const msg = document.createElement('div');
        msg.textContent = `${timestamp}: ${message}`;
        statusDisplay.appendChild(msg);
        statusDisplay.scrollTop = statusDisplay.scrollHeight;
        while (statusDisplay.children.length > 100) statusDisplay.removeChild(statusDisplay.firstChild);
    }

   function logDisconnection(agentName, state, duration, action, team) {
    disconnectionLog.push({
        time: new Date().toLocaleTimeString(),
        agent: agentName,
        team: team || 'N/A',
        state,
        duration,
        action: action || 'Offline'
    });
}

    function parseTimeToSeconds(timeString) {
        if (!timeString) return 0;
        const parts = timeString.trim().split(':');
        if (parts.length !== 3) return 0;
        return (parseInt(parts[0]) || 0) * 3600 + (parseInt(parts[1]) || 0) * 60 + (parseInt(parts[2]) || 0);
    }

    // ===== ANTI-THROTTLE: Web Worker Timer =====
    // Los setTimeout en background tabs se throttlean a 60s mínimo.
    // Un Web Worker NO se throttlea, así que lo usamos para los delays.

    const workerBlob = new Blob([`
        self.onmessage = function(e) {
            setTimeout(function() {
                self.postMessage(e.data);
            }, e.data.ms);
        };
    `], { type: 'application/javascript' });

    const workerURL = URL.createObjectURL(workerBlob);
    const timerWorker = new Worker(workerURL);

    let delayResolvers = {};
    let delayIdCounter = 0;

    timerWorker.onmessage = function(e) {
        const id = e.data.id;
        if (delayResolvers[id]) {
            delayResolvers[id]();
            delete delayResolvers[id];
        }
    };

    // ANTI-THROTTLE delay (NO se throttlea en background tabs):
    function delay(ms) {
        return new Promise(resolve => {
            const id = ++delayIdCounter;
            delayResolvers[id] = resolve;
            timerWorker.postMessage({ id, ms });
        });
    }

    function formatSeconds(s) {
        return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }

    // ===== SESSION RESUME =====

    async function checkAndResumeSession() {
        const bodyText = document.body.textContent || '';
        const hasInactiveMessage = bodyText.includes('Session has been inactive for more than 5 Minute') ||
            bodyText.includes('session has been inactive');

        if (!hasInactiveMessage) return true;

        debugLog('Detected inactive session modal, attempting to resume...');
        addStatusMessage('\u{1F504} Session inactive detected, resuming...');

        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const checkbox of checkboxes) {
            const label = checkbox.closest('label') || checkbox.parentElement;
            const labelText = label ? label.textContent.trim() : '';
            if (labelText.includes('Resume Auto Refresh') || labelText.includes('Resume')) {
                if (!checkbox.checked) {
                    simulateClick(checkbox);
                    debugLog('Clicked Resume Auto Refresh checkbox');
                    await delay(1000);
                }
                const modal = checkbox.closest('[class*="modal"], [class*="dialog"], [class*="popup"], [role="dialog"], [role="alertdialog"]');
                if (modal) {
                    const confirmBtn = modal.querySelector('button[type="submit"], button.primary, button[class*="primary"], button[class*="confirm"]');
                    if (confirmBtn) {
                        simulateClick(confirmBtn);
                        await delay(1000);
                    }
                }
                addStatusMessage('\u{2705} Clicked Resume Auto Refresh checkbox');
                await delay(2000);
                return true;
            }
        }

        const allLabels = document.querySelectorAll('label, span, div');
        for (const el of allLabels) {
            if (el.childElementCount <= 2 && el.textContent.trim().includes('Resume Auto Refresh')) {
                simulateClick(el);
                debugLog('Clicked element containing "Resume Auto Refresh"');
                await delay(1000);

                const innerCheckbox = el.querySelector('input[type="checkbox"]');
                if (innerCheckbox && !innerCheckbox.checked) {
                    simulateClick(innerCheckbox);
                    await delay(500);
                }

                addStatusMessage('\u{2705} Resumed session via label click');
                await delay(2000);
                return true;
            }
        }

        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            if (banner.contains(btn)) continue;
            const btnText = btn.textContent.trim();
            if (btnText.includes('Resume Auto Refresh') || btnText === 'Resume') {
                simulateClick(btn);
                debugLog('Clicked Resume Auto Refresh button');
                addStatusMessage('\u{2705} Clicked Resume button');
                await delay(2000);
                return true;
            }
        }

        const visibleCheckboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const cb of visibleCheckboxes) {
            const rect = cb.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && !cb.checked) {
                const parent = cb.closest('[class*="modal"], [class*="dialog"], [class*="alert"], [class*="popup"], [role="dialog"], [role="alertdialog"]');
                if (parent || isInFloatingContext(cb)) {
                    simulateClick(cb);
                    debugLog('Clicked checkbox in modal context');
                    addStatusMessage('\u{2705} Clicked resume checkbox (fallback)');
                    await delay(2000);
                    return true;
                }
            }
        }

        addStatusMessage('\u{26A0}\u{FE0F} Could not find Resume Auto Refresh control');
        return false;
    }

    // ===== ENHANCED DISCONNECTION LOG WITH SUMMARY =====

    function sendLogToWebhook() {
        if (disconnectionLog.length === 0 && sessionCounters.totalDisconnected === 0 && sessionCounters.totalManagerAlerts === 0) return;

        const summary = `/md\n**CAMP Monitor - Event Log Report**\nSession: ${new Date().toLocaleString()}\n\n` +
            `**RESUMEN DE SESION**\n\n` +
            `| Metric | Count |\n|--------|-------|\n` +
            `| Total Disconnected (Offline) | ${sessionCounters.totalDisconnected} |\n` +
            `| Total Moved to Available | ${sessionCounters.totalMovedToAvailable} |\n` +
            `| Total Failed Attempts | ${sessionCounters.totalFailed} |\n` +
            `| Manager Alerts Sent | ${sessionCounters.totalManagerAlerts} |\n` +
            `| Team Alerts Sent | ${sessionCounters.totalTeamAlerts} |\n`;

        let detail = '';
        if (disconnectionLog.length > 0) {
            const rows = disconnectionLog.map(e => `| ${e.time} | ${e.agent} | ${e.team} | ${e.state} | ${e.duration} | ${e.action} |`).join('\n');
detail = `
**DETALLE DE EVENTOS**

| Time | Agent | Team | State | Duration | Action |
|------|-------|------|-------|----------|--------|
${rows}`;
        } else {
            detail = '\nNo individual events logged.';
        }

        const content = { Content: `${summary}${detail}` };

        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'POST', url: LOG_WEBHOOK_URL,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(content),
                onload: (r) => { debugLog('Log Webhook:', r.status); },
                onerror: (e) => { console.error('[CAMP Monitor] Log Error:', e); }
            });
        } else {
            navigator.sendBeacon(LOG_WEBHOOK_URL, new Blob([JSON.stringify(content)], { type: 'application/json' }));
        }
    }

    window.addEventListener('beforeunload', () => { sendLogToWebhook(); });
    window.addEventListener('pagehide', () => { sendLogToWebhook(); });
    window.addEventListener('unload', () => { sendLogToWebhook(); });


    // ===== EXTRACT HEADER TEXT =====

    function extractHeaderText(cell) {
        const boldDiv = cell.querySelector('div[style*="font-weight: bold"]');
        if (boldDiv) return boldDiv.textContent.trim();
        const span = cell.querySelector('span');
        if (span) return span.textContent.trim();
        for (const child of cell.childNodes) {
            if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) return child.textContent.trim();
        }
        return cell.innerText?.split('\n')[0]?.trim() || cell.textContent.trim();
    }

    // ===== REACT-COMPATIBLE EVENT HELPERS =====

    function setNativeValue(element, value) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
        } else {
            valueSetter.call(element, value);
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // ===== SIMULATE CLICK (Enhanced for AWS UI Cloudscape - onMouseDown || onClick || onPointerDown) =====

    function simulateClick(element) {
        if (!element) return;

        // Buscar React internal props
        const reactPropsKey = Object.keys(element).find(key =>
            key.startsWith('__reactProps$') || key.startsWith('__reactEvents$')
        );

        if (reactPropsKey) {
            const props = element[reactPropsKey];
            // Cloudscape usa onMouseDown para selección de opciones en dropdowns
            const handler = props?.onMouseDown || props?.onClick || props?.onPointerDown;
            if (handler) {
                try {
                    const syntheticEvent = {
                        preventDefault: () => {},
                        stopPropagation: () => {},
                        nativeEvent: new MouseEvent('mousedown'),
                        target: element,
                        currentTarget: element,
                        bubbles: true,
                        cancelable: true,
                        type: handler === props?.onMouseDown ? 'mousedown' : 'click',
                        button: 0,
                        clientX: element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2,
                        clientY: element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2
                    };
                    handler(syntheticEvent);
                    return;
                } catch (e) {
                    debugLog('React handler failed:', e.message);
                }
            }
        }

        // Fallback: full DOM event sequence
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        const opts = { bubbles: true, cancelable: true, view: document.defaultView, clientX: x, clientY: y, screenX: x, screenY: y };
        const pOpts = { bubbles: true, cancelable: true, clientX: x, clientY: y, screenX: x, screenY: y, pointerId: 1, pointerType: 'mouse' };

        element.dispatchEvent(new PointerEvent('pointerover', pOpts));
        element.dispatchEvent(new PointerEvent('pointerenter', { ...pOpts, bubbles: false }));
        element.dispatchEvent(new PointerEvent('pointerdown', { ...pOpts, button: 0 }));
        element.dispatchEvent(new MouseEvent('mouseenter', { ...opts, bubbles: false }));
        element.dispatchEvent(new MouseEvent('mouseover', opts));
        element.dispatchEvent(new MouseEvent('mousedown', { ...opts, button: 0 }));
        element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('mouseup', { ...opts, button: 0 }));
        element.dispatchEvent(new MouseEvent('click', { ...opts, button: 0 }));
        element.dispatchEvent(new PointerEvent('pointerup', { ...pOpts, button: 0 }));
    }

    function simulateTyping(element, text) {
        element.focus();
        setNativeValue(element, '');
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
            element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
            setNativeValue(element, text.substring(0, i + 1));
            element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        }
    }

    // ===== TABLE FINDING AND PARSING =====

    function findRelevantTable() {
        const tables = document.querySelectorAll('table');
        let target = null;
        tables.forEach(table => {
            const headers = table.querySelectorAll('th');
            let found = 0;
            const required = ['Agent', 'Team', 'State', 'Profile', 'Duration'];
            headers.forEach(cell => { if (required.includes(extractHeaderText(cell))) found++; });
            if (found >= required.length) target = table;
        });
        return target;
    }

    function findColumnIndexes(table) {
        const headers = table.querySelectorAll('th');
        let idx = { agent: -1, team: -1, state: -1, duration: -1, profile: -1, outageTime: -1, breakTime: -1, break2Time: -1, break3Time: -1, lunchTime: -1, personalTime: -1, missedContacts: -1 };
        headers.forEach((cell, i) => {
            const t = extractHeaderText(cell);
            if (t === 'Agent') idx.agent = i;
            else if (t === 'Team') idx.team = i;
            else if (t === 'State') idx.state = i;
            else if (t === 'Duration') idx.duration = i;
            else if (t === 'Profile') idx.profile = i;
            else if (t === 'Outage Time') idx.outageTime = i;
            else if (t === 'Break Time') idx.breakTime = i;
            else if (t === 'Break2 Time') idx.break2Time = i;
            else if (t === 'Break3 Time') idx.break3Time = i;
            else if (t === 'Lunch Time') idx.lunchTime = i;
            else if (t === 'Personal Time') idx.personalTime = i;
            else if (t === 'Missed Contacts') idx.missedContacts = i;
        });
        if (idx.agent === -1 || idx.team === -1 || idx.state === -1 || idx.duration === -1 || idx.profile === -1) {
            headers.forEach((cell, i) => {
                const raw = cell.textContent.trim();
                if (idx.agent === -1 && raw.includes('Agent')) idx.agent = i;
                else if (idx.team === -1 && raw.includes('Team')) idx.team = i;
                else if (idx.state === -1 && raw.includes('State')) idx.state = i;
                else if (idx.duration === -1 && raw.includes('Duration')) idx.duration = i;
                else if (idx.profile === -1 && raw.includes('Profile')) idx.profile = i;
                else if (idx.outageTime === -1 && raw.includes('Outage Time')) idx.outageTime = i;
                else if (idx.breakTime === -1 && raw.includes('Break Time')) idx.breakTime = i;
                else if (idx.break2Time === -1 && raw.includes('Break2 Time')) idx.break2Time = i;
                else if (idx.break3Time === -1 && raw.includes('Break3 Time')) idx.break3Time = i;
                else if (idx.lunchTime === -1 && raw.includes('Lunch Time')) idx.lunchTime = i;
                else if (idx.personalTime === -1 && raw.includes('Personal Time')) idx.personalTime = i;
                else if (idx.missedContacts === -1 && raw.includes('Missed Contacts')) idx.missedContacts = i;
            });
        }
        return idx;
    }

    function findAgentStateCell(agentName) {
        const table = findRelevantTable();
        if (!table) return null;
        const idx = findColumnIndexes(table);
        const rows = table.querySelectorAll('tbody tr');
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 5 && cells[idx.agent].textContent.trim() === agentName) return cells[idx.state];
        }
        return null;
    }

    // ===== POST-DROPDOWN AGENT VERIFICATION =====

    function verifyAgentFromRow(stateCell, expectedAgentName) {
        const row = stateCell.closest('tr');
        if (!row) {
            debugLog('VERIFY: Could not find parent <tr> from stateCell');
            return false;
        }

        const table = findRelevantTable();
        if (!table) {
            debugLog('VERIFY: Table not found');
            return false;
        }

        const idx = findColumnIndexes(table);
        if (idx.agent === -1) {
            debugLog('VERIFY: Agent column index not found');
            return false;
        }

        const cells = row.querySelectorAll('td');
        if (cells.length <= idx.agent) {
            debugLog('VERIFY: Row does not have enough cells');
            return false;
        }

        const actualAgentName = cells[idx.agent].textContent.trim();

        if (actualAgentName === expectedAgentName) {
            debugLog(`VERIFY OK: Row agent "${actualAgentName}" matches expected "${expectedAgentName}"`);
            return true;
        } else {
            debugLog(`VERIFY FAILED: Row agent "${actualAgentName}" does NOT match expected "${expectedAgentName}"`);
            return false;
        }
    }

    // ===== SORT BY AGENT =====

    function clickAgentHeader() {
        const table = findRelevantTable();
        if (!table) return false;
        const headers = table.querySelectorAll('th');
        let agentHeader = null;
        headers.forEach(cell => { if (extractHeaderText(cell) === 'Agent') agentHeader = cell; });
        if (agentHeader) {
            const target = agentHeader.querySelector('button') || agentHeader.querySelector('[role="button"]') || agentHeader.querySelector('div[style*="font-weight: bold"]') || agentHeader.querySelector('div') || agentHeader;
            simulateClick(target);
            addStatusMessage('\u{1F504} Sorted by Agent');
            return true;
        }
        addStatusMessage('\u{26A0}\u{FE0F} Agent header not found');
        return false;
    }

    // ===== CAMP PAUSE BUTTON =====

    function clickCampPauseButton() {
        const pause = document.querySelector('button[data-testid="metrics-datatable-pause"]');
        if (pause) {
            simulateClick(pause);
            addStatusMessage('\u{23F8}\u{FE0F} CAMP Paused');
            return true;
        }
        addStatusMessage('\u{26A0}\u{FE0F} Pause button not found');
        return false;
    }

    // ===== CAMP PLAY/RESUME BUTTON =====

    function clickCampPlayButton() {
        const play = document.querySelector('button[data-testid="metrics-datatable-play"]');
        if (play) {
            simulateClick(play);
            addStatusMessage('\u{25B6}\u{FE0F} CAMP Resumed (Play)');
            return true;
        }
        addStatusMessage('\u{26A0}\u{FE0F} Play button not found');
        return false;
    }

    // ===== AWS UI CLOUDSCAPE DROPDOWN - STATE SELECTION =====

    async function selectStateFromDropdown(stateName) {
        debugLog(`selectStateFromDropdown: Looking for "${stateName}"...`);

        // Strategy 1: Find <li role="option"> containing <span data-value="StateName">
        const allOptions = document.querySelectorAll('li[role="option"]');
        for (const li of allOptions) {
            const dataValueSpan = li.querySelector(`span[data-value="${stateName}"]`);
            if (dataValueSpan && li.getBoundingClientRect().width > 0) {
                debugLog(`Strategy 1: Found li with span[data-value="${stateName}"], clicking li...`);
                simulateClick(li);
                await delay(300);
                simulateClick(dataValueSpan);
                await delay(200);
                return true;
            }
        }

        // Strategy 2: Find <li role="option"> containing <span title="StateName">
        for (const li of allOptions) {
            const titleSpan = li.querySelector(`span[title="${stateName}"]`);
            if (titleSpan && li.getBoundingClientRect().width > 0) {
                debugLog(`Strategy 2: Found li with span[title="${stateName}"], clicking li...`);
                simulateClick(li);
                await delay(300);
                simulateClick(titleSpan);
                await delay(200);
                return true;
            }
        }

        // Strategy 3: Find any visible <li role="option"> whose label text matches exactly
        for (const li of allOptions) {
            const labelSpan = li.querySelector('span[class*="label"]');
            if (labelSpan && labelSpan.textContent.trim() === stateName && li.getBoundingClientRect().width > 0) {
                debugLog(`Strategy 3: Found li with label text "${stateName}", clicking li...`);
                simulateClick(li);
                await delay(300);
                return true;
            }
        }

        // Strategy 4: Fallback - mousedown/mouseup/click on matching li
        for (const li of allOptions) {
            const dataValueSpan = li.querySelector(`span[data-value="${stateName}"]`);
            if (dataValueSpan && li.getBoundingClientRect().width > 0) {
                const rect = li.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                li.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
                await delay(100);
                li.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
                await delay(100);
                li.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
                await delay(300);
                debugLog(`Strategy 4: Mousedown approach for "${stateName}"`);
                return true;
            }
        }

        debugLog(`selectStateFromDropdown: "${stateName}" NOT FOUND in dropdown`);
        return false;
    }

    // ===== OPEN DROPDOWN, VERIFY AGENT, AND SELECT STATE =====

    async function openDropdownAndSelectState(stateCell, agentName, targetState) {
        try {
            const clickTarget = findDropdownTrigger(stateCell);
            debugLog(`Opening dropdown for ${agentName}, target: ${targetState}`);
            simulateClick(clickTarget || stateCell);
            await delay(1500);

            const isCorrectAgent = verifyAgentFromRow(stateCell, agentName);
            if (!isCorrectAgent) {
                addStatusMessage(`\u{1F6AB} WRONG AGENT: Dropdown opened for wrong row, expected ${agentName}. Closing...`);
                closeOpenDropdown();
                await delay(500);
                return false;
            }
            addStatusMessage(`\u{2705} Verified: ${agentName} confirmed before state change`);

            let success = await selectStateFromDropdown(targetState);

            if (!success) {
                debugLog(`First attempt failed for ${agentName}, retrying...`);
                closeOpenDropdown();
                await delay(1000);

                const freshCell = findAgentStateCell(agentName);
                if (freshCell) {
                    const retry = findDropdownTrigger(freshCell);
                    simulateClick(retry || freshCell);
                    await delay(1500);

                    const isCorrectRetry = verifyAgentFromRow(freshCell, agentName);
                    if (!isCorrectRetry) {
                        addStatusMessage(`\u{1F6AB} WRONG AGENT on retry: expected ${agentName}. Closing...`);
                        closeOpenDropdown();
                        await delay(500);
                        return false;
                    }

                    success = await selectStateFromDropdown(targetState);
                }
            }

            if (!success) {
                debugLog(`Second attempt failed for ${agentName}, trying mousedown approach...`);
                closeOpenDropdown();
                await delay(1000);

                const freshCell2 = findAgentStateCell(agentName);
                if (freshCell2) {
                    const retry2 = findDropdownTrigger(freshCell2);
                    simulateClick(retry2 || freshCell2);
                    await delay(1500);

                    const isCorrectRetry2 = verifyAgentFromRow(freshCell2, agentName);
                    if (!isCorrectRetry2) {
                        addStatusMessage(`\u{1F6AB} WRONG AGENT on 3rd attempt: expected ${agentName}. Closing...`);
                        closeOpenDropdown();
                        await delay(500);
                        return false;
                    }

                    const allOptions = document.querySelectorAll('li[role="option"]');
                    for (const li of allOptions) {
                        const span = li.querySelector(`span[data-value="${targetState}"]`);
                        if (span && li.getBoundingClientRect().width > 0) {
                            const rect = li.getBoundingClientRect();
                            const x = rect.left + rect.width / 2;
                            const y = rect.top + rect.height / 2;
                            li.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
                            await delay(100);
                            li.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
                            await delay(100);
                            li.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
                            await delay(300);
                            success = true;
                            debugLog(`Mousedown approach succeeded for ${agentName} -> ${targetState}`);
                            break;
                        }
                    }
                }
            }

            if (success) {
                addStatusMessage(`\u{2705} ${agentName} -> ${targetState}`);
            } else {
                addStatusMessage(`\u{26A0}\u{FE0F} Failed: ${agentName} -> ${targetState}`);
                closeOpenDropdown();
            }

            await delay(1000);
            return success;
        } catch (error) {
            addStatusMessage(`\u{274C} Error: ${agentName} -> ${targetState}: ${error.message}`);
            closeOpenDropdown();
            return false;
        }
    }

    // ===== CHANGE AGENT STATE TO OFFLINE =====

    async function changeAgentStateToOffline(stateCell, agentName) {
        return await openDropdownAndSelectState(stateCell, agentName, 'Offline');
    }

    // ===== CHANGE AGENT STATE TO AVAILABLE =====

    async function changeAgentStateToAvailable(stateCell, agentName) {
        return await openDropdownAndSelectState(stateCell, agentName, 'Available');
    }

    // ===== DROPDOWN HELPERS =====

    function findDropdownTrigger(stateCell) {
        const btn = stateCell.querySelector('button[class*="button-trigger"]') || stateCell.querySelector('[data-testid="aux-dropdown"] button');
        if (btn) return btn;

        const selectors = ['button', '[role="button"]', '[role="combobox"]', '[class*="trigger"]', '[class*="select"]', '[class*="dropdown"]', '[tabindex="0"]'];
        for (const s of selectors) {
            const el = stateCell.querySelector(s);
            if (el && el.getBoundingClientRect().width > 0 && !el.hasAttribute('data-testid')) return el;
        }
        const divs = stateCell.querySelectorAll('div');
        for (const d of divs) { if (d.getBoundingClientRect().width > 20) return d; }
        return null;
    }

    function closeOpenDropdown() {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        setTimeout(() => { document.body.click(); }, 200);
    }

    function isInFloatingContext(element) {
        let parent = element.parentElement, depth = 0;
        while (parent && depth < 20) {
            const style = window.getComputedStyle(parent);
            const role = parent.getAttribute('role');
            const cn = getClassName(parent).toLowerCase();
            const z = parseInt(style.zIndex);
            if (style.position === 'fixed' || style.position === 'absolute' || (z && z > 100) ||
                role === 'listbox' || role === 'menu' || role === 'dialog' || role === 'presentation' ||
                cn.includes('portal') || cn.includes('overlay') || cn.includes('popover') ||
                cn.includes('dropdown') || cn.includes('popup') || cn.includes('floating') || cn.includes('menu') ||
                parent.hasAttribute('data-portal') || parent.hasAttribute('data-overlay')) {
                if (parent !== banner && !banner.contains(parent)) return true;
            }
            parent = parent.parentElement; depth++;
        }
        return false;
    }

    // ===== MAIN MONITORING CYCLE =====

    async function monitoringCycle() {
        if (!isMonitoring) return;

        const sessionOk = await checkAndResumeSession();
        if (!sessionOk) {
            addStatusMessage('\u{26A0}\u{FE0F} Session could not be resumed, retrying in 30s...');
            monitoringTimeout = setTimeout(monitoringCycle, 30000);
            return;
        }

        addStatusMessage('\u{1F501} === Cycle start ===');


        // ===== CHECK REFRESH STOPPED =====
        const refreshStoppedEl = document.querySelector('div.awsui_child_18582_66aol_97 a.awsui_disabled_vjswe_10957_198');
        const refreshStoppedByText = refreshStoppedEl && refreshStoppedEl.textContent.trim().includes('Refresh Stopped');
        const isRefreshStopped = refreshStoppedEl && refreshStoppedByText;
        if (isRefreshStopped) {
            addStatusMessage('\u{1F6A8} CAMP Refresh Stopped detected!');

            const operatorOM = TM_TO_OM[BOT_OPERATOR.trim().toLowerCase()];
            const refreshUrl = operatorOM ? MANAGERS_WEBHOOKS[operatorOM] : MANAGERS_WEBHOOKS['drvamzn'];

            GM_xmlhttpRequest({
                method: 'POST',
                url: refreshUrl,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    Content: `/md\n\u{26A0}\u{FE0F} **Problema de Conexión CAMP Detectado** (Bot: ${BOT_OPERATOR})\n\n@All Members\nCAMP está mostrando **"Refresh Stopped"** — la tabla de métricas NO se está actualizando.\n\nPor favor revisen la sesión de CAMP y refresquen si es necesario.\n\nHora: ${new Date().toLocaleTimeString()}`
                }),
                onload: (r) => { addStatusMessage(r.status < 300 ? `\u{1F4E4} Refresh Stopped alert sent [${operatorOM || 'fallback'}]` : '\u{274C} Alert HTTP ' + r.status); },
                onerror: () => { addStatusMessage('\u{274C} Refresh Stopped alert failed'); }
            });
            addStatusMessage('\u{23F3} Next cycle in 60s...');
            monitoringTimeout = setTimeout(monitoringCycle, 60000);
            return;
        }

        clickAgentHeader();

        await delay(3000);
        if (!isMonitoring) return;
        await checkAndResumeSession();
        clickCampPauseButton();

        await delay(3000);
        if (!isMonitoring) return;
        await checkAndResumeSession();

        try {
            await processTableData();
        } catch (error) {
            addStatusMessage(`\u{274C} Error: ${error.message}`);
        }

        await delay(3000);
        if (!isMonitoring) return;
        clickCampPlayButton();

        if (!isMonitoring) return;
        addStatusMessage('\u{23F3} Next cycle in 60s...');
        monitoringTimeout = setTimeout(monitoringCycle, 60000);
    }

    // ===== PROCESS TABLE DATA =====

    async function processTableData() {
        const table = findRelevantTable();
        if (!table) { addStatusMessage('\u{26A0}\u{FE0F} Table not found'); return; }

        const idx = findColumnIndexes(table);
        if (idx.agent === -1 || idx.team === -1 || idx.state === -1 || idx.duration === -1 || idx.profile === -1) {
            addStatusMessage('\u{274C} Missing required columns');
            return;
        }

        if (idx.missedContacts === -1) {
            addStatusMessage('\u{26A0}\u{FE0F} "Missed Contacts" column not found - Missed logic will default to Offline');
        }

        let allAlerts = [];
        let offlineAlerts = [];
        let availableAlerts = [];
        let stateChangeQueue = [];
        let currentOnContactViolations = new Set();
        const rows = table.querySelectorAll('tbody tr');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 5) {
                const state = cells[idx.state].textContent.trim();
                const durationText = cells[idx.duration].textContent.trim();
                const duration = parseTimeToSeconds(durationText);
                const agentName = cells[idx.agent].textContent.trim();

                let effectiveDuration = duration;
                let effectiveDurationText = durationText;

                // ===== DOUBLE-CHECK - Compare Duration vs dedicated time column =====
                // Double-check: System
                if (state === 'System' && idx.outageTime !== -1) {
                    const outageTimeText = cells[idx.outageTime].textContent.trim();
                    const outageSeconds = parseTimeToSeconds(outageTimeText);
                    if (outageSeconds > effectiveDuration) {
                        effectiveDuration = outageSeconds;
                        effectiveDurationText = outageTimeText;
                    }
                    debugLog(`${agentName} System - Duration: ${durationText} (${duration}s) | Outage Time: ${outageTimeText} (${outageSeconds}s) | Using: ${effectiveDurationText}`);
                }
// Double-check: Break
                if (state === 'Break' && idx.breakTime !== -1) {
                    const breakTimeText = cells[idx.breakTime].textContent.trim();
                    const breakSeconds = parseTimeToSeconds(breakTimeText);
                    if (breakSeconds > effectiveDuration) {
                        effectiveDuration = breakSeconds;
                        effectiveDurationText = breakTimeText;
                    }
                    debugLog(`${agentName} Break - Duration: ${durationText} (${duration}s) | Break Time: ${breakTimeText} (${breakSeconds}s) | Using: ${effectiveDurationText}`);
                }
// Double-check: Break2
                if (state === 'Break2' && idx.break2Time !== -1) {
                    const break2TimeText = cells[idx.break2Time].textContent.trim();
                    const break2Seconds = parseTimeToSeconds(break2TimeText);
                    if (break2Seconds > effectiveDuration) {
                        effectiveDuration = break2Seconds;
                        effectiveDurationText = break2TimeText;
                    }
                    debugLog(`${agentName} Break2 - Duration: ${durationText} (${duration}s) | Break2 Time: ${break2TimeText} (${break2Seconds}s) | Using: ${effectiveDurationText}`);
                }

  // Double-check: Break3
                if (state === 'Break3' && idx.break3Time !== -1) {
                    const break3TimeText = cells[idx.break3Time].textContent.trim();
                    const break3Seconds = parseTimeToSeconds(break3TimeText);
                    if (break3Seconds > effectiveDuration) {
                        effectiveDuration = break3Seconds;
                        effectiveDurationText = break3TimeText;
                    }
                    debugLog(`${agentName} Break3 - Duration: ${durationText} (${duration}s) | Break3 Time: ${break3TimeText} (${break3Seconds}s) | Using: ${effectiveDurationText}`);
                }
// Double-check: Lunch
                if (state === 'Lunch' && idx.lunchTime !== -1) {
                    const lunchTimeText = cells[idx.lunchTime].textContent.trim();
                    const lunchSeconds = parseTimeToSeconds(lunchTimeText);
                    if (lunchSeconds > effectiveDuration) {
                        effectiveDuration = lunchSeconds;
                        effectiveDurationText = lunchTimeText;
                    }
                    debugLog(`${agentName} Lunch - Duration: ${durationText} (${duration}s) | Lunch Time: ${lunchTimeText} (${lunchSeconds}s) | Using: ${effectiveDurationText}`);
                }

                if (state === 'Personal' && idx.personalTime !== -1) {
                    const personalTimeText = cells[idx.personalTime].textContent.trim();
                    const personalSeconds = parseTimeToSeconds(personalTimeText);
                    if (personalSeconds > effectiveDuration) {
                        effectiveDuration = personalSeconds;
                        effectiveDurationText = personalTimeText;
                    }
                    debugLog(`${agentName} Personal - Duration: ${durationText} (${duration}s) | Personal Time: ${personalTimeText} (${personalSeconds}s) | Using: ${effectiveDurationText}`);
                }

                // ===== CHECK THRESHOLD VIOLATION (PWD logic for Break/Break2) =====
                const effectiveThreshold = (state === 'Break' || state === 'Break2') ? getBreakThreshold(agentName) : AUX_THRESHOLDS[state];
                if (effectiveThreshold !== undefined && effectiveDuration > effectiveThreshold) {
                    const shouldAutoOffline = AUTO_OFFLINE_STATES.includes(state);

                    if (state === 'On Contact') {
                        currentOnContactViolations.add(agentName);
                    }

                    let missedContactsValue = 0;
                    if (idx.missedContacts !== -1) {
                        missedContactsValue = parseInt(cells[idx.missedContacts].textContent.trim()) || 0;
                    }

                    allAlerts.push({
                        agent: agentName, team: cells[idx.team].textContent.trim(),
                        state, profile: cells[idx.profile].textContent.trim(),
                        duration: effectiveDurationText, threshold: formatSeconds(effectiveThreshold),
                        action: shouldAutoOffline ? 'pending' : 'N/A',
                        missedContacts: missedContactsValue
                    });

                    if (shouldAutoOffline) {
                        stateChangeQueue.push({
                            agentName, state, duration: effectiveDurationText,
                            team: cells[idx.team].textContent.trim(),
                            alertIndex: allAlerts.length - 1,
                            missedContacts: missedContactsValue
                        });
                    }
                }
            }
        });

        // ===== AUTOCLICK PROCESSING =====

        if (stateChangeQueue.length > 0 && autoClickEnabled) {
            addStatusMessage(`\u{1F525} AutoClick: ${stateChangeQueue.length} agent(s) - Sequential mode...`);

            for (let i = 0; i < stateChangeQueue.length; i++) {
                const item = stateChangeQueue[i];

                if (i > 0) {
                    addStatusMessage(`\u{23F3} Waiting before next agent (${i + 1}/${stateChangeQueue.length})...`);
                    await delay(3500);
                }

                await checkAndResumeSession();

                const freshCell = findAgentStateCell(item.agentName);
                if (!freshCell) {
                    allAlerts[item.alertIndex].action = '\u{274C} Not found';
                    sessionCounters.totalFailed++;
                    continue;
                }

                // ===== MISSED CONDITIONAL LOGIC =====
                if (item.state === 'Missed') {
                    if (item.missedContacts >= 2) {
                        const success = await changeAgentStateToOffline(freshCell, item.agentName);
                        allAlerts[item.alertIndex].action = success ? `\u{2705} Offline (Missed: ${item.missedContacts})` : '\u{274C} Failed';
                        if (success) {
                            offlineAlerts.push(allAlerts[item.alertIndex]);
                            logDisconnection(item.agentName, item.state, item.duration, 'Offline', item.team);
                            sessionCounters.totalDisconnected++;
                        } else {
                            sessionCounters.totalFailed++;
                        }
                    } else {
                        const success = await changeAgentStateToAvailable(freshCell, item.agentName);
                        allAlerts[item.alertIndex].action = success ? '\u{1F7E2} Available (Missed: 0)' : '\u{274C} Failed';
                        if (success) {
                            logDisconnection(item.agentName, item.state, item.duration, 'Available', item.team);
                            sessionCounters.totalMovedToAvailable++;
                            availableAlerts.push(allAlerts[item.alertIndex]);
                        } else {
                            sessionCounters.totalFailed++;
                        }
                    }
                } else {
                    const success = await changeAgentStateToOffline(freshCell, item.agentName);
                    allAlerts[item.alertIndex].action = success ? '\u{2705} Offline' : '\u{274C} Failed';
                    if (success) {
                        offlineAlerts.push(allAlerts[item.alertIndex]);
                        logDisconnection(item.agentName, item.state, item.duration, 'Offline', item.team);
                        sessionCounters.totalDisconnected++;
                    } else {
                        sessionCounters.totalFailed++;
                    }
                }
            }
        } else if (stateChangeQueue.length > 0 && !autoClickEnabled) {
            for (const item of stateChangeQueue) allAlerts[item.alertIndex].action = '\u{26A0}\u{FE0F} AutoClick OFF';
            addStatusMessage(`\u{2139}\u{FE0F} ${stateChangeQueue.length} violation(s) - AutoClick OFF`);
        }

        // ===== ON CONTACT ALTERNATING ALERT LOGIC =====
        let filteredAlerts = [];
        let newOnContactAlerted = new Set();

        for (const alert of allAlerts) {
            if (alert.state === 'On Contact') {
                if (previousOnContactAlerted.has(alert.agent)) {
                    debugLog(`On Contact SKIP: ${alert.agent} (alerted last cycle)`);
                    continue;
                } else {
                    newOnContactAlerted.add(alert.agent);
                    filteredAlerts.push(alert);
                    debugLog(`On Contact SEND: ${alert.agent} (not alerted last cycle)`);
                }
            } else {
                filteredAlerts.push(alert);
            }
        }

        previousOnContactAlerted = newOnContactAlerted;
        debugLog('Previous On Contact Alerted updated:', [...previousOnContactAlerted]);

        // SEND managers alert with filtered alerts
        if (filteredAlerts.length > 0) {
            sendManagersAlert(filteredAlerts);
            sessionCounters.totalManagerAlerts++;
            const skipped = allAlerts.length - filteredAlerts.length;
            if (skipped > 0) {
                addStatusMessage(`\u{1F6A8} ${filteredAlerts.length} violation(s) alerted (${skipped} On Contact skipped)`);
            } else {
                addStatusMessage(`\u{1F6A8} ${filteredAlerts.length} violation(s) found`);
            }
        } else if (allAlerts.length > 0) {
            addStatusMessage(`\u{2139}\u{FE0F} ${allAlerts.length} violation(s) - all On Contact skipped (alternating)`);
        } else {
            addStatusMessage('\u{2705} No violations');
        }

        // Send team alerts ONLY when agents were moved to Offline
        if (offlineAlerts.length > 0) {
            const missedOfflineAlerts = offlineAlerts.filter(a => a.state === 'Missed');
            const otherOfflineAlerts = offlineAlerts.filter(a => a.state !== 'Missed');

            if (otherOfflineAlerts.length > 0) {
                sendTeamAlerts(otherOfflineAlerts);
            }
            if (missedOfflineAlerts.length > 0) {
                sendTeamAlertsMissedOffline(missedOfflineAlerts);
            }
            sessionCounters.totalTeamAlerts++;
            addStatusMessage(`\u{1F4E4} Team alerts: ${offlineAlerts.length} agent(s)`);
        }

        // Send team alerts when agents were moved to Available (1st Missed)
        if (availableAlerts.length > 0) {
            sendTeamAlertsAvailable(availableAlerts);
            addStatusMessage(`\u{1F4E4} Team Available alerts: ${availableAlerts.length} agent(s)`);
        }
    }


    // ===== WEBHOOK ALERTS =====

    function sendManagersAlert(alerts) {
        const byOM = {};
        const noOM = [];

        alerts.forEach(alert => {
            const tm = (alert.team || '').trim().toLowerCase();
            const om = TM_TO_OM[tm];
            if (om) {
                if (!byOM[om]) byOM[om] = [];
                byOM[om].push(alert);
            } else {
                noOM.push(alert);
            }
        });

        for (const [om, omAlerts] of Object.entries(byOM)) {
            const url = MANAGERS_WEBHOOKS[om];
            if (!url) continue;

            const tableHeader = `**Alertas de Duración AUX** - ${new Date().toLocaleTimeString()} (Bot: ${BOT_OPERATOR})\n\n@All Members\nSe detectó uso elevado de AUX o Missed Contact en los siguientes CSAs. Por favor asegúrense de monitorear los AUXs de cerca y que ningún CSA esté en AUXs no programados.\n\n| Agent | Team | State | Duration | Threshold | Action |\n|-------|------|-------|----------|-----------|--------|`;

            const tableRows = omAlerts.map(alert => {
                const agentClean = alert.agent.replace(/@amazon.*$/i, '').trim();
                return `| ${agentClean} | ${alert.team} | ${alert.state} | ${alert.duration} | ${alert.threshold} | ${alert.action} |`;
            }).join('\n');

            GM_xmlhttpRequest({
                method: 'POST', url, headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ Content: `/md\n${tableHeader}\n${tableRows}` }),
                onload: (r) => { if (r.status >= 200 && r.status < 300) addStatusMessage(`\u{1F4E4} Manager [${om}] alert sent`); else addStatusMessage(`\u{274C} Manager [${om}] HTTP ${r.status}`); },
                onerror: () => { addStatusMessage(`\u{274C} Manager [${om}] alert error`); }
            });
        }

        if (noOM.length > 0) {
            const fallbackUrl = MANAGERS_WEBHOOKS['drvamzn'];
            const tableHeader = `**Alertas de Duración AUX (Sin OM asignado)** - ${new Date().toLocaleTimeString()}\n\n| Agent | Team | State | Duration | Threshold | Action |\n|-------|------|-------|----------|-----------|--------|`;
            const tableRows = noOM.map(alert => {
                const agentClean = alert.agent.replace(/@amazon.*$/i, '').trim();
                return `| ${agentClean} | ${alert.team} | ${alert.state} | ${alert.duration} | ${alert.threshold} | ${alert.action} |`;
            }).join('\n');

            GM_xmlhttpRequest({
                method: 'POST', url: fallbackUrl, headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ Content: `/md\n${tableHeader}\n${tableRows}` }),
                onload: (r) => { addStatusMessage(r.status < 300 ? '\u{1F4E4} Unassigned alerts sent (fallback)' : `\u{274C} Fallback HTTP ${r.status}`); },
                onerror: () => { addStatusMessage('\u{274C} Fallback alert error'); }
            });
        }
    }

    // ===== TEAM ALERTS FOR AUX -> OFFLINE =====

    function sendTeamAlerts(alerts) {
        const byTeam = {};
        alerts.forEach(a => {
            const t = a.team.toLowerCase().trim();
            if (!byTeam[t]) byTeam[t] = [];
            byTeam[t].push(a);
        });

        for (const [team, teamAlerts] of Object.entries(byTeam)) {
            const url = TEAM_WEBHOOKS[team];
            if (!url) {
                addStatusMessage(`\u{26A0}\u{FE0F} No webhook for team: "${team}"`);
                continue;
            }
            const clean = teamAlerts.map(a => ({ ...a, name: a.agent.replace(/@amazon.*$/i, '').trim() }));
            const mentions = clean.map(a => `@${a.name}`).join('\n');
            const header = `${mentions}
**Alerta:** Fuiste movido a **Offline** por uso elevado de AUX. Si estás en estado **'Available'**, verifica que tu próximo estado se mantenga en **'Available'**.

| Agent | State | Duration |
|-------|-------|----------|`;
            const rows = clean.map(a => `| ${a.name} | ${a.state} | ${a.duration} |`).join('\n');

            GM_xmlhttpRequest({
                method: 'POST', url, headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ Content: `/md
${header}
${rows}` }),
                onload: (r) => {
                    if (r.status >= 200 && r.status < 300) addStatusMessage(`\u{1F4E4} Team [${team}] alert sent OK`);
                    else addStatusMessage(`\u{274C} Team [${team}] HTTP ${r.status}`);
                },
                onerror: () => { addStatusMessage(`\u{274C} Team [${team}] network error`); }
            });
        }
    }
    // ===== TEAM ALERTS FOR MISSED -> OFFLINE =====

    function sendTeamAlertsMissedOffline(alerts) {
        const byTeam = {};
        alerts.forEach(a => {
            const t = a.team.toLowerCase().trim();
            if (!byTeam[t]) byTeam[t] = [];
            byTeam[t].push(a);
        });

        for (const [team, teamAlerts] of Object.entries(byTeam)) {
            const url = TEAM_WEBHOOKS[team];
            if (!url) continue;
            const clean = teamAlerts.map(a => ({ ...a, name: a.agent.replace(/@amazon.*$/i, '').trim() }));
            const mentions = clean.map(a => `@${a.name}`).join('\n');
            const header = `${mentions}\n**Alerta:** Fuiste movido a **Offline** por Missed Contacts. Por favor ve a **Available**, si estás teniendo problemas contacta a tu **Team Manager**.\n\n| Agent | State | Missed Contacts | Duration |\n|-------|-------|--------------------|----------|`;
            const rows = clean.map(a => `| ${a.name} | ${a.state} | ${a.missedContacts} | ${a.duration} |`).join('\n');

            GM_xmlhttpRequest({
                method: 'POST', url, headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ Content: `/md\n${header}\n${rows}` }),
                onload: (r) => {
                    if (r.status >= 200 && r.status < 300) addStatusMessage(`\u{1F4E4} Team [${team}] Missed->Offline alert sent`);
                    else addStatusMessage(`\u{274C} Team [${team}] Missed->Offline HTTP ${r.status}`);
                },
                onerror: () => { addStatusMessage(`\u{274C} Team [${team}] Missed->Offline network error`); }
            });
        }
    }

    // ===== TEAM ALERTS FOR MISSED -> AVAILABLE =====

    function sendTeamAlertsAvailable(alerts) {
        const byTeam = {};
        alerts.forEach(a => {
            const t = a.team.toLowerCase().trim();
            if (!byTeam[t]) byTeam[t] = [];
            byTeam[t].push(a);
        });

        for (const [team, teamAlerts] of Object.entries(byTeam)) {
            const url = TEAM_WEBHOOKS[team];
            if (!url) continue;
            const clean = teamAlerts.map(a => ({ ...a, name: a.agent.replace(/@amazon.*$/i, '').trim() }));
            const mentions = clean.map(a => `@${a.name}`).join('\n');
            const header = `${mentions}\n**Alerta:** Fuiste movido a **Available** por un Missed Contact. Asegúrate de estar listo para tomar contactos. Si vuelves a fallar, serás movido a **Offline**.\n\n| Agent | State | Duration |\n|-------|-------|----------|`;
            const rows = clean.map(a => `| ${a.name} | ${a.state} | ${a.duration} |`).join('\n');

            GM_xmlhttpRequest({
                method: 'POST', url, headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ Content: `/md\n${header}\n${rows}` }),
                onload: (r) => {
                    if (r.status >= 200 && r.status < 300) addStatusMessage(`\u{1F4E4} Team [${team}] Available alert sent`);
                    else addStatusMessage(`\u{274C} Team [${team}] Available HTTP ${r.status}`);
                },
                onerror: () => { addStatusMessage(`\u{274C} Team [${team}] Available network error`); }
            });
        }
    }

    // ===== EVENT LISTENERS =====

    startBtn.addEventListener('click', () => {
        if (!isMonitoring) {
            isMonitoring = true;
            sessionCounters = { totalDisconnected: 0, totalMovedToAvailable: 0, totalFailed: 0, totalManagerAlerts: 0, totalTeamAlerts: 0 };
            disconnectionLog = [];
            previousOnContactAlerted = new Set();
            addStatusMessage('\u{25B6}\u{FE0F} Monitoring started');
            monitoringCycle();
            startBtn.disabled = true;
            pauseBtn.disabled = false;
        }
    });

    pauseBtn.addEventListener('click', () => {
        if (isMonitoring) {
            isMonitoring = false;
            if (monitoringTimeout) { clearTimeout(monitoringTimeout); monitoringTimeout = null; }
            addStatusMessage('\u{23F8}\u{FE0F} Monitoring paused');
            sendLogToWebhook();
            startBtn.disabled = false;
            pauseBtn.disabled = true;
        }
    });

    pauseBtn.disabled = true;
    addStatusMessage('v0.9.2.5');

})();
