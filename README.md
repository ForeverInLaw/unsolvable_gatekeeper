# Unsolvable Gatekeeper

A Discord bot that verifies new members using a captcha system to protect your server from bots and spam.

## Features

- **Captcha Verification:** Generates a unique, image-based captcha for each new user to solve.
- **Automatic Role Management:** Automatically assigns an "unverified" role to new members and replaces it with a "verified" role upon successful verification.
- **Slash Commands:** Uses modern Discord slash commands for easy setup and administration.
- **Secure & Private:** All verification interactions are handled through ephemeral messages, keeping your channels clean and uncluttered.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.9.0 or higher)
- [npm](https://www.npmjs.com/) (Node Package Manager)

## Installation & Setup

Follow these steps to get the Unsolvable Gatekeeper bot running on your server.

**1. Clone the repository:**

```bash
git clone https://github.com/ForeverInLaw/unsolvable-gatekeeper.git
cd unsolvable-gatekeeper
```

**2. Install dependencies:**
This command installs all the necessary libraries listed in `package.json`.

```bash
npm install
```

**3. Configure `.env`:**
Rename a file `.env.example` to `.env` in the root directory of the project and insert there credentials. This file will store your bot's secret token and client ID.

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_bot_client_id
```

**4. Configure `config.json`:**
Insert your credentials in this file in the root directory. The `/setup` command will automatically populate this file later, but it needs to exist beforehand.

```json
{
  "guildId": "",
  "unverifiedRole": "",
  "verifiedRole": "",
  "verificationChannel": ""
}
```

**5. Deploy Commands:**
This script registers the bot's slash commands (`/setup`, `/help`) with Discord so they can be used in your server.

```bash
node deploy-commands.js
```

**6. Start the Bot:**
Run this command to start the bot.

```bash
node index.js
```

## Available Commands

- **/setup**: Configures the verification system for the server. This command must be run by an administrator.

  - `unverified-role`: The role assigned to new members before they are verified.
  - `verified-role`: The role granted to members after they successfully complete the verification.
  - `channel`: The channel where the initial verification message and button will be posted.

- **/help**: Displays a help message with a list of all available commands and their descriptions.
