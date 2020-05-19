class Cookie {
    name = null
    value = null
    samesite = null
    path = null
    maxage = null
    expires = null
    domain = null
    secure = null
    httponly = null

    // Extras
    size = null
    priority = null

    constructor(initial) {
        if (typeof initial === 'object') {
            Object.keys(initial).filter(key => key in this).forEach(key => {
                this[key] = initial[key];
            });
        } else if (typeof initial === 'string') {
            this.convertStringCookieToObject(initial);
        }
    }

    convertStringCookieToObject = (stringCookie) => {
        const cookieFields = stringCookie.split(';');

        cookieFields.forEach(cookieField => {
            const [name, value] = cookieField.trim().split('=');
            const fieldNameCleaned = this.cleanFieldName(name)

            if (fieldNameCleaned in this) {
                this[fieldNameCleaned] = value;
            } else {
                this.name = name;
                this.value = value;
            }
        }, this)
    }

    cleanFieldName = (name) => {
        return name.replace(/[|-]/g, "").toLowerCase();
    }
}

module.exports = Cookie
