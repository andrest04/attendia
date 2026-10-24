# Spanish / English i18n

Objective: Spanish and English for the client UI and for the JSON error explanations the server returns. Branch: `feat/i18n-es-en`. Delivery: local `--no-ff` merges to `main`, no pull requests (user: "no quiero pr, quiero merges."). Test runner: `npm test -- --watchAll=false`.

## Specs

S1. The application can be shown in Spanish and in English. User: "Quiero i18n en la aplicacion para traduccion español ingles."
S2. Scope is the client UI and the error explanations the server sends as JSON. User choice: "Cliente y servidor" — "La UI del cliente y también las explicaciones de error que el servidor manda en JSON."
S3. The identity suffix is not translated. Constraint accepted with the scope question: "El sufijo [Profesor] no se traduce en ningún corte."
S4. Assumption: Spanish stays the default. A request with no language, or with a language other than English, keeps the current Spanish copy byte for byte.
S5. Assumption: the choice is stored in the browser (`localStorage`), not on the account. It survives a refresh and is sent as `Accept-Language` on API calls.
S6. Assumption: notification titles and messages already stored in Firestore are not JSON error explanations, so this feature does not rewrite them.
S7. When the selected language is English, each known server `explanation` is English. An unknown explanation stays Spanish rather than disappearing.
S8. A language control is reachable before login (header shared with prejoin and the dashboard) and inside the class (teacher and student toolbars).
S9. User: "perfecto dale hasta termina toda la aplicacion el cliente y el servidor dale." Finish remaining client UI and remaining server JSON copy. Stored notification documents are not rewritten (S6); the notification JSON response is localized from `eventType` when `Accept-Language` is English.

## Tasks

- T1 (S1, S4, S5, S8) inline: client locale runtime, language control, `Accept-Language` on API calls. done `5cf6dfc`
- T2 (S2, S4, S7) inline: server localizes `explanation` in `sendError`, English catalog for every current explanation. done `5cf6dfc`
- T3 (S1) inline: login copy follows the selected language. done `5cf6dfc`
- T4 (S1) inline: remaining client UI (prejoin, room chrome, dashboard, dialogs, pages, leftover Twilio settings dialogs). done on `feat/i18n-remaining-ui`. Visible copy goes through `t()`; English catalog covers that copy.
- T5 (S3) inline: confirm `[Profesor]` is not passed through the translator. done `5cf6dfc`
- T6 (S2, S6) inline: server localizes notification titles and messages in the JSON response from `eventType`. Stored Firestore copy stays Spanish. done on `feat/i18n-remaining-ui`.

## Log

L1. 2026-10-23. User: "Quiero i18n en la aplicacion para traduccion español ingles."
L2. 2026-10-23. User chose "Cliente y servidor".
L3. 2026-10-23. Assumption recorded: Spanish default; browser `localStorage` key `attendia-locale`; stored notification copy is out of scope. No new i18n dependency: `t()` reads Spanish source keys so Enzyme shallow tests keep seeing Spanish until the language changes. Server localizes inside `sendError` from `Accept-Language`; missing English keys stay Spanish. Checks: locale, language switch, error catalog completeness, http senders, api client, checkRoomOpen, unload report, login, dashboard header, intro, firebase auth, room buttons and toolbars — all passed.
L4. 2026-10-23. User: "no quiero pr, quiero merges."
L5. 2026-10-24. User: "perfecto dale hasta termina toda la aplicacion el cliente y el servidor dale."
L6. 2026-10-24. User: "y que esperas ?" Remaining client UI wired through `t()`. Server JSON error explanations were already localized. Notification titles already stored in Firestore stay Spanish (S6 / T6).
L7. 2026-10-24. Leftover Twilio settings dialogs, the error dialog, and the avatar crop dialog now go through `t()`. Stored notification documents are still not rewritten.
L8. 2026-10-24. User: "sigue traducien entonces te estroy diciendo que traduzca todo menos Attendia". Remaining visible copy goes through `t()`. The brand Attendia is not translated. The Twilio suffix `[Profesor]` stays the role token.
