# Installing the mobile app on phones

Every way to get CareerPilot onto an Android phone or an iPhone, from a test file today to the stores later.
Builds run on Expo's EAS Build service under the Expo account `career-pilot` (project `@career-pilot/careerpilot`,
ID in `config/defaults/mobile.yaml`). Build profiles live in `apps/mobile/eas.json`. Run every `eas` command from
`apps/mobile` with `npx -y eas-cli@latest …` (nothing is installed system-wide).

## Where the app gets its data

An installed app talks to the CareerPilot API it was built for:

| Build | API address | Set in |
| --- | --- | --- |
| Test (`preview`) | This laptop over Wi-Fi, for example `http://192.168.0.104:8000` | EAS environment `preview`: `APP_ENV=http`, `CAREERPILOT_API_URL` |
| Store (`production`) | The hosted API over `https://`, for example `https://api.team-sober.com` | EAS environment `production`: `APP_ENV=production`, `CAREERPILOT_API_URL` (see "Hosted API" below) |

`app.config.ts` allows plain `http://` (Android cleartext, iOS ATS exception) only when the build's API address starts
with `http://`, so store builds that point at `https://` stay locked down.

For test builds the phone must be on the same Wi-Fi as the laptop, Docker must be running, and the API must listen on the
network: run `pnpm phone` once after starting Docker (it opens the API to the Wi-Fi and prints the laptop's address).

If the laptop's Wi-Fi address changes, test builds need no rebuild: on the phone, open **Sign in** (or **More** when signed
in) → **Server: … · Change**, type the new address (for example `192.168.0.106`), and tap **Check and save**. The app
checks that CareerPilot answers there before it switches (config `api.allow_server_change`, on only in `config/env/http.yaml`,
so store builds never show it). To change the address new test builds start with:

```sh
npx -y eas-cli@latest env:update --variable-environment preview --variable-name CAREERPILOT_API_URL --value http://NEW-ADDRESS:8000 --non-interactive
npx -y eas-cli@latest build -p android --profile preview --non-interactive --no-wait
```

A fixed address for the laptop (a DHCP reservation in the Wi-Fi router) avoids rebuilding.

## Hosted API (works from any network)

After the server is deployed ([deploy-oracle.md](deploy-oracle.md), [deploy-aws.md](deploy-aws.md)), builds should point at `https://api.<domain>`. Both profiles in `apps/mobile/eas.json` already read their settings from the EAS environment of the same name, so no file changes are needed. Set the variables once (replace `<domain>`; run from `apps/mobile`; this does not start a build):

```sh
npx -y eas-cli@latest env:create --environment production --name APP_ENV --value production --visibility plaintext --non-interactive
npx -y eas-cli@latest env:create --environment production --name CAREERPILOT_API_URL --value https://api.<domain> --visibility plaintext --non-interactive
```

For an installable test file that uses the hosted server instead of the laptop, change the `preview` environment the same way (`env:update --variable-environment preview --variable-name APP_ENV --value production`, and the same for `CAREERPILOT_API_URL`), then build with `--profile preview`. Switch back to `APP_ENV=http` and a laptop address for laptop testing.

What changes in the app when the address is `https://`:

- `app.config.ts` leaves Android cleartext (`usesCleartextTraffic`) and the iOS App Transport Security exception **off**; they are on only when the address starts with `http://` (laptop test builds).
- `APP_ENV=production` loads `config/env/production.yaml`: **Server: … · Change** is hidden (`api.allow_server_change: false`).
- Check what a build will use with `npx -y eas-cli@latest env:list --environment production`.

The iPhone home-screen app needs no build: open `https://m.<domain>` in Safari → Share → **Add to Home Screen**. The server serves a static web export of the same app with the API address baked in at deploy time.

Expo Go loads the app from a Metro server, so it works from any network only after EAS Update is set up (open task in `specs/E20-deployment-and-remote-access/tasks.md`); on the same Wi-Fi as the laptop, run `CAREERPILOT_API_URL=https://api.<domain> pnpm phone` to point Expo Go at the hosted server.

## Phone notifications (push)

- Firebase project `careerpilot-sober` (free Spark plan), Android app `com.teamsober.careerpilot`, Firebase Cloud Messaging API (V1) enabled.
- `apps/mobile/google-services.json` stays out of git; EAS builds get it from the secret file variable `GOOGLE_SERVICES_JSON` (preview and production).
- The FCM V1 service account key is stored only in Expo: expo.dev → careerpilot → Credentials → Android → FCM V1 service account key. Never put it in the repository.
- The backend sends pushes through Expo's push service (`messaging.push` in `config/defaults/messaging.yaml`). Expo Go on Android cannot receive pushes; use an installed APK.
- iPhone pushes need an Apple push key (Apple Developer account).

## Android: install a file (no store account needed)

1. Build: `npx -y eas-cli@latest build -p android --profile preview --non-interactive --no-wait`.
   EAS keeps the Android signing key (`eas credentials -p android` downloads a backup; never commit it).
2. When the build finishes, open its page on the phone (link printed by the command, or expo.dev → career-pilot →
   careerpilot → Builds) and tap **Install**, or download the `.apk` and copy it to the phone.
3. Android asks to allow installing from this source (Chrome, Files, or your file manager): allow it once, then install.
4. Open CareerPilot. To update later, install a newer `.apk` over it; your sign-in stays.

## iPhone without an Apple Developer account

Apple does not allow installing app files without a paid Apple Developer Program membership. Two ways to use the app today:

- **Home-screen app**: with `pnpm phone` running, open `http://LAPTOP-ADDRESS:8081` in Safari, tap Share → **Add to Home Screen**.
  It opens full screen with the CareerPilot icon (it is the mobile app's web version; files in `apps/mobile/public`).
- **Expo Go**: install Expo Go from the App Store, sign in to Expo Go with the `career-pilot` account, and open
  `exp://LAPTOP-ADDRESS:8081` (or scan the QR code `pnpm phone` prints). This runs the full native app.

## iPhone with an Apple Developer account (test install link)

1. Join the Apple Developer Program ($99 a year) with the Apple ID that will own the app.
2. Register each test iPhone: `npx -y eas-cli@latest device:create`, open the link it shows on the iPhone, install the profile.
3. Build in a normal terminal (it asks for the Apple ID and the two-factor code; nobody else should type them):
   `npx -y eas-cli@latest build -p ios --profile preview`.
4. Open the build's install link on a registered iPhone and tap **Install**. Add a new iPhone later with step 2 and build again.

## App Store (TestFlight) and Google Play

Both need the hosted API first (store users are not on the laptop's Wi-Fi):

1. Host the API over `https://` (the deploy runbooks; Planning/10-AIDLC-Agents.md §4: production releases are the owner's checkpoint).
2. Set the production environment: `env:create --environment production` for `APP_ENV` and `CAREERPILOT_API_URL=https://…` (see "Hosted API" above).
3. iPhone: `npx -y eas-cli@latest build -p ios --profile production`, then `npx -y eas-cli@latest submit -p ios --latest`
   (creates the App Store Connect record on first use). Invite testers in TestFlight; submit for review when ready.
4. Android: create the app in Google Play Console (one-time $25 account, package `com.teamsober.careerpilot`), upload the
   first `.aab` by hand (Google requires it), then create a service-account key, save it as
   `apps/mobile/google-service-account.json` (ignored by git) and use
   `npx -y eas-cli@latest build -p android --profile production` + `npx -y eas-cli@latest submit -p android --latest`
   (goes to the internal testing track; promote it in Play Console).

Store builds number themselves (`appVersionSource: remote`, `autoIncrement`). Store listings need the privacy policy and
data-safety answers (Planning roles: Compliance and Privacy).
