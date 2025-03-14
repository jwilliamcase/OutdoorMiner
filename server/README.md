# Outdoor Miner - Game Server

This is the multiplayer server component for the Outdoor Miner game.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Run the server locally:
   ```
   npm run dev
   ```

## Deployment Options

### Render.com (Free Tier)

1. Sign up for a free account at [Render.com](https://render.com/)
2. Click "New" and select "Web Service"
3. Connect your GitHub repository or use the manual deploy option
4. Configure the service:
   - Name: outdoor-miner-server
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Select the Free plan
5. Add environment variable:
   - CLIENT_URL: The URL of your deployed game (e.g., https://jwilliamcase.github.io/OutdoorMiner/)
6. Deploy the service
7. Once deployed, copy the URL (e.g., https://outdoor-miner-server.onrender.com)
8. Update the `SERVER_URL` in your game's config.js file

### Glitch.com (Free Tier)

1. Sign up for a free account at [Glitch.com](https://glitch.com/)
2. Create a new project by importing from GitHub
3. Upload your server files or create a new project and copy the files
4. Edit the .env file to set the CLIENT_URL
5. The server will automatically start
6. Copy your Glitch project URL
7. Update the `SERVER_URL` in your game's config.js file

### Heroku (Free Tier Removed, but Option for Paid)

1. Sign up for a Heroku account
2. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
3. Login to Heroku: `heroku login`
4. Navigate to your server directory
5. Create a Heroku app: `heroku create outdoor-miner-server`
6. Add a Procfile (no extension) with the content: `web: npm start`
7. Set the environment variable: `heroku config:set CLIENT_URL=https://jwilliamcase.github.io/OutdoorMiner/`
8. Deploy the server: `git push heroku main` (or master)
9. Copy the Heroku app URL
10. Update the `SERVER_URL` in your game's config.js file