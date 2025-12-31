# Automatic Deployment Setup

This guide explains how to set up automatic deployments from GitHub to your Digital Ocean server.

## 🎯 How It Works

When you push to the `main` branch:
1. GitHub Actions workflow is triggered
2. GitHub connects to your server via SSH
3. Runs your `deploy.sh` script automatically
4. Your app is rebuilt and redeployed with zero downtime

---

## 🔐 One-Time Setup

### Step 1: Create an SSH Key for Deployment

On your **local machine** (not the server):

```bash
# Generate a new SSH key specifically for deployment
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/streetsweeper-deploy

# This creates two files:
# ~/.ssh/streetsweeper-deploy (private key - keep this secret!)
# ~/.ssh/streetsweeper-deploy.pub (public key - safe to share)
```

**Important**: When prompted for a passphrase, press Enter to leave it empty (required for automated deployments).

### Step 2: Add Public Key to Your Server

Since you SSH as root and then `su - deploy`, we need to manually add the key to the deploy user:

```bash
# Copy the public key to your clipboard
cat ~/.ssh/streetsweeper-deploy.pub

# SSH into your server as root
ssh root@your-server-ip

# Switch to deploy user
su - deploy

# Create .ssh directory and set permissions
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add the public key to authorized_keys
# Paste the output from the 'cat' command above
echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Exit back to root
exit

# Exit the server
exit
```

**Alternative (one-liner from your local machine):**

```bash
# This copies the key directly to the deploy user
cat ~/.ssh/streetsweeper-deploy.pub | ssh root@your-server-ip "su - deploy -c 'mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys'"
```

**Test the connection:**

```bash
ssh -i ~/.ssh/streetsweeper-deploy deploy@your-server-ip
```

If you can log in as `deploy` without a password, you're good! This is much more secure than giving GitHub Actions root access.

### Step 3: Configure GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

| Secret Name | Value | How to Get It |
|-------------|-------|---------------|
| `DEPLOY_HOST` | Your server IP or domain | Your Digital Ocean droplet IP (e.g., `123.45.67.89`) |
| `DEPLOY_USER` | SSH username | `deploy` (the non-root user that runs your app) |
| `DEPLOY_KEY` | SSH private key | Run `cat ~/.ssh/streetsweeper-deploy` and copy the entire output |
| `DEPLOY_PORT` | SSH port (optional) | `22` (default, can omit if using default) |

**For `DEPLOY_KEY`:**
```bash
# Copy your PRIVATE key (the one WITHOUT .pub)
cat ~/.ssh/streetsweeper-deploy

# Copy the ENTIRE output, including:
# -----BEGIN OPENSSH PRIVATE KEY-----
# ... all the content ...
# -----END OPENSSH PRIVATE KEY-----
```

Paste this entire content into the `DEPLOY_KEY` secret on GitHub.

---

## ✅ Verify Setup

### Test the Workflow

1. Make a small change to your code (e.g., update README.md)
2. Commit and push to `main`:
   ```bash
   git add .
   git commit -m "Test automatic deployment"
   git push origin main
   ```
3. Go to **Actions** tab in your GitHub repo
4. Watch the deployment run in real-time!

### Manual Trigger

You can also trigger deployments manually:
1. Go to **Actions** tab
2. Click **Deploy to Production** workflow
3. Click **Run workflow** → Select `main` → **Run workflow**

---

## 🚀 Usage

### Automatic Deployments

Simply push to `main`:

```bash
git add .
git commit -m "Add new feature"
git push origin main
```

GitHub Actions will automatically:
- ✅ Connect to your server
- ✅ Pull latest code
- ✅ Rebuild Docker containers
- ✅ Run database migrations
- ✅ Restart services

### Feature Branch Workflow

For safer deployments:

```bash
# Work on a feature branch
git checkout -b feature/my-new-feature

# Make changes and commit
git add .
git commit -m "Add awesome feature"
git push origin feature/my-new-feature

# Create a pull request on GitHub
# Review and test
# Merge to main (deployment happens automatically!)
```

---

## 🔍 Monitoring Deployments

### View Deployment Logs

1. Go to your GitHub repository
2. Click **Actions** tab
3. Click on the latest workflow run
4. Click on the **Deploy to Digital Ocean** job
5. Expand the **Deploy to server** step to see logs

### View Server Logs

SSH into your server and check logs:

```bash
ssh deploy@your-server-ip
cd ~/apps/streetsweeper
docker compose logs -f app
```

---

## 🛠️ Troubleshooting

### Deployment Fails: "Permission denied (publickey)"

**Problem**: GitHub can't connect to your server.

**Solutions**:
1. Verify `DEPLOY_HOST`, `DEPLOY_USER` (should be `deploy`), and `DEPLOY_KEY` secrets are set correctly
2. Make sure the public key is in `/home/deploy/.ssh/authorized_keys` on the server
3. Test SSH connection manually:
   ```bash
   ssh -i ~/.ssh/streetsweeper-deploy deploy@your-server-ip
   ```
4. Check the authorized_keys file permissions:
   ```bash
   ssh root@your-server-ip
   su - deploy
   ls -la ~/.ssh/authorized_keys  # Should be -rw------- (600)
   ls -la ~/.ssh                   # Should be drwx------ (700)
   ```
5. Check server SSH logs:
   ```bash
   ssh root@your-server-ip
   tail -f /var/log/auth.log
   ```

### Deployment Fails: "./deploy.sh: No such file or directory"

**Problem**: The deploy script isn't where the workflow expects it.

**Solutions**:
1. SSH into server and verify the path:
   ```bash
   ls -la ~/apps/streetsweeper/deploy.sh
   ```
2. Make sure the script is executable:
   ```bash
   chmod +x ~/apps/streetsweeper/deploy.sh
   ```
3. Update the workflow if your app is in a different directory
4. Verify the deploy user has permissions:
   ```bash
   ssh root@your-server-ip
   su - deploy
   cd ~/apps/streetsweeper
   ls -la deploy.sh
   ```

### Deployment Hangs or Times Out

**Problem**: Docker build is taking too long.

**Solutions**:
1. Increase workflow timeout in `.github/workflows/deploy.yml`:
   ```yaml
   jobs:
     deploy:
       timeout-minutes: 30  # Add this line
   ```
2. Optimize your Docker build with caching
3. Check server resources:
   ```bash
   htop  # Check CPU/memory
   df -h  # Check disk space
   ```

### Docker: "No space left on device"

**Problem**: Server ran out of disk space.

**Solution**: Clean up old Docker images:
```bash
ssh deploy@your-server-ip
docker system prune -a --volumes
```

---

## 🔒 Security Best Practices

✅ **Do:**
- Use a dedicated SSH key for deployments (not your personal key)
- Keep private keys secure (never commit them to git)
- Use the `deploy` user (not `root`) for deployments
- Regularly rotate SSH keys (every 6-12 months)
- Enable 2FA on GitHub

❌ **Don't:**
- Share your `DEPLOY_KEY` secret
- Use your personal SSH key for automation
- Commit `.env` files or secrets to git
- Deploy as `root` user

---

## 🎨 Customization

### Add Tests Before Deployment

Edit `.github/workflows/deploy.yml`:

```yaml
jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test

  deploy:
    name: Deploy to Digital Ocean
    runs-on: ubuntu-latest
    needs: test  # Only deploy if tests pass
    steps:
      # ... existing deployment steps
```

### Add Slack/Discord Notifications

Add a notification step:

```yaml
      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Deploy to Multiple Environments

Create separate workflows:
- `.github/workflows/deploy-staging.yml` (triggers on `develop` branch)
- `.github/workflows/deploy-production.yml` (triggers on `main` branch)

---

## 🔄 Alternative Solutions

If GitHub Actions doesn't work for you, here are alternatives:

### Option 2: Webhook-Based Deployment

Set up a webhook listener on your server that triggers on GitHub pushes.

**Pros**: More control, instant deployments
**Cons**: Requires running a webhook server, more complex setup
**Tools**: [webhook](https://github.com/adnanh/webhook), [captain-hook](https://github.com/bketelsen/captainhook)

### Option 3: Git Pull via Cron

Set up a cron job that checks for changes every few minutes.

**Pros**: Simple, no external dependencies
**Cons**: Delays in deployment, uses server resources

```bash
crontab -e

# Add this line (check every 5 minutes):
*/5 * * * * cd ~/apps/streetsweeper && git fetch && [ $(git rev-parse HEAD) != $(git rev-parse @{u}) ] && ./deploy.sh
```

### Option 4: GitLab CI/CD or Jenkins

If you're using GitLab or have a Jenkins server, you can use their built-in CI/CD.

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [SSH Key Management](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [Docker Deployment Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Digital Ocean Deployment Guides](https://www.digitalocean.com/community/tutorials)

---

## ✨ You're All Set!

Your app now automatically deploys whenever you push to `main`. Just commit, push, and let GitHub handle the rest!

```bash
git add .
git commit -m "Ship it! 🚀"
git push origin main
```

Then watch it deploy at: `https://github.com/yourusername/streetsweeper/actions`
