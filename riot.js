const axios = require('axios');
const jwtDecode = require('jwt-decode');
const {generateRandomCredentials, convertCookieForRequestHeader} = require('./utils');
const {getEmail} = require('./trash-mail');
const {solveV3Recaptcha} = require('./anti-captcha');

module.exports.createRiotAccount = async () => {
    console.log('Generating basic credentials');
    const credentials = generateRandomCredentials();
    console.log('Getting email');
    const email = getEmail(credentials.username);
    console.log('Solving captcha');
    const captchaToken = await solveV3Recaptcha('https://signup.na.leagueoflegends.com/en/signup/index#/registratio', process.env.RIOT_RECAPTCHA_KEY);
    console.log('Generating payload');
    const payload = await generatePayload(credentials, email, captchaToken);
    console.log('Registering account');
    const accountToken = await registerAccount(payload);
    console.log('Getting signup cookies');
    const signupCookies = await getSignupCookies(accountToken);
    console.log('Getting access token');
    const accessToken = await getAccessToken(signupCookies);
    console.log('Done');

    return {
        ...credentials,
        email,
        accountToken,
        signupCookies,
        accessToken,
    };
};

const generatePayload = ({username, password, birthday}, email, captchaToken) => {
    return {
        email,
        username,
        password,
        confirm_password: password,
        date_of_birth: formatBirthdayStr(birthday),
        token: `Captcha ${captchaToken}`,
        client_id: 'play-valorant-web-prod',
        locale: 'ru',
        tou_agree: true,
        newsletter: false,
        // region: 'NA1',
    };
};

const formatBirthdayStr = birthday => {
    let {day, month, year} = birthday;
    if (day < 10) day = '0' + day;
    if (month < 10) month = '0' + month;
    return `${year}-${month}-${day}`;
};

const registerAccount = async payload => {
    try {
        const {data} = await axios.post('https://signup-api.riotgames.com/v1/accounts', payload);
        return data.token;
    } catch (e) {
        console.debug(e.response.data);
        throw new Error('Error while registering Riot account');
    }
};

const getSignupCookies = async accountToken => {
  const {headers} = await axios.post('https://auth.riotgames.com/api/v1/signup', {
      token: accountToken,
      language: 'ru', // Is it important?
  });
  return headers['set-cookie'];
};

const getAccessToken = async cookies => {
    const headerCookies = convertCookieForRequestHeader(cookies);
    const {data} = await axios.post('https://auth.riotgames.com/api/v1/authorization', {
        nonce: 'MjE0LDg0LDE3Niw3',
        state: 'c2lnbnVw',
        redirect_uri: 'https://beta.playvalorant.com/opt_in',
        client_id: 'play-valorant-web-prod',
        prompt: 'signup',
        response_type: 'token id_token',
        scope: 'account openid',
        ui_locales: 'ru-ru',
    }, {
        headers: {Cookie: headerCookies},
    });
    const uriWithToken = data.response.parameters.uri;
    return extractAccessTokenFromURI(uriWithToken);
};

const extractAccessTokenFromURI = url => url.split('=')[1].split('&')[0];

module.exports.CLOSE_BETA_ENTITLEMENT = 'urn:entitlement:valorantriot.valorant.closedbeta';
module.exports.getAccountEntitlements = async accessToken => {
    const {data} = await axios.post('https://entitlements.auth.riotgames.com/api/token/v1', null, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
    });
    const { entitlements } = jwtDecode(data.token);
    return entitlements;
};
