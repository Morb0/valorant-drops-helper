const axios = require('axios');
const xmlParser = require('fast-xml-parser');

module.exports.getEmail = login => `${login}@tm.in-ulm.de`;
module.exports.getAllMails = async name => {
    const {data: xmlData} = await axios.get('https://tm.in-ulm.de/inbox-api.php', {
        params: {name},
    });
    const data = xmlParser.parse(xmlData);
    const entry = data.feed.entry;
    return Array.isArray(entry) ? entry : [entry];
};
module.exports.getMailHTMLContent = async (login, mailId) => {
    const {body} = await axios.get('https://tm.in-ulm.de/mail.php', {
        params: {search: login, nr: mailId},
    });
    return body;
};
module.exports.waitFirstMail = name => {
    return new Promise(async resolve => {
        const check = async () => {
            const lastMail = (await this.getAllMails(name))[0];
            if (lastMail.title === '0 E-Mails im Posteingang')
                return setTimeout(async () => await check(), 1000);
            resolve(lastMail);
        };
        await check();
    });
};
