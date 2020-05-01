require('dotenv').config();
const {createTwitchAccount} = require('./twitch');
const {createRiotAccount} = require('./riot');
const {linkAccounts} = require('./linking');
const fs = require('fs');

const outFilePath = './results.json';

(async () => {
    for (let i = 5; i > 0; i--) {
        try {
            console.log('--- Start creating account');
            const twitchAccount = await createTwitchAccount();
            console.log('Twitch account generated', twitchAccount);
            const riotAccount = await createRiotAccount();
            console.log('Riot account generated', riotAccount);
            console.log('Link accounts');
            await linkAccounts(twitchAccount, riotAccount);
            console.log('Save result');
            saveResult(twitchAccount, riotAccount);
        } catch (e) {
            console.log('Failed to create accounts. Retry...');
            console.error(e);
            i++;
        }
    }
})();

function saveResult(twitch, riot) {
    if (!fs.existsSync(outFilePath) ||
      fs.readFileSync(outFilePath).toString() === '')
        fs.writeFileSync(outFilePath, '[]');

    const results = require(outFilePath);
    results.push({twitch, riot});
    fs.writeFileSync(outFilePath, JSON.stringify(results, null, 2));
};
