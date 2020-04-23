const axios = require('axios');
const {generateRandomCredentials, convertCookieForRequestHeader} = require('./utils');
const {getEmail, waitFirstMail} = require('./trash-mail');
const {solveFunCaptcha} = require('./anti-captcha');

const CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

module.exports.createTwitchAccount = async () => {
    console.log('Generating basic credentials');
    const credentials = generateRandomCredentials();
    console.log('Getting email');
    const email = getEmail(credentials.username);
    console.log('Solving captcha');
    const captchaToken = await solveArkoseCaptcha();
    console.log('Generating payload');
    const payload = await generatePayload(credentials, email, captchaToken);
    console.log('Registering account');
    const cookies = await registerAccount(payload);
    console.log('Getting access token');
    const accessToken = await getAccessToken(cookies);
    console.log('Wait verification mail');
    const verifyMail = await waitFirstMail(credentials.username);
    console.log('Getting verification code from email');
    const verifyCode = extractVerifyCodeFromMailTitle(verifyMail.title);
    console.log('Verify email');
    await verifyEmail(accessToken, email, verifyCode);
    console.log('Done');

    return {
        ...credentials,
        email,
        cookies,
        accessToken,
    };
};

const generatePayload = async ({username, password, birthday}, email, captchaToken) => {
    return {
        username,
        password,
        email,
        birthday,
        include_verification_code: true,
        client_id: CLIENT_ID,
        arkose: {token: captchaToken},
    };
};

const registerAccount = async payload => {
    try {
        const {headers} = await axios.post('https://passport.twitch.tv/register', payload);
        return headers['set-cookie'];
    } catch (e) {
        console.debug(e.response.data);
        throw new Error('Error while registering Twitch account');
    }
};

const solveArkoseCaptcha = () => solveFunCaptcha(
    'https://www.twitch.tv/signup',
    process.env.TWITCH_FUNCAPTCHA_SIGNUP_KEY
)
    .then(token => token.replace('https://twitch-api.arkoselabs.com', 'https://client-api.arkoselabs.com'));

const getAccessToken = async cookies => {
    try {
        const headerCookies = convertCookieForRequestHeader(cookies);
        const {data} = await axios.get('https://id.twitch.tv/oauth2/authorize', {
            headers: {Cookie: headerCookies},
            params: {
                client_id: CLIENT_ID,
                lang: 'en',
                login_type: 'login',
                redirect_uri: 'https://www.twitch.tv/passport-callback',
                response_type: 'token',
                scope: ['chat_login', 'user_read', 'user_subscriptions', 'user_presence_friends_read'].join(' '),
            },
            maxRedirects: 0,
            validateStatus: status => status >= 200 && status < 300 || status === 302,
        });
        return extractAccessTokenFromRedirectBody(data);
    } catch (e) {
        console.debug(e.response.data);
        throw new Error('Error while getting access token for Twitch account');
    }
};

const extractAccessTokenFromRedirectBody = body => body.split('=')[2].split('&')[0];
const extractVerifyCodeFromMailTitle = title => /\d+/.exec(title)[0];

module.exports.validateAuthToken = async authToken => {
    const {status} = await axios.get('https://id.twitch.tv/oauth2/validate', {
        headers: {
            Authorization: `OAuth ${authToken}`,
        },
        validateStatus: status => status >= 200 && status < 300 || status === 401,
    });
    return status === 401;
};

const verifyEmail = async (accessToken, email, code) => {
    const userId = await getUserId(accessToken);
    const {request,error} = await sendGQLRequest(accessToken, `
        mutation VerifyEmail {
          validateVerificationCode(input: {address: "${email}", code: "${code}", key: "${userId}"}) {
            request {
              status
            }
            error {
              code
            }
          }
        }
    `)
        .then(res => res.data)
        .then(body => body.data.validateVerificationCode);

    if (error && error.code !== 'UNKNOWN') {
        if (error.code === 'INCORRECT_CODE')
            throw new Error('Invalid email code for verify');
        if (error.code === 'TOO_MANY_FAILED_ATTEMPTS')
            throw new Error('Too many failed attempts to verify code');

        console.error(error);
        throw new Error('Failed to verify email');
    }

    if (request.status === 'PENDING')
        throw new Error('Email not verified. Status is "pending"');
    if (request.status === 'REJECTED')
        throw new Error('Verify request is rejected');
};

const getUserId = accessToken => {
    return sendGQLRequest(accessToken, `
        query GetMyId {
          currentUser {
            id
          }
        }
    `)
        .then(res => res.data)
        .then(body => body.data.currentUser.id);
};

const sendGQLRequest = (accessToken, query) => {
    return axios.post('https://gql.twitch.tv/gql',
        {query},
        {
            headers: {
                'Client-Id': CLIENT_ID,
                'Authorization': `OAuth ${accessToken}`,
            },
        });
};
