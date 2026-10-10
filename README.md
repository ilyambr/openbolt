# OpenBolt

OpenBolt is a fast, free, and 100% open-source Edgenuity companion script and automation tool for students. It provides AutoAdvance, WebAudio background keep-alive, an offline answer database, and an AI-powered question solver.

Written from scratch to deliver a secure, transparent community alternative to legacy scripts, OpenBolt contains no telemetry, no tracking, no paywalls, no remote killswitches, and zero code obfuscation.

---

## Acknowledgments & Inspiration

OpenBolt was inspired by the original EdgeBolt script. It was rebuilt from the ground up as a clean-room, open-source community alternative to provide students with a reliable, unrestricted userscript for coursework management.

---

## Key Features

- **AutoAdvance**: Automatically progresses through instruction slides, video lectures, and completed activities as soon as they finish.
- **Background Mode (Anti-Throttle)**: Prevents browser tab throttling and pauses when running in background tabs using WebAudio oscillator keep-alive.
- **Offline Answer Database**: Instant local lookups for over 393,000+ question and choice elements with O(1) matching.
- **AI Solver Fallback**: Integrated support for free high-speed LLM APIs (Groq, Cerebras, OpenRouter) to solve questions and complete assignments in real time.
- **AutoExam & AutoAssignment**: Automatically handles quiz and exam attempts, answers questions, and submits assessments upon completion.
- **AutoInteractive**: Solves interactive activities and simulation widgets via direct internal frame APIs.
- **AutoVocab**: Automatically fills and completes vocabulary definitions and activities.
- **AutoGuessing**: Guesses through non-graded diagnostic sections and automatically submits informational or advisor slides.
- **AutoLanguage & AntiSpeaking**: Bypasses language sound blockers and speech recording prompts.
- **Score Range Randomizer**: Configurable target score ranges (e.g., 80% to 100%) to keep completed grades natural and realistic.
- **AutoHide**: Blurs personal student identification information for privacy and screen sharing.
- **Modern Floating HUD**: Draggable, minimizable dark-mode control panel with customizable per-action delay settings.

---

## Installation & Setup

OpenBolt runs as a userscript in any modern browser:

1. Install a userscript manager such as **Tampermonkey** or **Violentmonkey** in your browser (Chrome, Firefox, Edge, Brave, Opera).
2. Open [`openbolt.standalone.user.js`](./openbolt.standalone.user.js) (or [`openbolt.user.js`](./openbolt.user.js)).
3. Copy and paste the entire file into a **New Script** inside your userscript manager.
4. Save (`Ctrl + S`) and navigate to your Edgenuity dashboard (`student.edgenuity.com`).

---

## Loading the Answer Database

The database indexes over 393,000 question IDs and 3,400+ direct answers in clean JSON format, hosted in the dedicated [**OpenBolt Answer Database Repository**](https://github.com/ilyambr/openbolt-database):

You can load the database using either method:

### Option A: Automatic Download (Recommended)
On first launch, OpenBolt automatically downloads the database parts in the background from the repository and caches them in your browser's local IndexedDB. All subsequent page loads will retrieve answers instantly without freezing or reloading.

### Option B: Manual Import
1. Download [`edgenuity_db.json`](https://raw.githubusercontent.com/ilyambr/openbolt-database/main/edgenuity_db.json) directly from the database repository.
2. In the OpenBolt floating HUD, click the **Import DB** button to load your local database file.

---

## Setting up AI Solving (Optional)

If a question is not found in the offline database, OpenBolt can automatically solve it using free AI models:

1. Obtain a free API key from [Groq](https://console.groq.com/keys) or [Cerebras](https://cloud.cerebras.ai/).
2. Paste the key into the **API Key** field in the HUD (or use the one-click **Auto-Grab** buttons) and click **Save Key**.
3. Toggle on **AI Solver Fallback**.

---

## Frequently Asked Questions (FAQ)

### What is OpenBolt?
OpenBolt is a community-driven Edgenuity userscript designed to automate course progression (AutoAdvance), provide answer lookups, prevent background tab pausing, and assist students with their coursework.

### How does OpenBolt differ from EdgeBolt?
While inspired by EdgeBolt, OpenBolt is an open-source, clean-room reimplementation. It does not contain obfuscated code, telemetry trackers, licensing servers, or hidden backdoors.

### Does OpenBolt support EdgeEx?
No. OpenBolt does not support EdgeEx. It is designed strictly for the classic `student.edgenuity.com` platform.

### Is OpenBolt free?
Yes. OpenBolt is completely free and licensed under the MIT License.

### Which userscript managers are supported?
OpenBolt is tested on Tampermonkey and Violentmonkey on all Chromium browsers (Chrome, Edge, Brave, Opera) and Mozilla Firefox.

---

## Notes & Limitations

- **No EdgeEx support**: OpenBolt does not support EdgeEx (Edgenuity's newer platform redesign). It operates only on standard `student.edgenuity.com` courses.

---

## License

This project is licensed under the [MIT License](./LICENSE).
