# Deploy to AWS (Lightsail or EC2)

A step-by-step guide for a first-time user. Pick **one**: Lightsail (simplest, fixed monthly price, x86) or EC2 (more control, cheaper ARM/Graviton). Allow about 1 hour for this part, then continue with [deploy-common.md](deploy-common.md) (DNS, `.env`, first deploy, first admin, Google callback, phone apps, backups, updates).

## Cost notes (approximate, check https://aws.amazon.com/pricing/ first)

| Choice | Memory | About per month |
|---|---|---|
| Lightsail, Ubuntu, 4 GB plan | 4 GB, 2 vCPU, 80 GB disk | 24 USD, includes a static IP and transfer |
| Lightsail, 8 GB plan | 8 GB | 44 USD |
| EC2 `t4g.small` (Graviton ARM) | 2 GB | about 12 USD plus disk and IP: **too small** to build and run everything comfortably; works only with extra swap and slow builds |
| EC2 `t4g.medium` (ARM) | 4 GB | about 25 USD plus 30 GB disk (about 3 USD) and public IPv4 (about 3.6 USD) |
| EC2 `t4g.large` (ARM) | 8 GB | about 50 USD plus the same extras |

Recommendation: Lightsail 4 GB for the simplest start, or EC2 `t4g.medium` with a 30 GB disk. AWS charges for a public IPv4 address even when attached; set a **budget alert** (Billing → Budgets → Create budget, 30 USD) so a surprise cannot grow. Turn off or delete what you do not use. New accounts may have free-tier credits; they change often.

## 1. Create the account

https://aws.amazon.com → **Create an AWS account** → email, password, card (required), phone verification, **Basic support (free)**. Then sign in to the console, pick a **region** near your users (top right; for Bangladesh, Mumbai `ap-south-1` or Singapore `ap-southeast-1`), and turn on MFA for the root user (Account menu → Security credentials).

## 2. Make an SSH key on your laptop

In PowerShell:

```powershell
ssh-keygen -t ed25519 -f $HOME\.ssh\careerpilot_vm -C careerpilot
Get-Content $HOME\.ssh\careerpilot_vm.pub
```

The second command prints the **public** key (one line starting with `ssh-ed25519`). Keep `careerpilot_vm` (private) secret.

## Option A: Lightsail

1. Console → search **Lightsail** → **Create instance**.
2. Region as chosen; platform **Linux/Unix**; blueprint **OS Only → Ubuntu 24.04 LTS** (or 22.04).
3. **SSH key pair** → **Change SSH key pair** → **Upload new** → choose `careerpilot_vm.pub`.
4. Plan: **4 GB** (or 8 GB). Name `careerpilot`. **Create instance**.
5. **Networking** tab of the instance:
   - **Attach static IP** → create `careerpilot-ip` and attach it (free while attached). This is `VM_IP`.
   - **IPv4 Firewall** → **Add rule**: Application **HTTP** (TCP 80), then **HTTPS** (TCP 443). SSH (22) already exists; you can restrict it to your IP.
6. Login user is `ubuntu`.

## Option B: EC2

1. Console → **EC2** → **Key pairs** → **Actions** → **Import key pair** → name `careerpilot`, paste the public key.
2. **Instances** → **Launch instances**:

| Field | Value |
|---|---|
| Name | `careerpilot` |
| AMI | **Ubuntu Server 24.04 LTS**, architecture **64-bit (Arm)** for Graviton (or x86) |
| Instance type | `t4g.medium` (ARM) or `t3.medium` (x86); at least 4 GB memory |
| Key pair | `careerpilot` |
| Network settings → Edit | **Create security group** `careerpilot-sg` with: SSH (22) from **My IP**, HTTP (80) from `0.0.0.0/0`, HTTPS (443) from `0.0.0.0/0` |
| Storage | 30 GiB `gp3` (50 if you keep many backups) |

3. **Launch instance**. Then **Elastic IPs** → **Allocate Elastic IP address** → **Allocate** → select it → **Actions** → **Associate Elastic IP address** → your instance. This is `VM_IP` and it survives stop/start. Release it if you delete the server (otherwise it is billed).
4. Login user is `ubuntu`. (Add 1 to 2 GB extra swap by setting `SWAP_SIZE=4G` when you run the bootstrap script if you chose a 2 GB size: `sudo SWAP_SIZE=4G bash ...`.)

## 3. Log in and continue

```powershell
ssh -i $HOME\.ssh\careerpilot_vm ubuntu@VM_IP
```

Type `yes` to trust the server. The server's own firewall (`ufw`) is set up by the bootstrap script (22, 80, 443); the AWS firewall/security group you made above is the outer layer and must allow 80 and 443.

Then follow [deploy-common.md](deploy-common.md) from section 1: DNS records → prepare the server → `.env` → first deploy → first admin → Google callback → phone apps → backups.

## AWS notes

- **Both options work with the same files:** images are built on the server for its own CPU (x86 or ARM).
- **Stop saving money wrongly:** stopping an EC2 instance still bills for disk and Elastic IP; Lightsail bills until the instance is deleted.
- **Cannot reach the site:** check DNS (`nslookup api.<domain>`), the Lightsail firewall or EC2 security group (80 and 443 open), then `docker compose -p careerpilot-prod --env-file .env -f docker-compose.prod.yml logs caddy` on the server.
- **Snapshots:** Lightsail snapshots (about 0.05 USD per GB per month) or EBS snapshots are a good extra on top of the nightly CareerPilot backups.
