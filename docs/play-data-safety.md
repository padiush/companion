# Google Play Data safety — answer sheet

What to enter in Play Console → **App content → Data safety**, derived from what
this app actually transmits rather than from what it plausibly might. Every row
below is traceable to code; the "why" column names the file so a future change
can be checked against it.

Re-read this whenever a dependency starts sending something, and especially
before adding any third-party SDK — the "Shared: No" column below is the part
most easily invalidated by accident.

## The three overall questions

| Question                                                              | Answer                                      | Why                                                                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Does your app collect or share any of the required user data types?   | **Yes**                                     | Interviews, audio, photos and location all leave the device on sync.                                                                          |
| Is all of the user data collected by your app encrypted in transit?   | **Yes**                                     | The production build targets `https://padiushbio.com/api/v1` ([eas.json](../eas.json)); media go to object storage over presigned HTTPS URLs. |
| Do you provide a way for users to request that their data be deleted? | **Yes** — `https://padiushbio.com/contacto` | Privacy policy §11: projects are self-serve, whole-account deletion is on request, answered within 30 days.                                   |

**Shared is "No" for every row.** Play does not count a service provider
processing data on your instructions as sharing, and AWS is the only party
involved. This is the direct payoff of building the diagnostics channel instead
of adopting a crash-reporting vendor — a vendor would have made this "Yes".

## Data types

All rows are **linked to the user** (everything is tied to an authenticated
account) and **none is processed ephemerally** (it is all stored).

| Play data type                              | Collected          | Required? | Purposes                              | Why — what actually sends it                                                                                |
| ------------------------------------------- | ------------------ | --------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Personal info → Email address               | Yes                | Required  | Account management, App functionality | Sign-in posts `email` to `/tokens` ([types.ts](../src/api/types.ts) `TokenRequest`).                        |
| Personal info → User IDs                    | Yes                | Required  | Account management, App functionality | Every request carries a per-device bearer token bound to the account.                                       |
| Personal info → Name                        | **See decision 2** | —         | —                                     | `device_name` at sign-in is `Device.deviceName` ([deviceName.ts](../src/auth/deviceName.ts)).               |
| Location → Approximate location             | Yes                | Optional  | App functionality                     | `ACCESS_COARSE_LOCATION`; sent as `location` on an instance.                                                |
| Location → Precise location                 | Yes                | Optional  | App functionality                     | `ACCESS_FINE_LOCATION`; interviews save fine without it, so optional.                                       |
| Photos and videos → Photos                  | Yes                | Optional  | App functionality                     | Attached to an interview, uploaded via presigned URL.                                                       |
| Audio files → Voice or sound recordings     | Yes                | Optional  | App functionality                     | Interview recordings, same upload path.                                                                     |
| App activity → Other user-generated content | Yes                | Required  | App functionality                     | Interview answers — free text the researcher's form defines ([types.ts](../src/api/types.ts) `AnswerPush`). |
| App info and performance → Diagnostics      | Yes                | Required  | App functionality                     | The integrity events in [diagnostics.ts](../src/diagnostics.ts) — four codes, no payload.                   |
| Health and fitness → Health info            | **See decision 1** | —         | —                                     | Nothing in the app collects this; whether a form does is a study-design question.                           |

**Not collected:** financial info, contacts, calendar, SMS, call logs, installed
apps, search history, advertising IDs, purchase history. There is no analytics
SDK, no ad SDK, and no crash-reporting SDK in this app.

The password is not listed because Play has no data type for it and the app
never stores it — it is posted once to `/tokens` and exchanged for a token held
in the system keychain ([tokens.ts](../src/api/tokens.ts)).

## Two decisions that are not mine to make

### 1. Health info — the one with real consequences

Ethnobotanical interviews about medicinal plant use can record an informant's
ailments and the remedies used for them. Nothing in this app asks for that; a
researcher's form might.

Play's category is "information about an individual's health, such as medical
records or symptoms" and does not carve out third parties. If your forms can
capture that, declare it. Under-declaring is the failure Play enforces against
hardest, and re-declaring later is cheap next to an enforcement action.

Worth noting the answers are already declared as user-generated content, so
adding this row costs nothing except accuracy.

### 2. The device name probably contains a person's name

`deviceName()` returns `Device.deviceName`, which on iOS is conventionally
"_<First name>_'s iPhone". So a real name usually reaches the server at sign-in.

Two problems, one form and one factual:

- On the form, either declare **Personal info → Name** as collected, or stop
  sending it.
- In the privacy policy, §3 says "the name you give a device". Nobody gives it —
  the app reads it from the OS. That sentence is inaccurate as written.

The cleanest fix makes both go away: use `Device.modelName` only, so the token
is labelled "iPhone 15" rather than someone's name. It costs a little
recognisability on the web's device list. Alternatively, ask the user to name
their device at sign-in, which would make the policy true as written.

## What would invalidate this sheet

- **Any third-party SDK.** Adding one likely flips Shared to Yes and adds a
  recipient to privacy policy §6. That is a _substantial_ change under §13 —
  30 days' notice once you have users.
- **A new diagnostic code** does not change anything here; a free-text field on
  that channel would change everything.
- **Server-side transcription** (privacy policy §8 says it is off) would add
  processing of the recordings, and a third-party transcriber would add a
  recipient.
