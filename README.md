
# VCS COL Camp Bot

Tampermonkey automation bot that monitors agent state time in CAMP, executes autoclick to change states, and sends notifications to associates and managers. Reduces problematic state time by 63.2%, recovering 12.8 productive hours per week for the team. Developed by Yalnunez.

## Features

- **Real-time AUX Monitoring** — Tracks agent states (Break, Break2, Break3, Lunch, Personal, System, Missed, On Contact) against predefined thresholds
- **Sequential AutoClick** — Automatically changes agent states to Offline or Available with 3.5s intervals between actions
- **Smart Missed Contact Logic** — 2+ missed contacts → Offline | 1 missed contact → Available (with warning)
- **Double-Check System** — Validates duration against dedicated time columns (Outage Time, Break Time, Break2 Time, Break3 Time, Lunch Time, Personal Time)
- **On Contact Alternating Alerts** — Avoids redundant notifications by alternating alerts each cycle
- **Post-Dropdown Agent Verification** — Confirms the correct agent before executing state changes
- **Anti-Throttle Technology** — Uses Web Workers to bypass browser background tab throttling
- **Session Auto-Resume** — Detects and resumes inactive CAMP sessions automatically
- **Multi-OM Webhook Routing** — Routes manager alerts to the correct OM based on TM_TO_OM mapping
- **BOT_OPERATOR Prompt** — Identifies who is running the bot via login prompt at startup
- **System Issue Manual Button** — Allows manual state change to System Issue via agent login input
- **Event Logs on Close/Refresh** — Sends detailed session reports when the browser tab is closed or refreshed (beforeunload + pagehide + unload)
- **Session Reports** — Tracks disconnections with Team column, state changes, and sends detailed event logs via webhook

## AUX Thresholds

| State | Threshold | Action |
|-------|-----------|--------|
| Break | 15:15 | Offline |
| Break2 | 15:15 | Offline |
| Break3 | 10:00 | Offline |
| Lunch | 60:15 | Offline |
| Personal | 6:15 | Offline |
| System | 1:00 | Offline |
| Missed | 1:00 | Offline (2+) / Available (1) |
| On Contact | 25:00 | Alert only |

## Multi-OM Alert Routing

Alerts are routed to the correct Operations Manager based on the Team column in CAMP:

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) in your browser
2. Open the raw file: [vcs-col-camp-bot.user.js](https://raw.githubusercontent.com/yalnunez/vcscampbot/main/vcs-col-camp-bot.user.js)
3. Tampermonkey will prompt you to install — click **Install**
4. Navigate to CAMP Metrics — the bot will ask for your login via prompt

## Auto-Update

This script updates automatically via Tampermonkey. Make sure your settings have:
- **Check Interval:** Every Day (or more frequent)
- **Automatic Installation:** Enabled

## UI Controls

The bot adds a left sidebar panel (280px) with:
- **Start Monitoring** — Begins the monitoring cycle
- **Pause Monitoring** — Stops monitoring and sends session report
- **AutoClick ON/OFF** — Enables/disables automatic state changes
- **Debug ON/OFF** — Enables verbose console logging
- **⚙️ Move to System Issue** — Input field + button to manually move an agent to System state

## Compatibility

- Amazon CAMP Metrics (prod-iad & prod-fra)
- AWS UI Cloudscape dropdown fix included
- React-compatible event handlers
- Works across Chrome, Edge, Mozilla, and Safari

## Author

**Yalnunez** — VCS Colombia Team

