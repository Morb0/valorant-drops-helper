const axios = require('axios');

module.exports.solveFunCaptcha = async (publicKey, sURL, pageURL) => {
    const {data} = await axios.get('https://rucaptcha.com/in.php', {
        params: {
            key: process.env.RUCAPTCHA_KEY,
            method: 'funcaptcha',
            publickey: publicKey,
            surl: sURL,
            pageurl: pageURL,
            json: 1,
        },
    });

    if (data.status === 0)
        throw new Error(`Failed to solve captcha: ${data.error_text}`);

    const taskId = data.request;
    const captchaToken = await getCaptchaResult(taskId);
    return captchaToken;
};

const getCaptchaResult = taskId => {
    return new Promise(async (resolve, reject) => {
        const checkResult = async () => {
            const {data} = await axios.get('https://rucaptcha.com/res.php', {
                params: {
                    key: process.env.RUCAPTCHA_KEY,
                    action: 'get',
                    id: taskId,
                    json: 1,
                },
            });

            if (data.status === 0) {
                if (data.request === 'CAPCHA_NOT_READY') {
                    setTimeout(() => checkResult(), 5000);
                    return;
                }

                return reject(`Failed to get captcha result: ${data.error_text || data.request}`);
            }

            resolve(data.request);
        };
        await checkResult();
    });
};
