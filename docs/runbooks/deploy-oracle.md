# Deploy to Oracle Cloud Always Free (Ampere A1, ARM64)

A step-by-step guide for a first-time user. Oracle's Always Free tier gives one strong ARM server at no cost for as long as you use it (up to 4 OCPU, 24 GB memory, 200 GB disk). Allow about 1 hour for this part, then continue with [deploy-common.md](deploy-common.md) (DNS, `.env`, first deploy, first admin, Google callback, phone apps, backups, updates). Prices and limits change; check Oracle's Always Free page before you start.

## 1. Create the account

1. Go to https://www.oracle.com/cloud/free/ → **Start for free**.
2. Fill in your details. A **credit or debit card is required** for identity checks; Always Free resources are not charged. Pick your **home region** with care: it cannot be changed later, and Always Free servers can only be created there. Choose one close to your users (for example Mumbai or Singapore for Bangladesh).
3. Sign in to the console (https://cloud.oracle.com). If the A1 shape is later "out of capacity", you can upgrade to **Pay As You Go** (Billing → Upgrade). You stay at 0 cost while you remain inside the Always Free limits, and capacity is much easier to get.

## 2. Make an SSH key on your laptop

In PowerShell on your laptop:

```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\careerpilot_vm -C careerpilot
Get-Content $HOME\.ssh\careerpilot_vm.pub
```

Press Enter twice for no passphrase (or choose one). The second command prints the **public** key: one line starting with `ssh-ed25519`. Keep the other file (`careerpilot_vm`, the private key) secret; never share or commit it.

## 3. Create the server

Console menu (hamburger, top left) → **Compute** → **Instances** → **Create instance**.

| Field | Value |
|---|---|
| Name | `careerpilot` |
| Image | **Canonical Ubuntu 24.04** (or 22.04). Choose the **aarch64 / ARM** build. |
| Shape | **Change shape** → **Ampere** → **VM.Standard.A1.Flex**, **4 OCPU**, **24 GB** memory (the full Always Free allowance; 2 OCPU / 12 GB also works) |
| Networking | **Create new virtual cloud network** and **public subnet**; **Automatically assign public IPv4 address** ON |
| SSH keys | **Paste public keys** → paste the line printed in step 2 |
| Boot volume | **Specify a custom boot volume size** → 100 GB (Always Free allows 200 GB in total) |

Click **Create**. Wait for the state **Running** (1 to 2 minutes). If you see "Out of host capacity", try another availability domain in the same region, try again in a few hours, or upgrade to Pay As You Go (step 1).

## 4. Make the IP address permanent

The public IP stays while the server exists, but a **reserved** IP is safer (free while attached):

1. Instance page → **Attached VNICs** → the VNIC → **IPv4 addresses** → the row's **Edit** → **No public IP** → Update.
2. Edit again → **Reserved public IP** → **Create a new reserved IP address** → name `careerpilot-ip` → Update.

Write the address down; this is `VM_IP` in the rest of the guide. (Skip this step if you prefer the automatic address; just never delete the instance.)

## 5. Open ports 80 and 443 in the cloud network (VCN security list)

Oracle blocks everything except SSH by default.

1. Instance page → **Primary VNIC** → **Subnet** link → **Security** tab → the **Default Security List** → **Add Ingress Rules**.
2. Add two rules:

| Source CIDR | IP protocol | Destination port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

Leave "Source port range" empty. Port 22 (SSH) is already open. You can narrow SSH to your own IP later.

## 6. Open the ports inside the server (OS firewall)

Oracle's Ubuntu images also ship strict `iptables` rules that reject new ports. You do not edit them by hand: `scripts/deploy/bootstrap-vm.sh` detects Oracle Cloud and inserts the accept rules for 80 and 443, saves them with `netfilter-persistent`, and sets up `ufw` for 22/80/443. (By hand, the same thing is `sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT`, the same for 443, then `sudo netfilter-persistent save`.)

## 7. Log in and continue

```powershell
ssh -i $HOME\.ssh\careerpilot_vm ubuntu@VM_IP
```

Type `yes` to trust the server. Then follow [deploy-common.md](deploy-common.md) from section 1, in this order: DNS records → prepare the server (this runs the bootstrap script) → `.env` → first deploy → first admin → Google callback → phone apps.

## Oracle notes

- **Cost:** 0 while inside Always Free (A1: 4 OCPU / 24 GB total, 200 GB block storage, 10 TB outbound a month). Oracle may reclaim idle Always Free instances (very low CPU, network, and memory use for 7 days); CareerPilot's background jobs keep it active, and a Pay As You Go account is not reclaimed.
- **Performance:** the first deploy builds on the server and takes 15 to 40 minutes.
- **Backups:** Always Free includes boot-volume backups (a few); still copy the nightly CareerPilot backups off the VM (deploy-common.md, section 8).
- **Cannot reach the site:** check in this order: DNS (`nslookup api.<domain>`), the security list rules in step 5, `sudo iptables -L INPUT -n --line-numbers` (80 and 443 above any REJECT), then `docker compose ... logs caddy`.
