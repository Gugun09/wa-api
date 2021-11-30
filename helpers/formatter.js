const phoneNumberFormatter = function(number){
    // 1. Menghilangkan karakter selain angka
    let formated = number.replace(/\D/g, '');
    // 2. menghilangkan angka 0 didepan (prefix) ganti dengan 62
    if (formated.startsWith('0')) {
        formated = '62' + formated.substr(1);
    }

    if (!formated.endsWith('@c.us')) {
        formated += '@c.us';
    }

    return formated;
}

module.exports = {
    phoneNumberFormatter
}