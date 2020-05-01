const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const url = require('url');
const querystring = require('querystring');
const {convertCookieForRequestHeader} = require('./utils');

axiosCookieJarSupport(axios);

module.exports.linkAccounts = async (twitchAccount, riotAccount) => {
  console.log('Setup clients');

  const cookieJar = new tough.CookieJar();
  const twitchInst = axios.create({
    // jar: cookieJar,
    // withCredentials: true,
  });
  twitchInst.defaults.headers.common['Cookie'] = convertCookieForRequestHeader(twitchAccount.cookies);
  twitchInst.defaults.headers.common['Cookie'] += `;auth-token=${twitchAccount.accessToken}`;

  const riotInst = axios.create({
    jar: cookieJar,
    withCredentials: true,
  });

  console.log('Get Twitch link url');
  const linkURL = await getTwitchLinkURL(twitchInst, twitchAccount.userId);

  console.log('Extract login data from Twitch link url');
  const sessionPayload = extractSessionPayloadFromLinkURL(linkURL);

  console.log('Create Riot auth session');
  await createAuthSession(riotInst, sessionPayload);

  console.log('Login Riot session');
  const {data} = await loginSession(riotInst, riotAccount.username, riotAccount.password);
  let twitchCallbackURL;
  if (data.type === 'response') {
    console.log('Got Twitch callback url from login');
    twitchCallbackURL = data.response.parameters.uri;
  } else {
    console.log('Get Twitch callback url');
    twitchCallbackURL = await getTwitchCallbackURL(riotInst);
  }
  const twitchCallbackURLWithState = `${twitchCallbackURL}&state=${encodeURI(sessionPayload.state)}`;

  console.log('Activate callback');
  await activateCallback(twitchInst, twitchCallbackURLWithState);

  console.log('Done');
};

const getTwitchLinkURL = (twitchInst, userId) => {
  return twitchInst.get('https://api.twitch.tv/ent/riot/auth', {
    params: {
      id: userId,
    },
    validateStatus: status => status === 302,
    maxRedirects: 0,
  })
    .then(res => res.headers['location']);
};

const extractSessionPayloadFromLinkURL = linkURL => {
  const {query} = url.parse(linkURL);
  return querystring.parse(query);
};

const checkAuthSession = riotInst => {
  return riotInst.get('https://auth.riotgames.com/api/v1/authorization', {
    validateStatus: null
  })
    .then(res => res.data)
    .then(data => !(data.type === 'error' && data.error === 'invalid_session_id'));
};

const createAuthSession = (riotInst, data) => {
  return  riotInst.post('https://auth.riotgames.com/api/v1/authorization', data);
};

const loginSession = (riotInst, username, password) => {
  return riotInst.put('https://auth.riotgames.com/api/v1/authorization', {
    type: 'auth',
    username,
    password,
    language: 'ru_RU',
    remember: true,
  });
};

const getTwitchCallbackURL = async riotInst => {
  const {data} = await riotInst.put('https://auth.riotgames.com/api/v1/authorization', {
    type: 'consent',
    scope: ['openid', 'offline_access', 'cpid'],
    consentGiven: true
  });
  return data.response.parameters.uri;
};

const activateCallback = async (twitchInst, callbackURL) => {
  const {headers} = await twitchInst.get(callbackURL, {
    maxRedirects: 0,
    validateStatus: status => status === 302,
  });
  if (headers['location'].includes('callback_error'))
    throw new Error('Failed to activate Twitch callback url');
};
