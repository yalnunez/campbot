
// ==UserScript==
// @name         Stores VCSCOL Camp bot by yalnunez
// @namespace    tampermonkey.net/
// @version      0.9.3.4
// @updateURL    https://raw.githubusercontent.com/yalnunez/campbot/main/camp-aux-monitor-stores-vcscol.user.js
// @downloadURL  https://raw.githubusercontent.com/yalnunez/campbot/main/camp-aux-monitor-stores-vcscol.user.js
// @description  VCS COL Camp bot - Monitor CAMP AUX durations, send alerts to OM webhooks by team, auto-change state - Sequential AutoClick (3.5s), System/Break/Break2/Break3/Lunch/Personal double-check via dedicated columns, Missed double-check via Missed Contacts column, On Contact alternating alerts, AWS UI Cloudscape dropdown fix, Post-dropdown agent verification, Multi-OM webhook routing, BOT_OPERATOR prompt, System Issue manual button, Event logs on close/refresh
// @author       @yalnunez
// @match        https://prod-iad.camp.wwcs.amazon.dev/*
// @match        https://prod-fra.camp.wwcs.amazon.dev/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      hooks.chime.aws
// @connect      amazon.sharepoint.com
// @connect      cdn.sheetjs.com
// ==/UserScript==

(function () {
    'use strict';

let BOT_OPERATOR = '';
while (!BOT_OPERATOR) {
    BOT_OPERATOR = (prompt('Enter your login to start the bot:') || '').trim().toLowerCase();
    if (!BOT_OPERATOR) {
        alert('You must enter your login to use the bot.');
    }
}


// ===== SHAREPOINT CONFIG =====
var SHAREPOINT_SITE = 'amazon.sharepoint.com';
var SHAREPOINT_SITE_PATH = '/sites/Yalnunez';
var EXCEL_DIRECT_URL = 'https://amazon.sharepoint.com/:x:/r/sites/SDSColombia/_layouts/15/Doc.aspx?sourcedoc=%7BC7BB19DD-35B8-493E-9DD8-285DFDDC8B82%7D&file=Stores%20Heimdall%20Webhook%20Config.xlsx&action=default&mobileredirect=true';
var EXCEL_DOWNLOAD_URL = 'https://amazon.sharepoint.com/sites/SDSColombia/_api/web/GetFileByServerRelativeUrl(\'/sites/SDSColombia/Shared%20Documents/Heimdall%20Bot%20(Camp%20Bot)/Stores%20Heimdall%20Webhook%20Config.xlsx\')/$value';

// ===== DYNAMIC WEBHOOK VARIABLES =====
var MANAGERS_WEBHOOKS = {};
var TM_TO_OM = {};
var TEAM_WEBHOOKS = {};
var MOVEMENTS_WEBHOOK = '';
var LOG_WEBHOOK_URL = '';
var webhooksLoaded = false;
var lastWebhookLoad = 0;
var WEBHOOK_CACHE_DURATION = 30 * 60 * 1000;

// ===== LOAD FROM SHAREPOINT (API v1.0 + SheetJS) =====
function loadWebhooksFromSharePoint() {
    return new Promise(function(resolve, reject) {
        console.log('[Heimdall] 📡 Cargando webhooks desde SharePoint...');

        // Paso 1: Cargar la librería SheetJS si no está cargada
        if (typeof XLSX === 'undefined') {
            console.log('[Heimdall] 📦 Cargando librería SheetJS...');
            var script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
            script.onload = function() {
                console.log('[Heimdall] ✅ SheetJS cargada');
                downloadAndParseExcel(resolve, reject);
            };
            script.onerror = function() {
                console.error('[Heimdall] ❌ No se pudo cargar SheetJS');
                reject('SHEETJS_LOAD_ERROR');
            };
            document.head.appendChild(script);
        } else {
            downloadAndParseExcel(resolve, reject);
        }
    });
}

function downloadAndParseExcel(resolve, reject) {
    GM_xmlhttpRequest({
        method: 'GET',
        url: EXCEL_DOWNLOAD_URL,
        responseType: 'arraybuffer',
        headers: {
            'Accept': 'application/octet-stream'
        },
        onload: function(response) {
            try {
                if (response.status === 200) {
                    console.log('[Heimdall] 📥 Excel descargado, parseando...');

                    // Parsear el Excel con SheetJS
                    var data = new Uint8Array(response.response);
                    var workbook = XLSX.read(data, { type: 'array' });

                    // Buscar la hoja Webhook_Config
                    var sheetName = 'Webhook_Config';
                    if (!workbook.SheetNames.includes(sheetName)) {
                        // Si no existe, usar la primera hoja
                        sheetName = workbook.SheetNames[0];
                        console.warn('[Heimdall] ⚠️ Hoja "Webhook_Config" no encontrada. Usando: ' + sheetName);
                    }

                    var sheet = workbook.Sheets[sheetName];
                    var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                    parseWebhookData(rows);
                    webhooksLoaded = true;
                    lastWebhookLoad = Date.now();
                    console.log('[Heimdall] ✅ Webhooks cargados desde SharePoint');
                    console.log('[Heimdall]    Managers: ' + Object.keys(MANAGERS_WEBHOOKS).length);
                    console.log('[Heimdall]    TM→OM: ' + Object.keys(TM_TO_OM).length);
                    console.log('[Heimdall]    Team webhooks: ' + Object.keys(TEAM_WEBHOOKS).length);
                    resolve(true);

                } else if (response.status === 401 || response.status === 403) {
                    console.warn('[Heimdall] ⚠️ No autenticado en SharePoint. Abre el Excel en otra pestaña.');
                    reject('AUTH_REQUIRED');
                } else {
                    console.error('[Heimdall] ❌ Error HTTP ' + response.status);
                    reject('HTTP_' + response.status);
                }
            } catch (e) {
                console.error('[Heimdall] ❌ Error parseando Excel:', e);
                reject('PARSE_ERROR');
            }
        },
        onerror: function(error) {
            console.error('[Heimdall] ❌ Error de conexión:', error);
            reject('CONNECTION_ERROR');
        }
    });
}

// ===== PARSER (igual que antes) =====
function parseWebhookData(rows) {
    MANAGERS_WEBHOOKS = {};
    TM_TO_OM = {};
    TEAM_WEBHOOKS = {};
    MOVEMENTS_WEBHOOK = '';
    LOG_WEBHOOK_URL = '';
    var currentSection = null;

    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var cellA = (row[0] || '').toString().trim();
        var cellB = (row[1] || '').toString().trim();
        var cellC = (row[2] || '').toString().trim();

        if (cellA === 'MANAGERS WEBHOOKS') { currentSection = 'MANAGERS'; continue; }
        if (cellA === 'TM TO OM MAPPING') { currentSection = 'TM_TO_OM'; continue; }
        if (cellA === 'TEAM WEBHOOKS') { currentSection = 'TEAM_WEBHOOKS'; continue; }
        if (cellA === 'SPECIAL WEBHOOKS') { currentSection = 'SPECIAL'; continue; }

        if (!cellA || cellA === 'Manager (OM)' || cellA === 'Team Member (TM)' ||
            cellA === 'Team Member' || cellA === 'Webhook Name' || cellA.indexOf('⚠️') === 0) {
            continue;
        }

        switch (currentSection) {
            case 'MANAGERS':
                if (cellA && cellB && cellB.indexOf('https://') === 0) {
                    MANAGERS_WEBHOOKS[cellA.toLowerCase()] = cellB;
                }
                break;
            case 'TM_TO_OM':
                if (cellA && cellB) {
                    TM_TO_OM[cellA.toLowerCase()] = cellB.toLowerCase();
                }
                break;
            case 'TEAM_WEBHOOKS':
                if (cellA && cellC && cellC.indexOf('https://') === 0) {
                    TEAM_WEBHOOKS[cellA.toLowerCase()] = cellC;
                    if (cellB && !TM_TO_OM[cellA.toLowerCase()]) {
                        TM_TO_OM[cellA.toLowerCase()] = cellB.toLowerCase();
                    }
                }
                break;
            case 'SPECIAL':
                if (cellA === 'MOVEMENTS_WEBHOOK' && cellC) { MOVEMENTS_WEBHOOK = cellC; }
                if (cellA === 'LOG_WEBHOOK_URL' && cellC) { LOG_WEBHOOK_URL = cellC; }
                break;
        }
    }

    GM_setValue('cached_MANAGERS_WEBHOOKS', JSON.stringify(MANAGERS_WEBHOOKS));
    GM_setValue('cached_TM_TO_OM', JSON.stringify(TM_TO_OM));
    GM_setValue('cached_TEAM_WEBHOOKS', JSON.stringify(TEAM_WEBHOOKS));
    GM_setValue('cached_MOVEMENTS_WEBHOOK', MOVEMENTS_WEBHOOK);
    GM_setValue('cached_LOG_WEBHOOK_URL', LOG_WEBHOOK_URL);
    GM_setValue('cached_timestamp', Date.now());
    console.log('[Heimdall] 💾 Webhooks guardados en cache local');
}

// ===== FALLBACK: CACHE LOCAL =====
function loadWebhooksFromCache() {
    try {
        MANAGERS_WEBHOOKS = JSON.parse(GM_getValue('cached_MANAGERS_WEBHOOKS', '{}'));
        TM_TO_OM = JSON.parse(GM_getValue('cached_TM_TO_OM', '{}'));
        TEAM_WEBHOOKS = JSON.parse(GM_getValue('cached_TEAM_WEBHOOKS', '{}'));
        MOVEMENTS_WEBHOOK = GM_getValue('cached_MOVEMENTS_WEBHOOK', '');
        LOG_WEBHOOK_URL = GM_getValue('cached_LOG_WEBHOOK_URL', '');

        var hasData = Object.keys(MANAGERS_WEBHOOKS).length > 0 &&
                      Object.keys(TM_TO_OM).length > 0 &&
                      Object.keys(TEAM_WEBHOOKS).length > 0;
        if (hasData) {
            webhooksLoaded = true;
            console.log('[Heimdall] 📦 Webhooks cargados desde cache local');
            return true;
        }
        return false;
    } catch (e) {
        console.error('[Heimdall] ❌ Error cargando cache:', e);
        return false;
    }
}

// ===== INICIALIZACIÓN =====
function initializeWebhooks() {
    if (webhooksLoaded && (Date.now() - lastWebhookLoad) < WEBHOOK_CACHE_DURATION) {
        return Promise.resolve(true);
    }
    return loadWebhooksFromSharePoint().catch(function(error) {
        console.warn('[Heimdall] ⚠️ Falló SharePoint (' + error + '). Intentando cache...');
        if (loadWebhooksFromCache()) { return true; }
        console.error('[Heimdall] ❌ No hay webhooks disponibles.');
        return false;
    });
}

function refreshWebhooks() {
    lastWebhookLoad = 0;
    return initializeWebhooks();
}

function getManagerWebhook(teamName) {
    var tm = teamName.trim().toLowerCase();
    var om = TM_TO_OM[tm];
    return om ? MANAGERS_WEBHOOKS[om] : null;
}
function writeMovementToExcel(agentLogin, fromState, toState, action, team, duration) {
    if (!webhooksLoaded) {
        debugLog('⚠️ Webhooks not loaded, skipping movement log');
        return;
    }

    var now = new Date();
    var colombiaOffset = -5 * 60;
    var localOffset = now.getTimezoneOffset();
    var colombiaTime = new Date(now.getTime() + (localOffset + colombiaOffset) * 60000);

    var dateStr = colombiaTime.getFullYear() + '-' +
                  String(colombiaTime.getMonth() + 1).padStart(2, '0') + '-' +
                  String(colombiaTime.getDate()).padStart(2, '0');

    var hours = colombiaTime.getHours();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    var timeStr = String(hours).padStart(2, '0') + ':' +
                  String(colombiaTime.getMinutes()).padStart(2, '0') + ':' +
                  String(colombiaTime.getSeconds()).padStart(2, '0') + ' ' + ampm;

    var om = TM_TO_OM[(team || '').trim().toLowerCase()] || 'N/A';

    GM_xmlhttpRequest({
        method: 'POST',
        url: 'https://amazon.sharepoint.com/sites/Yalnunez/_api/contextinfo',
        headers: { 'Accept': 'application/json;odata=verbose' },
        onload: function(digestResp) {
            try {
                if (digestResp.status !== 200) {
                    console.error('[Heimdall] ❌ Failed to get digest: HTTP ' + digestResp.status);
                    return;
                }
                var digestData = JSON.parse(digestResp.responseText);
                var digest = digestData.d.GetContextWebInformation.FormDigestValue;

                GM_xmlhttpRequest({
                    method: 'POST',
                    url: "https://amazon.sharepoint.com/sites/Yalnunez/_api/web/lists/getbytitle('Stores_Heimdall_Movements_Log')/items",
                    headers: {
                        'Content-Type': 'application/json;odata=verbose',
                        'Accept': 'application/json;odata=verbose',
                        'X-RequestDigest': digest
                    },
                    data: JSON.stringify({
                        '__metadata': { 'type': 'SP.Data.Stores_x005f_Heimdall_x005f_Movements_x005f_LogListItem' },
                        'Title': dateStr,
                        'Time': timeStr,
                        'Agent': agentLogin,
                        'Team': team || 'N/A',
                        'OM': om,
                        'From': fromState,
                        'To': toState,
                        'Duration': duration || 'N/A',
                        'Action': action,
                        'BotOperator': BOT_OPERATOR
                    }),
                    onload: function(response) {
                        if (response.status >= 200 && response.status < 300) {
                            debugLog('📊 SP List log: ' + agentLogin + ' ' + fromState + ' → ' + toState);
                        } else {
                            console.error('[Heimdall] ❌ SP List write HTTP ' + response.status, response.responseText ? response.responseText.substring(0, 500) : '');
                        }
                    },
                    onerror: function() { console.error('[Heimdall] ❌ SP List write network error'); }
                });
            } catch (e) { console.error('[Heimdall] ❌ Error getting digest:', e); }
        },
        onerror: function() { console.error('[Heimdall] ❌ Digest request network error'); }
    });
}
// ===== CARGAR WEBHOOKS (sin bloquear el UI) =====
initializeWebhooks().then(function(ready) {
    if (ready) {
        console.log('[Heimdall] ✅ Webhooks listos');
    } else {
        console.warn('[Heimdall] ⚠️ Webhooks no disponibles');
        alert('⚠️ Heimdall: No se pudieron cargar los webhooks.\nAbre el Excel en SharePoint y recarga CAMP.\n\n' + EXCEL_DIRECT_URL);
    }
});
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



    // ===== MANUAL STATE CHANGE - INPUT + DROPDOWN + BUTTON =====
    const manualContainer = document.createElement('div');
    manualContainer.style.cssText = `display: flex; flex-direction: column; gap: 4px; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 8px; margin-top: 4px;`;

    const manualInput = document.createElement('input');
    manualInput.type = 'text';
    manualInput.placeholder = 'Agent login...';
    manualInput.style.cssText = `padding: 6px 10px; border-radius: 4px; border: 1px solid #ccc; font-size: 12px; color: #333;`;

    const stateSelect = document.createElement('select');
    stateSelect.style.cssText = `padding: 6px 10px; border-radius: 4px; border: 1px solid #ccc; font-size: 12px; color: #333; background: white;`;
    const optSystem = document.createElement('option');
    optSystem.value = 'System';
    optSystem.textContent = 'System Issue';
    const optOffline = document.createElement('option');
    optOffline.value = 'Offline';
    optOffline.textContent = 'Offline';
    stateSelect.appendChild(optSystem);
    stateSelect.appendChild(optOffline);

    const manualBtn = document.createElement('button');
    manualBtn.style.cssText = `padding: 8px 15px; cursor: pointer; background: #ff8c00; color: white; border: 2px solid white; border-radius: 4px; font-weight: bold; font-size: 11px;`;
    manualBtn.textContent = 'Change State';
    manualBtn.addEventListener('click', async () => {
        const login = manualInput.value.trim().toLowerCase();
        const targetState = stateSelect.value;
        if (!login) {
            addStatusMessage('\u{26A0}\u{FE0F} Enter an agent login first');
            return;
        }

        // ===== DISCONNECT ALL AGENTS =====
        if (login === BOT_OPERATOR.trim().toLowerCase()) {
            addStatusMessage('\u{1F6A8} Disconnecting ALL agents to Offline...');

            const table = findRelevantTable();
            if (!table) { addStatusMessage('\u{274C} Table not found'); return; }

            const idx = findColumnIndexes(table);
            const rows = table.querySelectorAll('tbody tr');
            let movedCount = 0;
            let failedCount = 0;

            for (const row of rows) {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 5) {
                    const agentText = cells[idx.agent].textContent.trim();
                    const agentLogin = agentText.replace(/@amazon.*$/i, '').trim().toLowerCase();
                    const currentState = cells[idx.state].textContent.trim();

                    // Skip si ya está Offline o si es el operador
                    if (currentState === 'Offline' || agentLogin === BOT_OPERATOR.trim().toLowerCase()) continue;

                    addStatusMessage(`\u{2699}\u{FE0F} Moving ${agentLogin} to Offline...`);
                    const targetCell = cells[idx.state];
                    const success = await openDropdownAndSelectState(targetCell, agentText, 'Offline');

                    if (success) {
                        movedCount++;
                        logDisconnection(agentLogin, 'Offline', currentState, 'Disconnect All', BOT_OPERATOR);
                        sendMovementLog(agentLogin, currentState, 'Offline', 'Disconnect All', BOT_OPERATOR);
                        addStatusMessage(`\u{2705} ${agentLogin} \u{2192} Offline`);
                    } else {
                        failedCount++;
                        addStatusMessage(`\u{274C} Failed: ${agentLogin}`);
                    }

                    // Esperar 3.5s entre cada agente
                    await new Promise(resolve => setTimeout(resolve, 3500));
                }
            }

            addStatusMessage(`\u{1F6A8} Disconnect All complete: ${movedCount} moved, ${failedCount} failed`);
            manualInput.value = '';

            // Enviar alerta al OM
            const operatorOM = TM_TO_OM[BOT_OPERATOR.trim().toLowerCase()];
            const alertUrl = operatorOM ? MANAGERS_WEBHOOKS[operatorOM] : MOVEMENTS_WEBHOOK;

            GM_xmlhttpRequest({
                method: 'POST',
                url: alertUrl,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    Content: `/md\n\u{1F6A8} **Disconnect All Ejecutado**\n\n**${BOT_OPERATOR}** desconectó a **${movedCount} agentes** a Offline.\nFallidos: ${failedCount}\n\nHora: ${new Date().toLocaleTimeString()}`
                }),
                onload: (r) => { addStatusMessage(r.status < 300 ? `\u{1F4E4} Disconnect All alert sent` : `\u{274C} Alert HTTP ${r.status}`); },
                onerror: () => { addStatusMessage('\u{274C} Disconnect All alert failed'); }
            });
            return;
        }

        // ===== SINGLE AGENT STATE CHANGE (lógica normal) =====
        addStatusMessage(`\u{2699}\u{FE0F} Searching for ${login}...`);

        const table = findRelevantTable();
        if (!table) { addStatusMessage('\u{274C} Table not found'); return; }

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
            addStatusMessage(`\u{274C} Agent "${login}" not found in table`);
            return;
        }

        addStatusMessage(`\u{2699}\u{FE0F} Moving ${login} to ${targetState}...`);
        const success = await openDropdownAndSelectState(targetCell, agentFullName, targetState);
        if (success) {
            addStatusMessage(`\u{2705} ${login} \u{2192} ${targetState}`);
            logDisconnection(login, targetState, 'Manual', targetState, BOT_OPERATOR);
            sendMovementLog(login, 'Manual', targetState, 'Manual Change', BOT_OPERATOR);
            manualInput.value = '';

            // Enviar alerta al OM del operador
            const operatorOM = TM_TO_OM[BOT_OPERATOR.trim().toLowerCase()];
            const alertUrl = operatorOM ? MANAGERS_WEBHOOKS[operatorOM] : MOVEMENTS_WEBHOOK;

            GM_xmlhttpRequest({
                method: 'POST',
                url: alertUrl,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    Content: `/md\n\u{2699}\u{FE0F} **Cambio Manual de Estado**\n\n**${BOT_OPERATOR}** movió a **${login}** a estado **${targetState}** manualmente.\n\nHora: ${new Date().toLocaleTimeString()}`
                }),
                onload: (r) => { addStatusMessage(r.status < 300 ? `\u{1F4E4} Manual change alert sent [${operatorOM || 'fallback'}]` : `\u{274C} Alert HTTP ${r.status}`); },
                onerror: () => { addStatusMessage('\u{274C} Manual change alert failed'); }
            });
        } else {
            addStatusMessage(`\u{274C} Failed to move ${login} to ${targetState}`);
        }
    });

    manualContainer.appendChild(manualInput);
    manualContainer.appendChild(stateSelect);
    manualContainer.appendChild(manualBtn);
    controls.appendChild(manualContainer);

    const statusDisplay = document.createElement('div');
    statusDisplay.style.cssText = `flex-grow: 1; overflow-y: auto; font-size: 11px; line-height: 1.4; border-top: 1px solid rgba(255,255,255,0.3); padding-top: 10px; margin-top: 10px;`;

    banner.appendChild(controls);
    banner.appendChild(statusDisplay);
    document.body.insertBefore(banner, document.body.firstChild);

    const rootDiv = document.querySelector('#root');
    if (rootDiv) rootDiv.style.marginLeft = '280px';
    const navbar = document.querySelector('#navbar');
    if (navbar) navbar.style.marginLeft = '280px';


    // ╔══════════════════════════════════════════════════════════════╗
    // ║              AUX THRESHOLDS CONFIGURATION                    ║
    // ║  Defines max allowed duration (in seconds) per AUX state.   ║
    // ║  If an agent exceeds the threshold, the bot takes action.   ║
    // ╚══════════════════════════════════════════════════════════════╝

    const AUX_THRESHOLDS = {
        'Available': 10800,//3:00:00 — Alert only (no disconnect)
        'Meeting': 10800,// 3:00:00 — Alert only (no disconnect)
        'Training': 10800,// 3:00:00 — Alert only (no disconnect)
        'Project': 10800,// 3:00:00 — Alert only (no disconnect)
        'Missed': 60,// 0:01:00 — Disconnect to Offline (2+) or Available (<2)
        'Email': 90,// 0:01:30 — Disconnect to Offline
        'Break': 915,// 0:15:15 — Disconnect to Offline
        'Break2': 915,// 0:15:15 — Disconnect to Offline
        'Break3': 615,// 0:10:15 — Immediate disconnect (any duration)
        'Personal': 375,// 0:06:15 — Disconnect to Offline
        'Lunch': 3615,// 1:00:15 — Disconnect to Offline
        'System': 600,// 0:10:00 — Disconnect to Offline
        'On Contact': 1800,// 0:30:00 — Alert only (no disconnect)
        'UpcomingOffline': 60// 0:01:00 — Disconnect to Offline
    };
    // ╔══════════════════════════════════════════════════════════════╗
    // ║           OPERATION HOURS — Auto-Disconnect Outside Hours    ║
    // ╚══════════════════════════════════════════════════════════════╝

    const OPERATION_HOURS = {
        startHour: 1,// 01:00
        startMinute: 0,
        endHour: 23,// 23:00
        endMinute: 0,
        graceMinutes: 5// 5 min gracia → activo de 00:55 a 23:05
    };

   function isOutsideOperationHours() {
        const now = new Date();
        // Convertir a hora Colombia (UTC-5)
        const colombiaOffset = -5 * 60;
        const localOffset = now.getTimezoneOffset();
        const colombiaTime = new Date(now.getTime() + (localOffset + colombiaOffset) * 60000);

        const hours = colombiaTime.getHours();
        const minutes = colombiaTime.getMinutes();
        const currentTotalMinutes = hours * 60 + minutes;

        // Límite inferior: 02:55 (startHour - graceMinutes)
        const lowerLimit = (OPERATION_HOURS.startHour * 60 + OPERATION_HOURS.startMinute) - OPERATION_HOURS.graceMinutes;
        // Límite superior: 23:05 (endHour + graceMinutes)
        const upperLimit = (OPERATION_HOURS.endHour * 60 + OPERATION_HOURS.endMinute) + OPERATION_HOURS.graceMinutes;

        // Fuera de operación si es ANTES de 02:55 O DESPUÉS de 23:05
        return (currentTotalMinutes < lowerLimit || currentTotalMinutes > upperLimit);
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║              PWD AGENTS — Extended Break                     ║
    // ║  Agents with disability accommodation get 20:15 (1215s)     ║
    // ║  for Break and Break2 instead of the standard 15:15 (915s). ║
    // ╚══════════════════════════════════════════════════════════════╝

    const PWD_AGENTS = [
        'angielkr',
        'anartayl',
        'bgupaola',
        'dianmqui',
        'diarizap',
        'duqqcarl',
        'edgmerca',
        'juaegome',
        'kristiqc',
        'maribcud',
        'mazohert',
        'navasfrg',
        'ninoserf',
        'obrecarv',
        'paulaasi',
        'rmerceds',
        'roalvarz',
        'tarijudi'
        // Add more PWD logins here
    ];
    const PWD_BREAK_THRESHOLD = 1215; // 20:15


    function getBreakThreshold(agentName, state) {
        const login = agentName.replace(/@amazon.*$/i, '').trim().toLowerCase();

        // 1. Check ACCOMMODATION first (custom per Break/Break2)
        if (ACCOMMODATION_AGENTS.includes(login)) {
            if (state === 'Break') return ACCOMMODATION_BREAK1_THRESHOLD;// 10:15
            if (state === 'Break2') return ACCOMMODATION_BREAK2_THRESHOLD;// 30:15
        }

        // 2. Check PWD (same extended threshold for both breaks)
        if (PWD_AGENTS.includes(login)) return PWD_BREAK_THRESHOLD; // 20:15

        // 3. Default threshold
        return AUX_THRESHOLDS.Break; // 15:15
    }

    // ╔══════════════════════════════════════════════════════════════╗
    // ║     ACCOMMODATION AGENTS — Custom Break Thresholds          ║
    // ║  These agents have special accommodation:                   ║
    // ║  Break1 = 10:15 (615s) instead of 15:15 (915s)             ║
    // ║  Break2 = 30:15 (1815s) instead of 15:15 (915s)            ║
    // ╚══════════════════════════════════════════════════════════════╝

    const ACCOMMODATION_AGENTS = [
        'kevcsti',
        'ylopezar'
        // Add more accommodation logins here
    ];
    const ACCOMMODATION_BREAK1_THRESHOLD = 615;// 10:15
    const ACCOMMODATION_BREAK2_THRESHOLD = 1815;// 30:15

    // ╔══════════════════════════════════════════════════════════════╗
    // ║           NEW HIRE AGENTS — Extended On Contact              ║
    // ║  New hires get 60:00 (3600s) for On Contact alerts instead  ║
    // ║  of the standard 30:00 (1800s). Alert only, no disconnect.  ║
    // ╚══════════════════════════════════════════════════════════════╝

      const NEW_HIRE_TMS = [
        'camargis',
        'claraaqu',
        'cruizher',
        'florezhi',
        'gonzylau',
        'jcaldani',
        'llandine',
        'luribesa',
        'robayotl',
        'sandreac',
        'rdrkat',
        'svilaura'
        // Agregar o quitar TMs según sea necesario
    ];
    const NEW_HIRE_ON_CONTACT_THRESHOLD = 3600; // 60:00

    // ╔══════════════════════════════════════════════════════════════╗
    // ║           EMAIL EXTENDED TMs — No Disconnect on Email        ║
    // ║  Para estos TMs, el estado Email NO desconecta al agente.   ║
    // ║  En su lugar, solo se notifica al OM cuando el agente       ║
    // ║  supera los 30 minutos (1800s) en Email.                    ║
    // ║  El bot lee la columna "Team" para determinar si aplica.    ║
    // ╚══════════════════════════════════════════════════════════════╝

    const EMAIL_EXTENDED_TMS = [
        'brayandv',
        'elsbolan',
        'jonleoj',
        'jugarzo',
        'jumurcia',
        'lauracrc',
        'leipaula',
        'romecin',
        'valgarzo'
        // Agregar o quitar TMs según sea necesario
    ];
    const EMAIL_EXTENDED_THRESHOLD = 1800; // 30:00 — Solo alerta, no desconecta


    // ╔══════════════════════════════════════════════════════════════╗
    // ║           AUTO-OFFLINE STATES                                ║
    // ║  States where the bot will automatically disconnect agents   ║
    // ║  to Offline when threshold is exceeded (via AutoClick).      ║
    // ║  States NOT listed here are alert-only (no state change).   ║
    // ╚══════════════════════════════════════════════════════════════╝

    const AUTO_OFFLINE_STATES = ['Missed', 'Break', 'Break2', 'Break3', 'Personal', 'Lunch', 'System', 'Email', 'UpcomingOffline'];

    // ╔══════════════════════════════════════════════════════════════╗
    // ║     NO DISCONNECT AGENTS — Alert Only, No Auto-Offline      ║
    // ║  These agents will NOT be moved to Offline automatically    ║
    // ║  in any AUTO_OFFLINE_STATE. The bot will only send the      ║
    // ║  alert to the OM when the threshold is exceeded.            ║
    // ╚══════════════════════════════════════════════════════════════╝

    const NO_DISCONNECT_AGENTS = [
        'calvotga',
        'kevcsti',
        'solacind',
        'ylopezar',
        'zssegura'
        // Add more logins here as needed
    ];


    // ╔══════════════════════════════════════════════════════════════╗
    // ║           SESSION VARIABLES                                  ║
    // ╚══════════════════════════════════════════════════════════════╝

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
            addStatusMessage('\u26A0\uFE0F Session could not be resumed, retrying in 30s...');
            monitoringTimeout = setTimeout(monitoringCycle, 30000);
            return;
        }

        addStatusMessage('\uD83D\uDD01 === Cycle start ===');

        // ===== AUTO-DISCONNECT OUTSIDE OPERATION HOURS =====
        if (isOutsideOperationHours()) {
            addStatusMessage('⛔ FUERA DE HORARIO OPERATIVO - Desconectando todos los agentes...');

            const table = findRelevantTable();
            if (table) {
                const idx = findColumnIndexes(table);
                const rows = table.querySelectorAll('tbody tr');
                let movedCount = 0;
                let failedCount = 0;

                for (const row of rows) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 5) {
                        const agentText = cells[idx.agent].textContent.trim();
                        const agentLogin = agentText.replace(/@amazon.*$/i, '').trim().toLowerCase();
                        const currentState = cells[idx.state].textContent.trim();

                        // Skip si ya está Offline
                        if (currentState === 'Offline') continue;

                        addStatusMessage(`⏳ Moving ${agentLogin} to Offline (fuera de horario)...`);
                        const stateCell = cells[idx.state];
                        const success = await openDropdownAndSelectState(stateCell, agentText, 'Offline');

                        if (success) {
                            movedCount++;
                            const teamName = cells[idx.team].textContent.trim();
                            logDisconnection(agentLogin, 'Offline', currentState, 'Outside Hours', teamName);
                            sendMovementLog(agentLogin, currentState, 'Offline', 'Outside Operation Hours', teamName);
                            addStatusMessage(`✅ ${agentLogin} → Offline`);
                        } else {
                            failedCount++;
                            addStatusMessage(`❌ Failed: ${agentLogin}`);
                        }

                        // Esperar 3.5s entre cada agente
                        await delay(3500);
                    }
                }

                addStatusMessage(`⛔ Fuera de horario: ${movedCount} desconectados, ${failedCount} fallidos`);
            } else {
                addStatusMessage('⚠️ Table not found (outside hours check)');
            }

            addStatusMessage('⏳ Next cycle in 60s...');
            monitoringTimeout = setTimeout(monitoringCycle, 60000);
            return;
        }

        // ===== CHECK REFRESH STOPPED =====
        const refreshStoppedEl = document.querySelector('div.awsui_child_18582_66aol_97 a.awsui_disabled_vjswe_10957_198');
        const refreshStoppedByText = refreshStoppedEl && refreshStoppedEl.textContent.trim().includes('Refresh Stopped');
        const isRefreshStopped = refreshStoppedEl && refreshStoppedByText;
        if (isRefreshStopped) {
            addStatusMessage('\uD83D\uDEA8 CAMP Refresh Stopped detected!');

            const operatorOM = TM_TO_OM[BOT_OPERATOR.trim().toLowerCase()];
            const refreshUrl = operatorOM ? MANAGERS_WEBHOOKS[operatorOM] : LOG_WEBHOOK_URL;

            GM_xmlhttpRequest({
                method: 'POST',
                url: refreshUrl,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({
                    Content: `/md\n\u26A0\uFE0F **Problema de Conexión CAMP Detectado** (Bot: ${BOT_OPERATOR})\n\n@All Members\nCAMP está mostrando **"Refresh Stopped"** — la tabla de métricas NO se está actualizando.\n\nPor favor revisen la sesión de CAMP y refresquen si es necesario.\n\nHora: ${new Date().toLocaleTimeString()}`
                }),
                onload: (r) => { addStatusMessage(r.status < 300 ? `\uD83D\uDCE4 Refresh Stopped alert sent [${operatorOM || 'fallback'}]` : '\u274C Alert HTTP ' + r.status); },
                onerror: () => { addStatusMessage('\u274C Refresh Stopped alert failed'); }
            });
            addStatusMessage('\u23F3 Next cycle in 60s...');
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
            addStatusMessage(`\u274C Error: ${error.message}`);
        }

        await delay(3000);
        if (!isMonitoring) return;
        clickCampPlayButton();

        if (!isMonitoring) return;
        addStatusMessage('\u23F3 Next cycle in 60s...');
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

                // ===== CHECK THRESHOLD VIOLATION (PWD/Accommodatios for Break/Break2, New Hires for On Contact) =====
                let effectiveThreshold;
                if (state === 'Break' || state === 'Break2') {
                    effectiveThreshold = getBreakThreshold(agentName, state);
                } else if (state === 'On Contact') {
                    // Verificar si el TM del agente está en la lista de new hires
                    const teamCheck = cells[idx.team].textContent.trim().toLowerCase();
                    effectiveThreshold = NEW_HIRE_TMS.includes(teamCheck) ? NEW_HIRE_ON_CONTACT_THRESHOLD : AUX_THRESHOLDS['On Contact'];
                } else if (state === 'Email') {
                    // Verificar si el TM del agente está en la lista de Email extendido
                    const teamCheckEmail = cells[idx.team].textContent.trim().toLowerCase();
                    if (EMAIL_EXTENDED_TMS.includes(teamCheckEmail)) {
                        // TM en la lista: threshold de 30 min, solo alerta (no desconecta)
                        effectiveThreshold = EMAIL_EXTENDED_THRESHOLD;
                    } else {
                        // TM normal: threshold estándar de 1:30, desconecta a Offline
                        effectiveThreshold = AUX_THRESHOLDS['Email'];
                    }
                } else {
                    effectiveThreshold = AUX_THRESHOLDS[state];
                }
                if (effectiveThreshold !== undefined && effectiveDuration > effectiveThreshold) {
                    // Para Email: si el TM está en EMAIL_EXTENDED_TMS, NO desconectar (solo alertar)
                    let shouldAutoOffline = AUTO_OFFLINE_STATES.includes(state);

                    // Check NO_DISCONNECT_AGENTS — never auto-offline, only alert
                    const loginCheckDisconnect = agentName.replace(/@amazon.*$/i, '').trim().toLowerCase();
                    if (NO_DISCONNECT_AGENTS.includes(loginCheckDisconnect)) {
                        shouldAutoOffline = false;
                    }

                    // Check EMAIL_EXTENDED_TMS — no auto-offline for Email state
                    if (state === 'Email') {
                        const teamCheckOffline = cells[idx.team].textContent.trim().toLowerCase();
                        if (EMAIL_EXTENDED_TMS.includes(teamCheckOffline)) {
                            shouldAutoOffline = false;
                        }
                    }



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
                            sendMovementLog(item.agentName, 'Missed', 'Offline', 'Missed 2+', item.team, item.duration);

                            sessionCounters.totalDisconnected++;
                        } else {
                            sessionCounters.totalFailed++;
                        }
                    } else {
                        const success = await changeAgentStateToAvailable(freshCell, item.agentName);
                        allAlerts[item.alertIndex].action = success ? '\u{1F7E2} Available (Missed: 0)' : '\u{274C} Failed';
                        if (success) {
                            logDisconnection(item.agentName, item.state, item.duration, 'Available', item.team);
                            sendMovementLog(item.agentName, 'Missed', 'Available', 'Missed <2', item.team, item.duration);

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
                        sendMovementLog(item.agentName, item.state, 'Offline', 'AUX Threshold', item.team, item.duration);

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
            const fallbackUrl = MOVEMENTS_WEBHOOK;
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

       // ===== MOVEMENTS WEBHOOK (Manual + Automatic) =====
    function sendMovementLog(agentLogin, fromState, toState, action, team, duration) {
        const time = new Date().toLocaleTimeString();
        const table = `| Agent | Team | From | To | Duration | Action | Time |
|-------|------|------|----|----------|--------|------|
| ${agentLogin} | ${team || 'N/A'} | ${fromState} | ${toState} | ${duration || 'N/A'} | ${action} | ${time} |`;

        GM_xmlhttpRequest({
            method: 'POST',
            url: MOVEMENTS_WEBHOOK,
            headers: { 'Content-Type': 'application/json' },
            data: JSON.stringify({ Content: `/md
${table}` }),
            onload: (r) => { if (r.status >= 300) addStatusMessage(`\u{274C} Movement log HTTP ${r.status}`); },
            onerror: () => { addStatusMessage('\u{274C} Movement log failed'); }
        });
        // LÍNEA NUEVA — escribe en la SharePoint List
    writeMovementToExcel(agentLogin, fromState, toState, action, team, duration);
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
    addStatusMessage('v0.9.3.4 Developed by yalnunez');

})();
