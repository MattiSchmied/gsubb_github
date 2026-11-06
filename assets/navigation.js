'use strict';

const menuButton = document.querySelector('.nav-toggle');
const mainNavigation = document.querySelector('#hauptnavigation');
const header = menuButton.closest('.site-header');
const masthead = menuButton.closest('.masthead');
const mobile = matchMedia('(max-width: 980px)');

function setMenu(open) {
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    menuButton.querySelector('.nav-toggle-label').textContent = open ? 'Schließen' : 'Menü';
    mainNavigation.hidden = mobile.matches && !open;
}

function syncMenu() {
    menuButton.hidden = !mobile.matches;
    setMenu(mobile.matches && mainNavigation.contains(document.activeElement));
}

const menuOpen = () => mobile.matches && !mainNavigation.hidden;

menuButton.addEventListener('click', () => {
    const open = !menuOpen();
    setMenu(open);
    if (open) mainNavigation.querySelector('a')?.focus({preventScroll:true});
});

header.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuOpen()) {
        event.preventDefault();
        setMenu(false);
        menuButton.focus({preventScroll:true});
    }
});

document.addEventListener('pointerdown', (event) => {
    if (menuOpen() && !header.contains(event.target)) setMenu(false);
});
document.addEventListener('focusin', (event) => {
    if (menuOpen() && !mainNavigation.contains(event.target) && !menuButton.contains(event.target)) setMenu(false);
});
mainNavigation.addEventListener('click', (event) => {
    if (menuOpen() && event.target.closest('a')) setMenu(false);
});

masthead.dataset.menuReady = '';
mobile.addEventListener('change', syncMenu);
syncMenu();
if (typeof ResizeObserver === 'function') {
    const headerSize = new ResizeObserver(([entry]) => {
        const height = entry.target.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--header-clearance', Math.ceil(height) + 'px');
    });
    headerSize.observe(header);
}

const galleryDialog = document.querySelector('.gallery-dialog');
if (galleryDialog && typeof galleryDialog.showModal === 'function') {
    const image = galleryDialog.querySelector('img');
    const caption = galleryDialog.querySelector('figcaption');
    const previous = galleryDialog.querySelector('[data-gallery-prev]');
    const next = galleryDialog.querySelector('[data-gallery-next]');
    let links = [];
    let index = 0;
    let opener;

    function showImage() {
        const link = links[index];
        image.alt = link.querySelector('img').alt;
        image.src = link.href;
        const description = link.closest('figure').querySelector('figcaption')?.textContent;
        caption.textContent = (links.length > 1 ? (index + 1) + ' von ' + links.length : '') +
            (description ? (links.length > 1 ? ' · ' : '') + description : '');
        caption.hidden = !caption.textContent;
        previous.hidden = next.hidden = links.length < 2;
    }

    function step(offset) {
        index = (index + offset + links.length) % links.length;
        showImage();
    }

    for (const gallery of document.querySelectorAll('[data-gallery-tour], .site-gallery')) {
        if (gallery.matches('.site-gallery') && gallery.closest('[data-gallery-tour]')) continue;
        const images = Array.from(gallery.querySelectorAll('figure > a'));
        images.forEach((link, position) => {
            link.addEventListener('click', event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                links = images;
                index = position;
                opener = link;
                showImage();
                galleryDialog.showModal();
            });
        });
    }
    previous.addEventListener('click', () => step(-1));
    next.addEventListener('click', () => step(1));
    galleryDialog.addEventListener('click', event => {
        if (event.target !== galleryDialog) return;
        const bounds = galleryDialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) galleryDialog.close();
    });
    galleryDialog.addEventListener('keydown', event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        step(event.key === 'ArrowLeft' ? -1 : 1);
    });
    galleryDialog.addEventListener('close', () => {
        image.removeAttribute('src');
        opener?.focus();
    });
}
