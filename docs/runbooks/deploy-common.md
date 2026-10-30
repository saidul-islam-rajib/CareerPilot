# Deploy CareerPilot to a VM: the steps that are the same everywhere

You get here from [deploy-oracle.md](deploy-oracle.md) or [deploy-aws.md](deploy-aws.md) once you have a fresh **Ubuntu 22.04 or 24.04** server with a public IP address and can log in with SSH. Never open a tunnel to your laptop; the VM is the only thing on the internet.

What you end up with (all on one VM, built on the VM itself, so ARM or x86 does not matter):

| Address | What |
|---|---|
| `https://app.<domain>` | Web app |
| `https://admin.<domain>` | Admin app |
| `https://api.<domain>` | User API (phone apps, web app, Google sign-in callback) |
| `https://admin-api.<domain>` | Admin API |
| `https://m.<domain>` | Phone app as a web page (iPhone home-screen app) |

`<domain>` below is a domain you control, for example `team-sober.com` (the addresses become `app.team-sober.com`, and so on) or a sub-domain such as `careerpilot.team-sober.com`.

## 1. DNS records on Cloudflare

Cloudflare dashboard → your domain → **DNS** → **Records** → **Add record**. Add five **A** records, all pointing to the VM's public IP address:

| Type | Name | IPv4 address | Proxy status |
|---|---|---|---|
| A | `app` | VM IP | **DNS only** (grey cloud) |
| A | `admin` | VM IP | DNS only |
| A | `api` | VM IP | DNS only |
| A | `admin-api` | VM IP | DNS only |
| A | `m` | VM IP | DNS only |

If you use a sub-domain such as `careerpilot.team-sober.com`, the names become `app.careerpilot`, `api.careerpilot`, and so on.

Why grey cloud: the server gets its free HTTPS certificate from Let's Encrypt by answering a challenge on port 80, and that is simplest when Let's Encrypt reaches your server directly. Wait a few minutes, then check from your laptop: `nslookup api.<domain>` must show the VM IP.

Orange cloud (proxied) also works, but only like this: first get the certificates with grey cloud, then switch to orange, then Cloudflare dashboard → **SSL/TLS** → **Overview** → **Full (strict)**. Do not use "Flexible" (it causes redirect loops). Proxying hides the VM's IP and adds Cloudflare's protection; the price is more places to go wrong, and uploads over 100 MB are refused. Phone apps work either way.

## 2. Prepare the server (once)

Log in with the SSH key you chose when creating the VM (`ubuntu` is the default user on Oracle and AWS Ubuntu images):

```bash
ssh -i ~/.ssh/careerpilot_vm ubuntu@VM_IP
```

The project is private, so the server needs a **read-only deploy key** to download it. On the VM:

```bash
sudo apt-get update && sudo apt-get install -y git
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ""
printf 'Host github.com
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
' >> ~/.ssh/config
cat ~/.ssh/github_deploy.pub
```

Copy the printed line into GitHub → the repository → **Settings** → **Deploy keys** → **Add deploy key** (leave "Allow write access" off). Then download the project and run the bootstrap script. It installs Docker, turns on the firewall for ports 22, 80, and 443, adds swap, turns on automatic security updates, and creates a non-root user called `deploy` that gets your SSH key:

```bash
ssh -T git@github.com
git clone git@github.com:saidul-islam-rajib/CareerPilot.git careerpilot
sudo bash careerpilot/scripts/deploy/bootstrap-vm.sh
```

(The first `ssh -T` asks to trust github.com: type `yes`. It then says it cannot give a shell; that is normal.) Hand the project and the deploy key to the new user, then log out:

```bash
sudo mv careerpilot /home/deploy/careerpilot
sudo install -m 600 ~/.ssh/github_deploy ~/.ssh/config /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/careerpilot /home/deploy/.ssh
exit
```

The bootstrap script turns off password and root login, so from now on log in as `deploy` with the same SSH key:

```bash
ssh -i ~/.ssh/careerpilot_vm deploy@VM_IP
cd careerpilot
```

## 3. Fill in `.env` on the server

```bash
cp .env.production.example .env
chmod 600 .env
nano .env
```

Fill in (the file lists every variable; secrets exist only here, never in git):

| Variable | Value |
|---|---|
| `CAREERPILOT_DOMAIN` | your domain, for example `team-sober.com` |
| `CAREERPILOT_ACME_EMAIL` | your email; Let's Encrypt warns you here before a certificate expires |
| `CAREERPILOT_OWNER_EMAIL` | your email; you become the first Super Admin |
| `POSTGRES_PASSWORD`, `CAREERPILOT_APP_DB_PASSWORD` | two different long random passwords |
| `CAREERPILOT_TOKEN_SECRET` | a long random string (at least 32 characters) |
| `ANTHROPIC_API_KEY` | your Claude API key (matching and AI features) |
| `CAREERPILOT_MAIL_USER`, `CAREERPILOT_MAIL_PASSWORD` | Gmail account and App Password, see [email-setup.md](email-setup.md); without them, registration links stay in the server's mail sandbox and nobody receives them |
| `CAREERPILOT_GOOGLE_CLIENT_ID`, `CAREERPILOT_GOOGLE_CLIENT_SECRET`, `CAREERPILOT_VAULT_KEY` | for Gmail and Calendar sync, see section 6; leave empty if you do not use it |

Make random values with `openssl rand -base64 36` (run it once per value). Leave `CAREERPILOT_ACME_CA` and `CAREERPILOT_SITE_PREFIX` empty on a real server.

Tip: while testing, set `CAREERPILOT_ACME_CA=https://acme-staging-v02.api.letsencrypt.org/directory` so a typo in DNS cannot use up Let's Encrypt's weekly limit; the browser then shows a certificate warning. Remove the line and redeploy when it works.

## 4. First deploy

```bash
bash scripts/deploy/deploy.sh
```

The first build takes 15 to 40 minutes (the VM builds every image). It builds, runs the database migrations, starts everything, and finishes with a health check. Check it any time:

```bash
bash scripts/deploy/health-check.sh
docker compose -p careerpilot-prod --env-file .env -f docker-compose.prod.yml ps
```

Open `https://app.<domain>`. The first request to each name takes a few seconds while the certificate is issued. If a name does not load: DNS record missing or still grey/orange wrong, or port 80/443 closed in the cloud firewall (see your provider runbook); `docker compose -p careerpilot-prod --env-file .env -f docker-compose.prod.yml logs caddy` says which.

Turn on the nightly backups right away:

```bash
bash scripts/deploy/install-backup-cron.sh
bash scripts/deploy/backup.sh
```

## 5. Create the first admin

1. Make sure `CAREERPILOT_OWNER_EMAIL` in `.env` is your email and the mail settings above are filled in.
2. Open `https://admin.<domain>`. The owner account is created on first start; an email titled with a link to choose your password goes to `CAREERPILOT_OWNER_EMAIL` (60 minutes by default; the admin app can send a new one).
3. Click the link (it opens `https://admin.<domain>/set-password`), choose a password, and you are in as Super Admin.

If no email arrives (mail not set up yet), read it from the server's mail sandbox through an SSH tunnel; nothing is opened to the internet:

```bash
CAREERPILOT_TOOLS=1 docker compose -p careerpilot-prod --env-file .env -f docker-compose.prod.yml -f docker-compose.prod.tools.yml up -d mailpit
ssh -L 8025:127.0.0.1:8025 deploy@VM_IP
```

Then open http://localhost:8025 on your laptop while the tunnel runs. Same trick for Grafana (`3100`) and Temporal (`8233`, also add `--profile tools`).

## 6. Gmail and Calendar sync: add the callback to the Google OAuth client

In Google Cloud Console → **APIs & Services** → **Credentials** → your OAuth 2.0 Client ID → **Authorized redirect URIs** → **Add URI**:

```text
https://api.<domain>/v1/integrations/google/callback
```

Save. Put the client ID, client secret, and a vault key (`openssl rand -base64 32`) in the server `.env` (the three Google/vault variables), then `bash scripts/deploy/deploy.sh`. Keep the OAuth consent screen's authorised domain set to your domain. Keep the vault key safe: without it, stored Google connections cannot be read after a restore.

## 7. Point the phone apps at the VM

- **Installed Android app (APK):** build once with the production address (see [mobile-release.md](mobile-release.md), "Hosted API"): `https://api.<domain>`. It then works on any network.
- **iPhone home-screen app:** on the iPhone, open `https://m.<domain>` in Safari → **Share** → **Add to Home Screen**. It works on any network.
- **Expo Go:** it still loads the app from a Metro server, so it needs your computer on the same Wi-Fi: `CAREERPILOT_API_URL=https://api.<domain> pnpm phone`. Using Expo Go away from home needs EAS Update, which is not set up yet (see `specs/E20-deployment-and-remote-access/tasks.md`).

## 8. Backups and restore

`install-backup-cron.sh` runs `backup.sh` every night at 02:30 server time. Each run saves two files in `~/careerpilot-backups` (or `CAREERPILOT_BACKUP_DIR`): `careerpilot-db-<time>.dump` (database) and `careerpilot-files-<time>.tgz` (uploaded photos and files), and deletes backups older than `CAREERPILOT_BACKUP_RETENTION_DAYS` (default 14). Copy them off the VM now and then (for example `scp deploy@VM_IP:careerpilot-backups/* ./backups/`), because a backup on the same disk does not survive losing the VM. The vault key and `.env` are not in the backup: store them in a password manager.

Restore (replaces the live data; it asks for `--yes`):

```bash
bash scripts/deploy/restore.sh --yes ~/careerpilot-backups/careerpilot-db-<time>.dump ~/careerpilot-backups/careerpilot-files-<time>.tgz
```

## 9. Updates

On the VM:

```bash
bash scripts/deploy/deploy.sh                 # latest of the current branch
bash scripts/deploy/deploy.sh --ref v1.0.1    # a release tag
```

From your laptop, without logging in: `bash scripts/deploy/deploy-remote.sh deploy@VM_IP --dir careerpilot --identity ~/.ssh/careerpilot_vm`. The script pulls the code, rebuilds, runs migrations, restarts what changed, and checks health. GitHub can do the same: `.github/workflows/deploy.yml` (Actions → **Deploy** → **Run workflow**, or push a `v*` tag). Add these repository secrets first: `DEPLOY_HOST` (VM IP or name), `DEPLOY_USER` (`deploy`), `DEPLOY_PATH` (`careerpilot`), `DEPLOY_SSH_KEY` (a private key whose public half is in the deploy user's `authorized_keys`), `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan -t ed25519 VM_IP`).

Data lives in Docker volumes and survives updates and reboots. Never run `docker compose down -v` on the server: it deletes the database.
