const { AntiCaptcha } = require('anticaptcha');

const anticaptcha = new AntiCaptcha(process.env.ANTICAPTCHA_KEY);

module.exports.solveV3Recaptcha = async (url, key) => {
    const taskId = await anticaptcha.createTask({
        type: 'NoCaptchaTaskProxyless',
        websiteURL: url,
        websiteKey: key,
        minScore: 0.3,
    });
    const response = await anticaptcha.getTaskResult(taskId, 9999, 5000);
    return response.solution.gRecaptchaResponse;
};

module.exports.solveFunCaptcha = async (url, key) => {
    const taskId = await anticaptcha.createTask({
        type: 'FunCaptchaTaskProxyless',
        websiteURL: url,
        websitePublicKey: key,
    });
    const response = await anticaptcha.getTaskResult(taskId, 9999, 5000);
    return response.solution.token;
};
