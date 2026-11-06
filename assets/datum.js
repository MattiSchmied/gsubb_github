'use strict';

const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Berlin'}).format(new Date());
document.querySelectorAll('[data-expires]').forEach(item => {
    if (item.dataset.expires < today) item.hidden = true;
});
document.querySelectorAll('[data-notice-empty]').forEach(empty => {
    empty.hidden = Boolean(empty.parentElement.querySelector('[data-expires]:not([hidden])'));
});

