# App Store privacy answers

The answers to App Store Connect's **App Privacy** questionnaire, derived from
what the app transmits as recorded in [play-data-safety.md](play-data-safety.md).
That sheet traces each kind of data to the code that sends it; this one maps the
same facts onto Apple's data types, so the two stores describe the app the same
way. A change that invalidates one invalidates both.

The answers about _what_ the app sends hold for any build of this app. The
privacy policy URL and the purposes are this deployment's; anyone publishing
their own build should check them against their own policy.

## Overall

| Question                                                        | Answer                                  |
| --------------------------------------------------------------- | --------------------------------------- |
| Privacy Policy URL                                              | `https://padiushbio.com/privacidad`     |
| Do you or your third-party partners collect data from this app? | **Yes**                                 |
| Is any data used to track users?                                | **No** — no advertising, no data broker |

Every type below is **linked to the user's identity** (each request carries a
per-device token bound to the account) and **not used for tracking**. The only
purpose that applies is **App Functionality**: none is used for analytics,
advertising, marketing or product personalisation. There is no analytics,
advertising or crash-reporting SDK in the app.

## Data types collected

| Apple data type                     | Why — what actually sends it                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contact Info → Email Address        | Sign-in posts `email` to `/tokens` ([types.ts](../src/api/types.ts) `TokenRequest`).                                                               |
| Identifiers → User ID               | Every request carries the per-device bearer token, which identifies the account.                                                                   |
| Location → Precise Location         | GPS coordinates on an interview or a field record, at full precision.                                                                              |
| User Content → Photos or Videos     | Photographs attached to an interview or a field record, uploaded through presigned URLs.                                                           |
| User Content → Audio Data           | Interview recordings and voice notes on field records, through the same upload path.                                                               |
| User Content → Other User Content   | Interview answers and field-record details: free text and choices defined by the researcher's form ([types.ts](../src/api/types.ts) `AnswerPush`). |
| Health & Fitness → Health           | Interviews on medicinal plant use can record an interviewee's ailments and the remedies for them. See below.                                       |
| Diagnostics → Other Diagnostic Data | The integrity events in [diagnostics.ts](../src/diagnostics.ts): a code from a closed list of four, with the app and OS versions.                  |

Only precise location is declared: the app asks for location while in use and
sends the coordinates as the device reports them, so approximate location is
not a separate collection.

### Health

Apple's Health type covers "health-related human subject research or any other
user provided health or medical data". Nothing in the app asks for health
information, but a researcher's form can, and ethnobotanical interviews about
medicinal plants commonly do. It is declared so that the label is true for
every study the app can carry, as Google Play's Health and fitness → Health
info is.

## Data types not collected

- **Name.** The device name sent at sign-in is `Device.deviceName`, which on
  iOS 16 and later is the generic "iPhone" unless the app holds the
  user-assigned device name entitlement, which it does not. Account names are
  entered on the web platform, not in the app. Google Play declares Name,
  because on Android the device name is whatever its owner set, which may be
  their own name.
- **Device ID.** The token is issued by the server, not read from the device.
- **Financial info, contacts, browsing and search history, purchases, usage
  data, crash data, performance data, sensitive info, other data.** Nothing in
  the app collects them.

The password is not a data type Apple lists. The app never stores it: it is
posted once to `/tokens` and exchanged for a token held in the system keychain
([tokens.ts](../src/api/tokens.ts)).

Interview content may describe other people, such as the interviewees. It is
declared under User Content and Health, which the researcher's form defines;
whoever leads a study answers for consent (privacy policy §2).

## What would invalidate these answers

The same as for the Play sheet: any third-party SDK (which may add tracking or
a third-party purpose), a free-text field on the diagnostics channel, or
server-side transcription with a third-party transcriber. A form-driven change
needs no update, since answers are declared as user content regardless of what
they ask.
