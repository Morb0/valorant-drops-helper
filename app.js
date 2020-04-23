require('dotenv').config();
const {createTwitchAccount} = require('./twitch');
const {createRiotAccount} = require('./riot');

(async () => {
    // const twitchAccount = await createTwitchAccount();
    // console.log(twitchAccount);
    const riotAccount = await createRiotAccount();
    console.log(riotAccount);
})();
