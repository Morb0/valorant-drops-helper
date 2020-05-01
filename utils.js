const UsernameGenerator = require('username-generator');
const PasswordGenerator = require('generate-password');
const randomInt = require('random-int');

module.exports.generateId = size => Math.random().toString(36).substr(2, size);
module.exports.generatePassword = () => PasswordGenerator.generate() + '*0$#_A';
module.exports.generateUsername = () => UsernameGenerator.generateUsername().replace(/-/g, '') + this.generateId(3);
module.exports.generateBirthday = () => ({
    day: randomInt(1, 30),
    month: randomInt(1, 12),
    year: randomInt(1960, 2002),
});
module.exports.generateRandomCredentials = () => ({
    username: this.generateUsername(),
    password: this.generatePassword(),
    birthday: this.generateBirthday(),
});
module.exports.convertCookieForRequestHeader = cookies => cookies.map(cookies => cookies.split(';')[0]).join(';');
