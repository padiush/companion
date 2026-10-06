# What this app transmits

An account of every kind of data the companion sends off the device, derived
from what it actually transmits rather than from what it plausibly might. Every
row is traceable to code: the "why" column names the file that sends it, so a
future change can be checked against this document.

It is written in the shape of Google Play's **App content → Data safety**
questionnaire, because that form asks the right questions and the answers have
to be defensible either way. If you publish your own build, this is the sheet to
work from — the answers about _what_ the app sends hold for any deployment, and
the ones naming a server or a privacy policy are this deployment's for you to
replace.

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

| Play data type                              | Collected | Required? | Purposes                              | Why — what actually sends it                                                                                |
| ------------------------------------------- | --------- | --------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Personal info → Email address               | Yes       | Required  | Account management, App functionality | Sign-in posts `email` to `/tokens` ([types.ts](../src/api/types.ts) `TokenRequest`).                        |
| Personal info → User IDs                    | Yes       | Required  | Account management, App functionality | Every request carries a per-device bearer token bound to the account.                                       |
| Personal info → Name                        | Yes       | Required  | Account management, App functionality | `device_name` at sign-in is `Device.deviceName` ([deviceName.ts](../src/auth/deviceName.ts)); see below.    |
| Location → Approximate location             | Yes       | Optional  | App functionality                     | `ACCESS_COARSE_LOCATION`; sent as `location` on an instance.                                                |
| Location → Precise location                 | Yes       | Optional  | App functionality                     | `ACCESS_FINE_LOCATION`; interviews save fine without it, so optional.                                       |
| Photos and videos → Photos                  | Yes       | Optional  | App functionality                     | Attached to an interview or a field record, uploaded via presigned URL.                                     |
| Audio files → Voice or sound recordings     | Yes       | Optional  | App functionality                     | Interview recordings and voice notes on field records, same upload path.                                    |
| App activity → Other user-generated content | Yes       | Required  | App functionality                     | Interview answers — free text the researcher's form defines ([types.ts](../src/api/types.ts) `AnswerPush`). |
| App info and performance → Diagnostics      | Yes       | Required  | App functionality                     | The integrity events in [diagnostics.ts](../src/diagnostics.ts) — four codes, no payload.                   |
| Health and fitness → Health info            | Yes       | Optional  | App functionality                     | Interview answers can record an interviewee's health, when a form asks; see below.                          |

**Not collected:** financial info, contacts, calendar, SMS, call logs, installed
apps, search history, advertising IDs, purchase history. There is no analytics
SDK, no ad SDK, and no crash-reporting SDK in this app.

The password is not listed because Play has no data type for it and the app
never stores it — it is posted once to `/tokens` and exchanged for a token held
in the system keychain ([tokens.ts](../src/api/tokens.ts)).

## Two answers that depend on more than the code

### Health info

Ethnobotanical interviews about medicinal plant use can record an interviewee's
ailments and the remedies used for them. Nothing in this app asks for that, but
a researcher's form can, and Play's category ("information about an
individual's health, such as medical records or symptoms") does not carve out
third parties. It is declared, as optional, because a study need not ask about
health at all. The App Store answers ([app-store-privacy.md](app-store-privacy.md))
declare Health for the same reason.

### Name

`deviceName()` returns `Device.deviceName`. On Android that is the name the
device's owner set, which may be their own, so Name is declared. On iOS 16 and
later it is the generic "iPhone", so the App Store answers leave Name out.
Sending `Device.modelName` alone would keep names off the server entirely, at
the cost of a less recognisable entry in the web's device list.

The privacy policy (§3) describes this as "the name you give a device"; the app
reads it from the system rather than asking for it.

## What would invalidate this sheet

- **Any third-party SDK.** Adding one likely flips Shared to Yes and adds a
  recipient to privacy policy §6. That is a _substantial_ change under §13 —
  30 days' notice once you have users.
- **A new diagnostic code** does not change anything here; a free-text field on
  that channel would change everything.
- **Server-side transcription** (privacy policy §8 says it is off) would add
  processing of the recordings, and a third-party transcriber would add a
  recipient.
