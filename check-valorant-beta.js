const axios = require('axios');
const jwtDecode = require('jwt-decode');

(async () => {
  const accounts = require('./results.json');
  console.log(`Loaded ${accounts.length} Riot accounts`);

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i].riot;
    await checkAccount(account.username, account.password);
  }
})();

async function checkAccount(username, password) {
  console.log(`> Checking '${username}'`);
  const sessionCookies = await getSessionCookies();
  console.log('Got session cookies');
  const authURI = await getAuthURI(sessionCookies, username, password);
  console.log('Success got auth uri');
  const accessToken = extractAccessTokenFromURI(authURI);
  console.log('Success extract access token from uri');
  const haveGame = await checkGameOnAccount(accessToken);
  console.log('Success checked');

  console.log(`>>> ${username} => ${haveGame ? 'YES' : 'NO'}\n`);
}

async function getSessionCookies() {
  const { data, headers } = await axios.post('https://auth.riotgames.com/api/v1/authorization', {
    client_id: 'play-valorant-web-prod',
    prompt: 'login',
    redirect_uri: 'https://beta.playvalorant.com/opt_in',
    response_type: 'token id_token',
    scope: 'account openid',
    ui_locales: 'ru-ru',
    nonce: 'NTUsNzksNDQsMTQ0',
    state: 'bG9naW4=',
  });
  if (data.type === 'error')
    throw new Error(data.error.description);
  return headers['set-cookie'];
}

async function getAuthURI(sessionCookies, username, password) {
  const { data } = await axios.put('https://auth.riotgames.com/api/v1/authorization', {
    username,
    password,
    type: 'auth',
    language: 'ru_RU',
    remember: false,
  }, {
    headers: {
      cookie: sessionCookies.join(';'),
    },
  });
  if (data.type === 'error' || data.error)
    throw new Error(data.error.description || data.error);
  return data.response.parameters.uri;
}

function extractAccessTokenFromURI(uri) {
  return /access_token=(.+)&scope=/.exec(uri)[1];
}

async function checkGameOnAccount(accessToken) {
  const CLOSE_BET_ACCESS_TOKEN = 'urn:entitlement:valorantriot.valorant.closedbeta';
  const { data } = await axios.post('https://entitlements.auth.riotgames.com/api/token/v1', null, {
    headers: {
      authorization: 'Bearer ' + accessToken,
      'content-type': 'application/json',
    },
  });
  const { entitlements } = jwtDecode(data.entitlements_token);
  return entitlements.includes(CLOSE_BET_ACCESS_TOKEN);
}
