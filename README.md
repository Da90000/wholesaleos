# WholesaleOS v2

## Setup Instructions for Oracle Cloud (OCI)

### 1. Supabase Setup
1. Create a new project on [Supabase](https://supabase.com).
2. Go to SQL Editor and run the contents of `supabase/schema.sql`.
3. (Optional) Run `supabase/seed.sql` to insert sample data.
4. Get your Project URL and anon key from Project Settings > API.

### 2. Server Setup (OCI VM)
1. SSH into your OCI VM: `ssh ubuntu@YOUR_IP`
2. Install Node.js:
   \`\`\`bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   \`\`\`
3. Install Nginx: `sudo apt install nginx -y`
4. Install PM2: `sudo npm install -g pm2`
5. Clone or copy this project to `/home/ubuntu/wholesaleos`
6. Create a `.env` file in the project root:
   \`\`\`
   PORT=3001
   GEMINI_API_KEY=your_gemini_api_key_here
   NODE_ENV=production
   \`\`\`
7. Install dependencies and build:
   \`\`\`bash
   npm install
   npm run build
   \`\`\`
8. Start the backend:
   \`\`\`bash
   pm2 start dist/server.cjs --name wholesaleos
   \`\`\`

### 3. Nginx Configuration
1. Copy `nginx/nginx.conf` to `/etc/nginx/sites-available/wholesaleos`
2. Edit the file to replace `YOUR_DOMAIN_OR_IP` with your actual domain or IP.
3. Enable the site:
   \`\`\`bash
   sudo ln -s /etc/nginx/sites-available/wholesaleos /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   \`\`\`

### 4. App Configuration
1. Open the app in your browser.
2. The Settings modal will appear on first load.
3. Enter your Supabase URL and Anon Key.
4. Click "Save & Connect".
