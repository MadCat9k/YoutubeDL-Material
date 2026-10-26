exports.escapeAmpersands = (value) => typeof value === 'string'
    ? value.replace(/&/g, '&amp;')
    : value;
